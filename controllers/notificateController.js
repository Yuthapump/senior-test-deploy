// notificateController.js
const { pool } = require("../config/db");

const { Expo } = require("expo-server-sdk");
const expo = new Expo();

// *** sendPushNotification ***
const sendPushNotification = async (expoPushToken, message) => {
  if (!Expo.isExpoPushToken(expoPushToken)) {
    console.error(`Invalid Expo push token: ${expoPushToken}`);
    return;
  }

  try {
    const messages = [
      {
        to: expoPushToken,
        sound: "default",
        body: message,
        data: { withSome: "data" },
      },
    ];

    const ticket = await expo.sendPushNotificationsAsync(messages);
    console.log("Push Notification Sent:", ticket);
  } catch (error) {
    console.error("Error sending push notification:", error);
  }
};

// ฟังก์ชันสำหรับการอนุมัติคำขอสิทธิ์
const approveAccessRequest = async (req, res) => {
  const { child_id, supervisor_id, parent_id } = req.body;

  if (!child_id || !supervisor_id || !parent_id) {
    return res
      .status(400)
      .json({ message: "Child ID, Supervisor ID, and Parent ID are required" });
  }

  try {
    const connection = await pool.getConnection();

    // อัปเดตสถานะคำขอสิทธิ์
    await connection.execute(
      "UPDATE access_requests SET status = ? WHERE child_id = ? AND supervisor_id = ?",
      ["approved", child_id, supervisor_id]
    );

    // ดึง rooms_id ของ Supervisor
    const [roomsIdRows] = await connection.execute(
      "SELECT rooms_id FROM access_requests WHERE supervisor_id = ? AND child_id = ?",
      [supervisor_id, child_id]
    );

    if (roomsIdRows.length === 0) {
      return res.status(404).json({ message: "Supervisor not found" });
    }

    const roomsId = roomsIdRows[0].rooms_id;
    console.log("roomsId: ", roomsId);

    // เพิ่มเด็กใน rooms_children
    await connection.execute(
      "INSERT INTO rooms_children (rooms_id, child_id, supervisor_id) VALUES (?, ?, ?)",
      [roomsId, child_id, supervisor_id]
    );

    // เพิ่มเด็กในตาราง supervisor_children
    await connection.execute(
      "INSERT INTO supervisor_children (supervisor_id, child_id) VALUES (?, ?)",
      [supervisor_id, child_id]
    );

    // ดึงข้อมูลผู้ดูแล (เช่น Expo Push Token) เพื่อส่งการแจ้งเตือน
    const [parentData] = await connection.execute(
      "SELECT expo_push_token FROM expo_tokens WHERE user_id = ?",
      [parent_id]
    );

    if (!parentData.length) {
      return res.status(404).json({ message: "Parent not found" });
    }

    const parentPushToken = parentData[0].expo_push_token;

    if (parentPushToken) {
      // ส่ง push notification ไปยังผู้ดูแล
      await sendPushNotification(
        parentPushToken,
        "การขอเข้าถึงข้อมูลของเด็กได้รับการอนุมัติแล้ว!"
      );
    }

    connection.release();

    return res.status(200).json({
      message: "Access request approved and notification sent to supervisor",
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
      `INSERT INTO expo_tokens (user_id, expo_push_token, updated_at)
   VALUES (?, ?, NOW())
   ON DUPLICATE KEY UPDATE 
     expo_push_token = VALUES(expo_push_token), 
     updated_at = NOW()`,
      [user_id, expoPushToken]
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
