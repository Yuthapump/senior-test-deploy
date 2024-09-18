// profileController.js
const fs = require("fs");
const path = require("path");
const { pool } = require("../config/db");

// Controller to handle profile picture upload
const updateProfilePic = async (req, res) => {
  const { user_id } = req.body;
  const profilePic = req.file ? req.file.path : null;

  if (!user_id || !profilePic) {
    return res
      .status(400)
      .json({ success: false, message: "Missing userId or profilePic" });
  }

  try {
    const connection = await pool.getConnection();

    // Get the old profile picture path from the database
    const [oldPicRows] = await connection.execute(
      "SELECT profilePic FROM users WHERE user_id = ?",
      [user_id]
    );

    if (oldPicRows.length > 0 && oldPicRows[0].profilePic) {
      // Delete old profile picture from the filesystem
      const oldPicPath = oldPicRows[0].profilePic;
      try {
        if (fs.existsSync(path.resolve(oldPicPath))) {
          fs.unlinkSync(path.resolve(oldPicPath));
        }
      } catch (err) {
        console.error("Error deleting old profile picture:", err);
      }
    }

    // Update database with new profile picture path
    await connection.execute(
      "UPDATE users SET profilePic = ? WHERE user_id = ?",
      [profilePic, user_id]
    );
    connection.release();

    res.status(200).json({ success: true, message: "Profile picture updated" });
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Function to get profile picture
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
