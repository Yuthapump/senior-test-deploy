// notificateController.js
const { pool } = require("../config/db");
const axios = require("axios");

// ฟังก์ชันสำหรับการอนุมัติคำขอสิทธิ์
const approveAccessRequest = async (req, res) => {
  const { requestId, parent_id } = req.body;

  try {
    const connection = await pool.getConnection();

    // อัปเดตสถานะคำขอสิทธิ์
    await connection.execute(
      "UPDATE access_requests SET status = ? WHERE id = ?",
      ["approved", requestId]
    );

    // ดึงข้อมูลผู้ปกครอง (เช่น Expo Push Token) เพื่อส่งการแจ้งเตือน
    const [parentData] = await connection.execute(
      "SELECT expo_push_token FROM users WHERE user_id = ?",
      [parent_id]
    );

    const parentPushToken = parentData[0].expo_push_token;

    if (parentPushToken) {
      // ส่ง push notification ไปยังผู้ปกครอง
      await sendPushNotification(
        parentPushToken,
        "การขอเข้าถึงข้อมูลของเด็กได้รับการอนุมัติแล้ว!"
      );
    }

    connection.release();

    return res.status(200).json({
      message: "Access request approved and notification sent to parent",
    });
  } catch (err) {
    console.error("Error approving access request:", err);
    return res.status(500).json({ message: "Error approving access request" });
  }
};

// saveExpoPushToken
const saveExpoPushToken = async (req, res) => {
  const { user_id, expoPushToken } = req.body;

  if (!user_id || !expoPushToken) {
    return res
      .status(400)
      .json({ message: "User ID and Expo Push Token are required" });
  }

  try {
    const connection = await pool.getConnection();

    // บันทึกหรืออัปเดต Token ในตาราง expo_tokens
    await connection.execute(
      "INSERT INTO expo_tokens (user_id, expo_push_token) VALUES (?, ?) ON DUPLICATE KEY UPDATE expo_push_token = ?",
      [user_id, expoPushToken, expoPushToken]
    );

    connection.release();

    return res
      .status(200)
      .json({ message: "Expo Push Token saved successfully" });
  } catch (error) {
    console.error("Error saving push token:", error);
    return res.status(500).json({ message: "Error saving push token" });
  }
};

// ฟังก์ชันสำหรับการดึงข้อมูลการแจ้งเตือนตาม user_id
const getAllNotifications = async (req, res) => {
  const { user_id } = req.query;
  try {
    const connection = await pool.getConnection();

    // ดึงข้อมูลการแจ้งเตือนของ user_id ที่ระบุ
    const [notifications] = await connection.execute(
      "SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 10",
      [user_id] // ส่งค่า user_id ที่รับมาเป็น parameter
    );

    connection.release();

    // ส่งกลับข้อมูลการแจ้งเตือน
    return res.status(200).json({ notifications });
  } catch (err) {
    console.error("Error fetching notifications:", err);
    return res.status(500).json({ message: "Error fetching notifications" });
  }
};

module.exports = {
  approveAccessRequest,
  getAllNotifications,
  saveExpoPushToken,
};
