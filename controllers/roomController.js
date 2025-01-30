// roomController.js
const fs = require("fs");
const { pool } = require("../config/db");
const multer = require("multer");
const path = require("path");

// ตรวจสอบและสร้างโฟลเดอร์ uploads/childrenPic หากยังไม่มี
const dir = "uploads/roomsPic";
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

const addRooms = async (req, res) => {
  try {
    const { rooms_name, supervisor_id } = req.body;
    console.log("RoomData Data: ", req.body);

    // ตรวจสอบข้อมูลที่จำเป็น
    if (!rooms_name || !supervisor_id) {
      throw new Error("Missing required fields: rooms_name or supervisor_id");
    }

    const roomsPic = req.file ? path.normalize(req.file.path) : null;

    const connection = await pool.getConnection();
    const [result] = await connection.execute(
      "INSERT INTO rooms (rooms_name, roomsPic, supervisor_id) VALUES (?, COALESCE(?, NULL), ?)",
      [rooms_name, roomsPic, supervisor_id]
    );

    connection.release(); // คืน connection กลับสู่ pool

    return res.status(201).json({
      message: "Rooms added successfully",
      roomsData: {
        rooms_name,
        roomsPic,
        supervisor_id,
        insertId: result.insertId,
      },
    });
  } catch (err) {
    console.error("Error adding room:", err.message);

    // ลบไฟล์หากมีข้อผิดพลาด
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (fileErr) {
        console.error("Error deleting uploaded file:", fileErr);
      }
    }

    return res
      .status(500)
      .json({ message: err.message || "Internal server error" });
  }
};

const getRoomData = async (req, res) => {
  let connection;
  try {
    const { supervisor_id } = req.query;

    if (!supervisor_id) {
      return res.status(400).json({ message: "supervisor_id is required" });
    }

    connection = await pool.getConnection();

    // ดึงข้อมูลห้องทั้งหมดที่ supervisor ดูแล
    const [rooms] = await connection.execute(
      `SELECT rooms_id, rooms_name, roomsPic, supervisor_id 
       FROM rooms 
       WHERE supervisor_id = ?`,
      [supervisor_id]
    );

    if (rooms.length === 0) {
      return res.status(404).json({
        message: "No rooms found for this supervisor",
        rooms: [],
      });
    }

    // ดึงข้อมูลเด็กในแต่ละห้อง
    const roomsWithChildren = await Promise.all(
      rooms.map(async (room) => {
        const [children] = await connection.execute(
          `SELECT c.child_id, c.firstName, c.lastName, c.nickName, c.birthday, c.gender, c.childPic 
           FROM rooms_children rc 
           JOIN children c ON rc.child_id = c.child_id 
           WHERE rc.rooms_id = ?`,
          [room.rooms_id]
        );

        return {
          ...room,
          children,
        };
      })
    );

    return res.status(200).json({
      message: "Rooms data retrieved successfully",
      rooms: roomsWithChildren,
    });
  } catch (error) {
    console.error("Error fetching rooms data:", error);
    return res.status(500).json({ message: "Internal server error" });
  } finally {
    if (connection) connection.release();
  }
};

const getAllData = async (req, res) => {
  let connection;
  try {
    const { supervisor_id } = req.query;

    if (!supervisor_id) {
      return res.status(400).json({ message: "supervisor_id is required" });
    }

    connection = await pool.getConnection();

    // ดึงข้อมูลห้องทั้งหมดที่ supervisor ดูแล
    const [rooms] = await connection.execute(
      `SELECT rooms_id, rooms_name, roomsPic, supervisor_id 
       FROM rooms 
       WHERE supervisor_id = ?`,
      [supervisor_id]
    );

    if (rooms.length === 0) {
      return res.status(404).json({
        message: "No rooms found for this supervisor",
        rooms: [],
      });
    }

    // ดึงข้อมูลเด็กในแต่ละห้อง พร้อมดึงข้อมูลการประเมินของเด็กแต่ละคน
    const roomsWithChildrenAndAssessments = await Promise.all(
      rooms.map(async (room) => {
        // ดึงข้อมูลเด็กในห้อง
        const [children] = await connection.execute(
          `SELECT c.child_id, c.firstName, c.lastName, c.nickName, c.birthday, c.gender, c.childPic 
           FROM rooms_children rc 
           JOIN children c ON rc.child_id = c.child_id 
           WHERE rc.rooms_id = ?`,
          [room.rooms_id]
        );

        // ดึงข้อมูลการประเมินของเด็กแต่ละคน
        const childrenWithAssessments = await Promise.all(
          children.map(async (child) => {
            const [assessments] = await connection.execute(
              `SELECT a.assessment_id, a.assessment_date, a.assessment_rank, a.aspect, a.status
               FROM assessments a
               WHERE a.child_id = ?`,
              [child.child_id]
            );

            return {
              ...child,
              assessments,
            };
          })
        );

        return {
          ...room,
          children: childrenWithAssessments,
        };
      })
    );

    return res.status(200).json({
      message: "All data retrieved successfully",
      rooms: roomsWithChildrenAndAssessments,
    });
  } catch (error) {
    console.error("Error fetching all data:", error);
    return res.status(500).json({ message: "Internal server error" });
  } finally {
    if (connection) connection.release();
  }
};

module.exports = { addRooms, getRoomData, getAllData, upload };
