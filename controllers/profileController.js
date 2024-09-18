// profileController.js
const multer = require("multer");
const path = require("path");
const { pool } = require("../config/db"); // ปรับให้ใช้ pool แทน

// Controller to handle profile picture upload
const updateProfilePic = async (req, res) => {
  console.log("Update Data: ", req.body);
  console.log("reqfile: ", req.file);

  const { user_id } = req.body;
  const profilePic = req.file ? req.file.path : null;

  if (!user_id || !profilePic) {
    return res
      .status(400)
      .json({ success: false, message: "Missing userId or profilePic" });
  }

  try {
    const connection = await pool.getConnection(); // ใช้ pool เพื่อเชื่อมต่อ
    await connection.execute(
      "UPDATE users SET profilePic = ? WHERE user_id = ?",
      [profilePic, user_id]
    );
    connection.release(); // คืน connection กลับสู่ pool
    res.status(200).json({ success: true, message: "Profile picture updated" });
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ฟังก์ชันสำหรับดึงภาพโปรไฟล์
const getProfilePic = async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res
        .status(400)
        .json({ success: false, message: "No userId provided" });
    }

    const query = "SELECT profilePic FROM users WHERE user_id = ?";
    const [rows] = await pool.query(query, [userId]);

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
  updateProfilePic,
  getProfilePic,
};
