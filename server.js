const express = require("express");
const multer = require("multer");
const cors = require("cors");
const authRoutes = require("./routes/authRoutes"); // แก้ไขคำผิด
require("dotenv").config();
const { addChild } = require("./controllers/childController");

const app = express();
const port = process.env.PORT || 4000; // ใช้พอร์ตเริ่มต้นหากไม่ได้ตั้งค่าใน .env

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

// Middleware สำหรับการแปลง JSON
app.use(express.json());

// ให้บริการไฟล์สาธารณะจากโฟลเดอร์ 'uploads'
app.use("/uploads", express.static("uploads"));

// ตั้งค่าเส้นทาง (Routes)
app.use("/api/auth", authRoutes);

// เส้นทางสำหรับการเพิ่มข้อมูลเด็ก
app.post("/api/auth/addChild", upload.single("childPic"), addChild);

// เริ่มเซิร์ฟเวอร์
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
