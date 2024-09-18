// server.js
const express = require("express");
const multer = require("multer");
const cors = require("cors");
require("dotenv").config();
const { addChild } = require("./controllers/childController");
const authRoutes = require("./routes/authRoutes");
const profileRoutes = require("./routes/profileRoutes");

const app = express();
const port = process.env.PORT; //

// ตั้งค่า multer สำหรับจัดการ multipart/form-data (การอัพโหลดไฟล์)
const upload = multer({
  dest: "uploads/", // โฟลเดอร์ที่จะเก็บไฟล์ที่อัพโหลด
  limits: { fileSize: 5 * 1024 * 1024 }, // ขนาดไฟล์สูงสุด 5MB
});

// Middleware สำหรับ CORS
app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Middleware for parsing JSON
app.use(express.json());

// Serve static files from 'uploads' folder
app.use("/uploads", express.static("uploads"));

// Set up routes
app.use("/api/auth", authRoutes);

// Route
app.use("/api/profile", profileRoutes);

// เส้นทางสำหรับการเพิ่มข้อมูลเด็ก
app.post("/api/auth/addChild", upload.single("childPic"), addChild);

// เริ่มเซิร์ฟเวอร์สำหรับทดสอบ
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

module.exports = upload;
