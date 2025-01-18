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

    // ตรวจสอบข้อมูลที่จำเป็น
    if (!rooms_name || !supervisor_id) {
      throw new Error("Missing required fields: rooms_name or supervisor_id");
    }

    const rooms_pic = req.file ? path.normalize(req.file.path) : null;

    const connection = await pool.getConnection();
    const [result] = await connection.execute(
      "INSERT INTO rooms (rooms_name, rooms_pic, supervisor_id) VALUES (?, COALESCE(?, NULL), ?)",
      [rooms_name, rooms_pic, supervisor_id]
    );

    connection.release(); // คืน connection กลับสู่ pool

    return res.status(201).json({
      message: "Rooms added successfully",
      roomsData: {
        rooms_name,
        rooms_pic,
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

module.exports = { addRooms, upload };
