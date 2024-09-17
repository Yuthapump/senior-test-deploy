const multer = require("multer");
const path = require("path");
const connectDB = require("../config/db"); // Adjust the path as needed

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
    const connection = await connectDB(); // Your database connection function
    await connection.execute(
      "UPDATE users SET profilePic = ? WHERE user_id = ?",
      [profilePic, userId]
    );
    res.status(200).json({ success: true, message: "Profile picture updated" });
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = {
  upload,
  updateProfilePic,
};
