// assessmentDetailsController.js
const fs = require("fs");
const { pool } = require("../config/db");
const multer = require("multer");
const path = require("path");

// ตรวจสอบและสร้างโฟลเดอร์ uploads/assessmentPic หากยังไม่มี
const dir = "uploads/assessmentPic";
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
  limits: { fileSize: 20 * 1024 * 1024 }, // จำกัดขนาดไฟล์สูงสุดที่อัปโหลดได้
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

// Function to add assessment details
const addAssessmentDetail = async (req, res) => {
  const {
    assessment_id,
    aspect,
    assessment_rank,
    assessment_name,
    assessment_device_name,
    assessment_device_detail,
    assessment_method,
    assessment_sucession,
  } = req.body;

  // รับชื่อไฟล์ที่อัปโหลด
  const assessment_image = req.files["assessment_image"]
    ? path.normalize(req.files["assessment_image"][0].path)
    : null;

  const assessment_device_image = req.files["assessment_device_image"]
    ? path.normalize(req.files["assessment_device_image"][0].path)
    : null;

  try {
    const query = `
      INSERT INTO assessment_details (assessment_id, aspect, assessment_rank, assessment_name, assessment_image, assessment_device_name, assessment_device_image, assessment_device_detail, assessment_method, assessment_sucession)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    const [rows] = await pool.query(query, [
      assessment_id,
      aspect,
      assessment_rank,
      assessment_name,
      assessment_image,
      assessment_device_name,
      assessment_device_image,
      assessment_device_detail,
      assessment_method,
      assessment_sucession,
    ]);

    res.status(201).json({
      message: "Assessment detail added successfully",
      detailId: rows.insertId,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to add assessment detail" });
  }
};

// Export the upload middleware along with the controller function
module.exports = {
  addAssessmentDetail,
  upload, // ส่งออก middleware สำหรับใช้ใน route
};
