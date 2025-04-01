// childController.js
const fs = require("fs");
const { pool } = require("../config/db");
const multer = require("multer");
const path = require("path");
const { format } = require("date-fns");

const { Expo } = require("expo-server-sdk");
const expo = new Expo();

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

// ฟังก์ชันแปลงจากพุทธศักราช (B.E.) เป็นคริสต์ศักราช (A.D.)
function convertBEtoAD(beDate) {
  const [day, month, year] = beDate.split("-");
  const adYear = parseInt(year) - 543; // แปลงเป็นปีคริสต์ศักราช
  return `${adYear}-${month}-${day}`; // แปลงวันที่ในรูปแบบ YYYY-MM-DD
}

// addChild function สำหรับ Parent
const addChildForParent = async (req, res) => {
  console.log("Child Data: ", req.body);

  if (!req.file) {
    console.error("File not received");
  } else {
    console.log("reqfile: ", req.file);
  }

  const { firstName, lastName, nickName, birthday, gender, parent_id } =
    req.body;
  const childPic = req.file ? path.normalize(req.file.path) : null; // แปลงพาธไฟล์ให้เป็นรูปแบบสากล

  console.log("Req ChildPic: ", childPic);
  console.log("Uploaded file: ", req.file);

  if (!firstName || !lastName || !birthday) {
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
      "SELECT * FROM children WHERE LOWER(firstName) = LOWER(?) AND LOWER(lastName) = LOWER(?) AND birthday = ? AND user_id = ?", // case-insensitive (ไม่สนตัวพิมพ์เล็ก/ใหญ่)
      [firstName, lastName, birthday, parent_id]
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

    // แปลงวันที่จากพุทธศักราชเป็นคริสต์ศักราช
    const adBirthday = convertBEtoAD(birthday); // ได้ผลลัพธ์เป็น 'YYYY-MM-DD'

    // แปลงเป็นวันที่ในรูปแบบที่ MySQL รองรับ
    const formattedBirthday = format(new Date(adBirthday), "yyyy-MM-dd"); // แปลงเป็น 'YYYY-MM-DD'

    // Insert new child data
    const [result] = await pool.execute(
      "INSERT INTO children (firstName, lastName, nickName, birthday, gender, user_id, childPic) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        firstName,
        lastName,
        nickName,
        formattedBirthday,
        gender,
        parent_id,
        childPic,
      ]
    );

    // Log child data
    console.log("Child Data inserted successfully: ", {
      firstName,
      lastName,
      nickName,
      birthday: formattedBirthday,
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

    connection.release(); // คืน connection กลับสู่ pool

    return res.status(201).json({
      message: "Child added successfully",
      childData: {
        firstName,
        lastName,
        nickName,
        birthday: formattedBirthday,
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

// *** sendPushNotification ***
const sendPushNotification = async (expoPushToken, message) => {
  if (!Expo.isExpoPushToken(expoPushToken)) {
    console.error(`Invalid Expo push token: ${expoPushToken}`);
    return;
  }

  try {
    const messages = [
      {
        to: expoPushToken,
        sound: "default",
        body: message,
        data: { withSome: "data" },
      },
    ];

    const ticket = await expo.sendPushNotificationsAsync(messages);
    console.log("Push Notification Sent:", ticket);
  } catch (error) {
    console.error("Error sending push notification:", error);
  }
};

// addChildForSupervisor function สำหรับ Supervisor
const addChildForSupervisor = async (req, res) => {
  const {
    firstName,
    lastName,
    nickName,
    birthday,
    gender,
    supervisor_id,
    rooms_id,
  } = req.body;

  if (!firstName || !lastName || !birthday || !supervisor_id) {
    return res.status(400).json({ message: "Required fields are missing" });
  }

  console.log("req.body:", req.body);
  console.log("rooms_id:", rooms_id);

  try {
    const connection = await pool.getConnection(); // ใช้ pool เพื่อเชื่อมต่อ

    // แปลงวันที่จากพุทธศักราชเป็นคริสต์ศักราช
    const adBirthday = convertBEtoAD(birthday);
    console.log("Converted Birthday to AD:", adBirthday);

    if (!adBirthday || isNaN(new Date(adBirthday).getTime())) {
      return res.status(400).json({ message: "Invalid birthday format" });
    }

    // แปลงเป็นวันที่ในรูปแบบที่ MySQL รองรับ
    const formattedBirthday = format(new Date(adBirthday), "yyyy-MM-dd"); // แปลงเป็น 'YYYY-MM-DD'

    // ตรวจสอบว่า Supervisor มีสิทธิ์ในการเพิ่มเด็กหรือไม่ (เช่น ตรวจสอบ role)
    const [supervisor] = await connection.execute(
      "SELECT role FROM users WHERE user_id = ?",
      [supervisor_id]
    );

    if (supervisor.length === 0 || supervisor[0].role !== "supervisor") {
      return res
        .status(403)
        .json({ message: "Only Supervisors can add children" });
    }

    // Check if the child already exists in the system
    const [existingChild] = await connection.execute(
      "SELECT * FROM children WHERE LOWER(firstName) = LOWER(?) AND LOWER(lastName) = LOWER(?) AND birthday = ?",
      [firstName, lastName, formattedBirthday]
    );

    // กรณีไม่มีพบเด็ก
    if (existingChild.length === 0) {
      connection.release();
      return res.status(404).json({
        message:
          "ไม่พบข้อมูลเด็กในระบบ กรุณาตรวจสอบว่าผู้ปกครองได้เพิ่มข้อมูลเด็กแล้วหรือยัง",
      });
    }

    if (existingChild.length > 0) {
      // ถ้ามีเด็กในระบบแล้ว
      const child = existingChild[0];
      const parent_id = child.user_id;

      console.log("firstName:", firstName);
      console.log("lastName:", lastName);
      console.log("nickName:", nickName);
      console.log("formattedBirthday:", formattedBirthday);
      console.log("gender:", gender);
      console.log("supervisor_id:", supervisor_id);
      // console.log("childPic:", childPic);

      // ตรวจสอบสถานะการขอสิทธิ์จากผู้ปกครอง
      const [existingRequest] = await connection.execute(
        "SELECT * FROM access_requests WHERE child_id = ? AND supervisor_id = ? AND parent_id = ?",
        [child.child_id, supervisor_id, parent_id]
      );

      if (
        existingRequest.length > 0 &&
        existingRequest[0].status === "pending"
      ) {
        return res.status(200).json({
          message: "Access request already sent, waiting for approval",
        });
      }

      // ส่งคำขอสิทธิ์จากผู้ปกครอง
      await connection.execute(
        "INSERT INTO access_requests (parent_id, supervisor_id, child_id, rooms_id, status) VALUES (?, ?, ?, ?, ?)",
        [parent_id, supervisor_id, child.child_id, rooms_id, "pending"]
      );

      // ดึง userName ของ Supervisor
      const [supervisorRows] = await connection.execute(
        "SELECT userName FROM users WHERE user_id = ?",
        [supervisor_id]
      );

      if (supervisorRows.length === 0) {
        return res.status(404).json({ message: "Supervisor not found" });
      }

      const supervisorName = supervisorRows[0].userName;

      // แจ้งเตือนผู้ปกครองในระบบ
      await connection.execute(
        "INSERT INTO notifications (user_id, message, supervisor_id, child_id, template_id, status) VALUES (?, ?, ?, ?, ?, ?)",
        [
          parent_id,
          `คุณ ${supervisorName} ขอเข้าถึงข้อมูลของ\n${firstName} ${lastName} เพื่อใช้ในการติดตามและประเมินพัฒนาการ`,
          supervisor_id,
          child.child_id,
          1,
          "unread",
        ]
      );

      // ดึง ExpoPushToken ล่าสุดของผู้ปกครอง
      const [tokenRows] = await connection.execute(
        `SELECT expo_push_token
   FROM expo_tokens
   WHERE user_id = ?
   ORDER BY updated_at DESC
   LIMIT 1`,
        [parent_id]
      );

      const expoPushToken = tokenRows[0]?.expo_push_token;

      if (expoPushToken) {
        // ส่ง Push Notification
        await sendPushNotification(
          expoPushToken,
          `คุณ ${supervisorName} ได้ร้องขอสิทธิ์การเข้าถึงข้อมูลของ ${firstName} ${lastName} รวมถึงผลการประเมินพัฒนาการของเด็ก เพื่อใช้ในการติดตามและประเมินพัฒนาการอย่างเหมาะสม`
        );
      } else {
        console.error(`Expo Push Token not found for user ID: ${parent_id}`);
      }

      connection.release(); // คืน connection กลับสู่ pool

      return res.status(200).json({
        message: `Access request sent to parent (ID: ${parent_id}) for child: ${firstName} ${lastName}.`,
      });
    }

    // console.log("Child does not exist in the system");
    // console.log("req.body:", req.body);

    // // ถ้าเด็กไม่มีในระบบ, เพิ่มเด็กใหม่ลงใน children
    // const [result] = await connection.execute(
    //   "INSERT INTO children (firstName, lastName, nickName, birthday, gender, user_id, childPic) VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, NULL))",
    //   [
    //     firstName,
    //     lastName,
    //     nickName,
    //     formattedBirthday,
    //     gender,
    //     supervisor_id,
    //     childPic,
    //   ]
    // );

    // console.log("Child added by supervisor successfully: ", {
    //   firstName,
    //   lastName,
    //   nickName,
    //   birthday: formattedBirthday,
    //   gender,
    //   supervisor_id,
    //   childPic,
    // });

    // // เพิ่มเด็กในตาราง supervisor_children
    // await connection.execute(
    //   "INSERT INTO supervisor_children (supervisor_id, child_id) VALUES (?, ?)",
    //   [supervisor_id, result.insertId]
    // );

    // // เพิ่มเด็กใน rooms_children
    // await connection.execute(
    //   "INSERT INTO rooms_children (rooms_id, child_id) VALUES (?, ?)",
    //   [rooms_id, result.insertId]
    // );

    connection.release(); // คืน connection กลับสู่ pool

    return res.status(201).json({
      message: "Child added successfully by Supervisor",
      childData: {
        firstName,
        lastName,
        nickName,
        birthday: formattedBirthday,
        gender,
        supervisor_id,
        // childPic,
        insertId: result.insertId,
      },
    });
  } catch (err) {
    console.error("Error inserting child data:", err);
    return res
      .status(500)
      .json({ message: "Error adding child by Supervisor" });
  }
};

// function to get child data by parent_id
const getChildData = async (req, res) => {
  let connection;
  try {
    const { parent_id } = req.query;

    if (!parent_id?.trim()) {
      return res.status(400).json({ message: "parent_id is required" });
    }

    connection = await pool.getConnection();

    // 🔹 ดึงข้อมูลเด็กที่เป็นลูกของ parent
    const query = `
      SELECT c.* 
      FROM children c 
      JOIN parent_children pc ON c.child_id = pc.child_id 
      WHERE pc.parent_id = ?
    `;
    const [children] = await connection.execute(query, [parent_id]);

    if (children.length === 0) {
      return res.status(200).json({
        message: "ยังไม่มีข้อมูลเด็กในระบบ",
        children: [],
      });
    }

    // 🔹 ดึงข้อมูลการประเมินของเด็กแต่ละคน
    const childDataWithAssessments = await Promise.all(
      children.map(async (child) => {
        const assessmentQuery = `
          SELECT a.*
          FROM assessments a
          JOIN assessment_details ad ON a.assessment_details_id = ad.assessment_details_id
          WHERE a.child_id = ?
            AND a.assessment_id = (
              -- ดึง assessment_id ที่ตรงตามเงื่อนไข
              SELECT assessment_id FROM assessments sub
              WHERE sub.child_id = a.child_id AND sub.aspect = a.aspect
              ORDER BY 
                -- 1️⃣ เลือก rank ต่ำสุดของ not_passed ก่อน
                CASE WHEN sub.status = 'not_passed' THEN sub.assessment_rank END ASC,
                -- 2️⃣ ถ้าไม่มี not_passed ให้เอา in_progress
                CASE WHEN sub.status = 'in_progress' THEN 1 ELSE 0 END DESC,
                -- 3️⃣ ถ้าไม่มีทั้ง not_passed และ in_progress ให้ใช้ passed_all
                CASE WHEN sub.status = 'passed_all' THEN 1 ELSE 0 END DESC,
                sub.assessment_date DESC
              LIMIT 1
            )
        `;
        const [assessmentRows] = await connection.execute(assessmentQuery, [
          child.child_id,
        ]);

        return { ...child, assessments: assessmentRows };
      })
    );

    return res.status(200).json({
      message: "ดึงข้อมูลเด็กสำหรับผู้ปกครองสำเร็จ",
      parent_id,
      children: childDataWithAssessments,
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

module.exports = {
  addChildForParent,
  addChildForSupervisor,
  getChildData,
  upload,
};
