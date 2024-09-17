// profileController.js
const multer = require("multer");
const path = require("path");
const { pool } = require("../config/db"); // ปรับให้ใช้ pool แทน

// Set up multer for file uploads
const upload = multer({
  dest: "uploads/", // Folder to store uploaded files
  limits: { fileSize: 5 * 1024 * 1024 }, // Max file size 5MB
});

// Controller to handle profile picture upload
const updateProfilePic = async (req, res) => {
  const { userId } = req.body;
  const profilePic = req.file ? req.file.path : null;

  if (!userId || !profilePic) {
    return res
      .status(400)
      .json({ success: false, message: "Missing userId or profilePic" });
  }

  try {
    const connection = await pool.getConnection(); // ใช้ pool เพื่อเชื่อมต่อ
    await connection.execute(
      "UPDATE users SET profilePic = ? WHERE user_id = ?",
      [profilePic, userId]
    );
    connection.release(); // คืน connection กลับสู่ pool
    res.status(200).json({ success: true, message: "Profile picture updated" });
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const getProfilePic = async (req, res) => {
  try {
    const { userId } = req.query; // Get userId from query parameters

    if (!userId) {
      return res
        .status(400)
        .json({ success: false, message: "No userId provided" });
    }

    const connection = await pool.getConnection(); // ใช้ pool เพื่อเชื่อมต่อ
    const query = "SELECT profilePic FROM users WHERE user_id = ?";
    const [rows] = await connection.query(query, [userId]);
    connection.release(); // คืน connection กลับสู่ pool

    if (rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const profilePicUrl = rows[0].profilePic;
    res.json({ success: true, profilePic: profilePicUrl });
  } catch (error) {
    console.error("Error fetching profile picture:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

module.exports = {
  upload,
  updateProfilePic,
  getProfilePic,
};
