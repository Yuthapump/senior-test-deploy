// server.js
const express = require("express");
const multer = require("multer");
const cors = require("cors");
const path = require("path");
require("dotenv").config();
const { addChild } = require("./controllers/childController");
const authRoutes = require("./routes/authRoutes");
const profileRoutes = require("./routes/profileRoutes");

const app = express();
const port = process.env.PORT; //

// ตั้งค่า multer สำหรับจัดการ multipart/form-data (การอัพโหลดไฟล์)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/"); // กำหนดโฟลเดอร์สำหรับเก็บไฟล์ที่อัพโหลด
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

// Middleware สำหรับ CORS
app.use(
  cors({
    //origin: "*", // อนุญาตทุกโดเมน
    origin: process.env.CORS_ORIGIN,
    methods: ["GET", "POST", "PUT"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Middleware for parsing JSON
app.use(express.json());

// Serve static files from 'uploads' folder
app.use("/uploads", express.static("uploads"));

// Set up routes
app.use("/api/auth", authRoutes);

// Profile Route
app.use("/api/profile", profileRoutes);

// Addchild Route
app.post("/api/auth/addChild", upload.single("childPic"), addChild);

// เริ่มเซิร์ฟเวอร์สำหรับทดสอบ
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

module.exports = upload;
