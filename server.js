const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const authRoutes = require("./routes/authRoutes"); // นำเข้า routes
require("dotenv").config(); // โหลด environment variables
const { connectDB } = require("./config/db"); // การเชื่อมต่อฐานข้อมูล
const privacyRoutes = require("./routes/privacyRoutes");

const app = express();
const port = process.env.PORT;

// Middleware
app.use(bodyParser.json());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:8081", // ใช้ค่า default ถ้าไม่กำหนด
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// เชื่อมต่อกับฐานข้อมูล
const connection = connectDB();

// Routes
app.use("/api/auth", authRoutes); // จัดการ routes สำหรับ authentication
app.use("/privacy", privacyRoutes);

// เริ่มต้นเซิร์ฟเวอร์
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
