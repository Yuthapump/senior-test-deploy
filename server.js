const express = require("express");
const multer = require("multer");
const cors = require("cors");
const authRoutes = require("./routes/authRoutes"); // แก้ไขคำผิด
require("dotenv").config();
const { addChild } = require("./controllers/childController");

const app = express();
const port = process.env.PORT || 4000; // ใช้พอร์ตเริ่มต้นหากไม่ได้ตั้งค่าใน .env

// ตั้งค่า Multer สำหรับการอัปโหลดไฟล์
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/"); // โฟลเดอร์ที่ไฟล์จะถูกเก็บ
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname)
    ); // ตั้งชื่อไฟล์ให้เป็นเอกลักษณ์
  },
});

const fileFilter = (req, file, cb) => {
  // ตรวจสอบชนิดของไฟล์ที่อนุญาต
  const allowedTypes = ["image/jpeg", "image/png", "image/gif"];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Invalid file type"), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
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
