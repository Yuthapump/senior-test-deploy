// profileController.js
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const { pool } = require("../config/db");

// ตรวจสอบและสร้างโฟลเดอร์ uploads/profilePic หากยังไม่มี
const dir = "uploads/profilePic";
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

// ตั้งค่า multer สำหรับอัปโหลดไฟล์
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname)
    );
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // จำกัดขนาดไฟล์ 20MB
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error("กรุณาอัปโหลดไฟล์รูปภาพที่เป็นนามสกุล jpeg, jpg, หรือ png"));
  },
});

// ฟังก์ชันอัปเดตโปรไฟล์ทั้งหมด
const updateUserProfile = async (req, res) => {
  const { user_id, userName, email, phoneNumber } = req.body;
  const newProfilePic = req.file ? req.file.path : null;

  if (!user_id) {
    return res.status(400).json({ success: false, message: "Missing user_id" });
  }

  let connection;
  try {
    connection = await pool.getConnection();

    // 🔹 ดึงค่า profilePic เก่าจากฐานข้อมูล
    const [oldProfilePicRows] = await connection.execute(
      "SELECT profilePic FROM users WHERE user_id = ?",
      [user_id]
    );

    if (oldProfilePicRows.length === 0) {
      connection.release();
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const oldProfilePic = oldProfilePicRows[0].profilePic;

    // 🔹 อัปเดตข้อมูลผู้ใช้
    await connection.execute(
      `UPDATE users 
       SET userName = COALESCE(?, userName), 
           email = COALESCE(?, email), 
           phoneNumber = COALESCE(?, phoneNumber), 
           profilePic = COALESCE(?, profilePic) 
       WHERE user_id = ?`,
      [
        userName || null,
        email || null,
        phoneNumber || null,
        newProfilePic,
        user_id,
      ]
    );

    connection.release();

    // 🔹 ลบไฟล์ profilePic เก่าหากมีและมีการอัปโหลดไฟล์ใหม่
    if (newProfilePic && oldProfilePic) {
      fs.unlink(oldProfilePic, (err) => {
        if (err) {
          console.error("Error deleting old profile picture:", err);
        } else {
          console.log(
            "Old profile picture deleted successfully:",
            oldProfilePic
          );
        }
      });
    }

    res
      .status(200)
      .json({ success: true, message: "Profile updated successfully" });
  } catch (error) {
    console.error("Error updating user profile:", error);
    if (connection) connection.release();
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ฟังก์ชันดึงรูปโปรไฟล์
const getProfilePic = async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) {
      return res
        .status(400)
        .json({ success: false, message: "No userId provided" });
    }

    const [rows] = await pool.query(
      "SELECT profilePic FROM users WHERE user_id = ?",
      [userId]
    );

    if (rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    res.json({ success: true, profilePic: rows[0].profilePic });
  } catch (error) {
    console.error("Error fetching profile picture:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

module.exports = { updateUserProfile, getProfilePic, upload };
