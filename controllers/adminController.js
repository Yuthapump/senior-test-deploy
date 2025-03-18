const fs = require("fs");
const path = require("path");
const multer = require("multer");
const { pool } = require("../config/db");

// User List
const user_list = async (req, res) => {
  let connection;
  try {
    const { userId } = req.params;

    if (!userId) {
      return res
        .status(400)
        .json({ success: false, message: "No userId provided" });
    }

    connection = await pool.getConnection();

    // ตรวจสอบว่า user เป็น admin หรือไม่
    const [adminCheck] = await connection.execute(
      `SELECT * FROM users WHERE user_id = ? AND role = 'admin'`,
      [userId]
    );

    if (adminCheck.length === 0) {
      connection.release();
      return res
        .status(403)
        .json({ success: false, message: "Unauthorized: Not an admin" });
    }

    // ดึงข้อมูล user ทั้งหมด
    const [users] = await connection.execute(
      `SELECT 
        user_id, 
        userName, 
        email, 
        phoneNumber, 
        profilePic, 
        role, 
        created_at 
      FROM users`
    );

    connection.release();
    return res.status(200).json({
      success: true,
      message: "User list retrieved successfully",
      users: users,
    });
  } catch (error) {
    console.error("Error fetching user list:", error);
    if (connection) connection.release();
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// Child List
const child_list = async (req, res) => {};

module.exports = {
  user_list,
  child_list,
};
