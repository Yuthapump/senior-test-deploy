// childController.js
const fs = require("fs");
const { pool } = require("../config/db");
const multer = require("multer");
const path = require("path");

// ตรวจสอบและสร้างโฟลเดอร์ uploads/childrenPic หากยังไม่มี
const dir = "uploads/childrenPic";
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true }); // สร้างโฟลเดอร์พร้อมกับโฟลเดอร์ย่อยที่ขาดหายไป
}

// ตั้งค่า multer สำหรับจัดการ multipart/form-data (การอัพโหลดไฟล์)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, dir); // กำหนดโฟลเดอร์สำหรับเก็บไฟล์ที่อัพโหลด
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname)
    ); // ตั้งชื่อไฟล์ใหม่พร้อมนามสกุลเดิม
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png/; // รองรับไฟล์ JPEG, JPG และ PNG
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(
      path.extname(file.originalname).toLowerCase()
    );

    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error("กรุณาอัพโหลดไฟล์รูปภาพที่เป็นนามสกุล jpeg, jpg, หรือ png"));
  },
});

// addChild function
const addChild = async (req, res) => {
  console.log("Child Data: ", req.body);

  if (!req.file) {
    console.error("File not received");
  } else {
    console.log("reqfile: ", req.file);
  }

  const { childName, nickname, birthday, gender, parent_id, supervisor_id } =
    req.body;
  const childPic = req.file ? path.normalize(req.file.path) : null; // แปลงพาธไฟล์ให้เป็นรูปแบบสากล

  console.log("Req ChildPic: ", childPic);
  console.log("Uploaded file: ", req.file);

  if (!childName || !birthday || !parent_id) {
    // ลบไฟล์ถ้าไม่มีข้อมูลที่จำเป็น
    if (req.file) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error("Error deleting file:", err);
      });
    }
    return res.status(400).json({ message: "Required fields are missing" });
  }

  if (!childPic) {
    console.warn("No file uploaded");
  }

  try {
    const connection = await pool.getConnection(); // ใช้ pool เพื่อเชื่อมต่อ

    // Check if child already exists
    const [existingChild] = await connection.execute(
      "SELECT * FROM children WHERE childName = ? AND birthday = ? AND parent_id = ?",
      [childName, birthday, parent_id]
    );

    if (existingChild.length > 0) {
      connection.release(); // คืน connection กลับสู่ pool

      // ลบไฟล์ถ้าเด็กมีอยู่แล้ว
      if (req.file) {
        fs.unlink(req.file.path, (err) => {
          if (err) console.error("Error deleting file:", err);
        });
      }

      return res.status(409).json({ message: "Child already exists" });
    }

    // Insert new child data
    const [result] = await connection.execute(
      "INSERT INTO children (childName, nickname, birthday, gender, parent_id, childPic) VALUES (?, ?, ?, ?, ?, COALESCE(?, NULL))",
      [childName, nickname, birthday, gender, parent_id, childPic]
    );

    // Log child data
    console.log("Child Data inserted successfully: ", {
      childName,
      nickname,
      birthday,
      gender,
      parent_id,
      childPic,
      insertId: result.insertId,
    });

    // Insert into parent_children
    await connection.execute(
      "INSERT INTO parent_children (parent_id, child_id) VALUES (?, ?)",
      [parent_id, result.insertId]
    );

    // If supervisor_id is provided, insert into supervisor_children
    if (supervisor_id) {
      await connection.execute(
        "INSERT INTO supervisor_children (supervisor_id, child_id) VALUES (?, ?)",
        [supervisor_id, result.insertId]
      );
    }

    connection.release(); // คืน connection กลับสู่ pool

    return res.status(201).json({
      message: "Child added successfully",
      childData: {
        childName,
        nickname,
        birthday,
        gender,
        parent_id,
        childPic,
        insertId: result.insertId,
      },
    });
  } catch (err) {
    console.error("Error inserting data:", err);

    // ลบไฟล์ถ้าเกิดข้อผิดพลาด
    if (req.file) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error("Error deleting file:", err);
      });
    }

    return res.status(500).json({ message: "Error adding child" });
  }
};

// function to get child data by parent_id or supervisor_id
// function to get child data by parent_id or supervisor_id
const getChildData = async (req, res) => {
  let connection;
  try {
    const { parent_id, supervisor_id } = req.query;

    connection = await pool.getConnection();

    // ตรวจสอบว่า parent_id หรือ supervisor_id ถูกระบุ
    if (!parent_id && !supervisor_id) {
      return res
        .status(400)
        .json({ message: "parent_id or supervisor_id is required" });
    }

    let query;
    const params = [];

    // กำหนดคำสั่ง SQL ตาม parent_id หรือ supervisor_id
    if (parent_id) {
      query = `
        SELECT 
          c.*, 
          a.assessment_id, 
          a.status AS assessment_status, 
          ad.assessment_name, 
          ad.age_range, 
          ad.assessment_method, 
          ad.assessment_succession, 
          ad.training_method, 
          ad.training_device_name, 
          ad.training_device_image
        FROM children c
        LEFT JOIN assessments a ON c.child_id = a.child_id AND a.status = 'in_progress'
        LEFT JOIN assessment_details ad ON a.assessment_details_id = ad.assessment_details_id
        WHERE c.parent_id = ?
      `;
      params.push(parent_id);
    } else if (supervisor_id) {
      query = `
        SELECT 
          c.*, 
          a.assessment_id, 
          a.status AS assessment_status, 
          ad.assessment_name, 
          ad.age_range, 
          ad.assessment_method, 
          ad.assessment_succession, 
          ad.training_method, 
          ad.training_device_name, 
          ad.training_device_image
        FROM children c
        LEFT JOIN assessments a ON c.child_id = a.child_id AND a.status = 'in_progress'
        LEFT JOIN assessment_details ad ON a.assessment_details_id = ad.assessment_details_id
        JOIN supervisor_children sc ON c.child_id = sc.child_id
        WHERE sc.supervisor_id = ?
      `;
      params.push(supervisor_id);
    }

    // ดึงข้อมูลเด็กและการประเมินในคำสั่งเดียว
    const [rows] = await connection.execute(query, params);

    if (rows.length === 0) {
      return res.status(404).json({
        message: "ไม่พบข้อมูลเด็กที่ระบุ",
      });
    }

    // จัดกลุ่มข้อมูลตาม child_id
    const groupedData = rows.reduce((acc, row) => {
      const childId = row.child_id;
      if (!acc[childId]) {
        acc[childId] = {
          ...row,
          assessments: [],
        };
      }

      // เพิ่มข้อมูลการประเมินใน array assessments
      if (row.assessment_id) {
        acc[childId].assessments.push({
          assessment_id: row.assessment_id,
          status: row.assessment_status,
          assessment_name: row.assessment_name,
          age_range: row.age_range,
          assessment_method: row.assessment_method,
          assessment_succession: row.assessment_succession,
          training_method: row.training_method,
          training_device_name: row.training_device_name,
          training_device_image: row.training_device_image,
        });
      }

      return acc;
    }, {});

    // แปลงข้อมูลที่จัดกลุ่มเป็น array
    const resultData = Object.values(groupedData);

    return res.status(200).json({
      message: "ดึงข้อมูลเด็กและการประเมินที่อยู่ในสถานะ 'in_progress' สำเร็จ",
      data: resultData,
    });
  } catch (error) {
    console.error("Error fetching child data and assessments:", error);
    return res.status(500).json({
      error: "เกิดข้อผิดพลาดในการดึงข้อมูลเด็กและการประเมิน",
    });
  } finally {
    if (connection) connection.release();
  }
};

module.exports = { addChild, getChildData, upload };
