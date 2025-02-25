const express = require("express");
const multer = require("multer");
const cors = require("cors");
const path = require("path");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const authRoutes = require("./routes/authRoutes");
const profileRoutes = require("./routes/profileRoutes");
const childRoutes = require("./routes/childRoutes");
const assessmentRoutes = require("./routes/assessmentRoutes");
const roomRoutes = require("./routes/roomRoutes");
const notificateRoutes = require("./routes/notificateRoutes");

const {
  sendAssessmentReminder,
} = require("./controllers/notificateController");

const app = express();
const port = process.env.PORT;

// === ✅ บอกให้ Express เชื่อมต่อผ่าน Proxy ===
app.set("trust proxy", 1);

// === ✅ ตั้งค่า Rate Limit เพื่อป้องกันการโจมตี DDoS ====
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 นาที
  max: 700, // จำกัดการเรียก API ต่อ 15 นาทีต่อ IP
  message: "Too many requests, please try again later.",
});
app.use(limiter);

// === Middleware สำหรับเพิ่มความปลอดภัยด้วย Helmet ===
app.use(helmet());

// === ตั้งค่า Multer ===
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/"); // โฟลเดอร์สำหรับเก็บไฟล์ที่อัพโหลด
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const sanitizedFilename = path.basename(file.originalname); // ป้องกัน Directory Traversal
    cb(null, `${file.fieldname}-${uniqueSuffix}-${sanitizedFilename}`);
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // จำกัดขนาดไฟล์ 20MB
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png/; // รองรับไฟล์ JPEG, JPG, และ PNG
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(
      path.extname(file.originalname).toLowerCase()
    );

    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(
      new Error(
        "Invalid file type. Please upload an image file with jpeg, jpg, or png extension."
      )
    );
  },
}).single("file"); // รองรับอัปโหลดไฟล์เพียงไฟล์เดียวต่อครั้ง

// === Route สำหรับการอัปโหลดไฟล์ ===
app.post("/api/upload", (req, res) => {
  upload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: `Multer error: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ error: `Upload error: ${err.message}` });
    }
    res.status(200).json({ message: "File uploaded successfully!" });
  });
});

// ให้บริการ assetlinks.json บนเส้นทาง /.well-known/
app.use(
  "/.well-known",
  express.static(path.join(__dirname, "public/.well-known"))
);

// === Middleware สำหรับตรวจสอบ Token หรือ Authorization ===
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Access denied. No token provided." });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: "Invalid token." });
    }
    req.user = user; // เก็บข้อมูลผู้ใช้ที่ถอดรหัสได้ใน req.user
    next();
  });
};

// === Middleware สำหรับ CORS ===
app.use(
  cors({
    origin: [process.env.CORS_ORIGIN],
    methods: ["GET", "POST", "PUT"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// === Middleware สำหรับ JSON ===
app.use(express.json());

// Serve static files from 'uploads' folder
app.use("/uploads", express.static("uploads"));

// === Routes ===
app.use("/api/auth", authRoutes);
app.use("/api/profiles", authenticateToken, profileRoutes);
app.use("/api/childs", authenticateToken, childRoutes);
app.use("/api/assessments", assessmentRoutes);
app.use("/api/rooms", authenticateToken, roomRoutes);
app.use("/api/notifications", authenticateToken, notificateRoutes);

// === Send Warning Assessment per 2 weeks ===
sendAssessmentReminder();
// setInterval(sendAssessmentReminder, 24 * 60 * 60 * 1000);
setInterval(sendAssessmentReminder, 10 * 60 * 1000); // for test 10 minutes

// === Server Start ===
app.listen(port, () => {
  console.log(`Server is running on: http://localhost:${port}`); // For localhost
  console.log("Ready for commands, Sir'Benz!");
});

module.exports = upload;
