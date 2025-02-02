// profileRoute.js
const express = require("express");
const router = express.Router();

const {
  updateUserProfile,
  getProfilePic,
  upload,
} = require("../controllers/profileController");

// Route สำหรับการอัปเดตภาพโปรไฟล์
router.put("/update-profile", upload.single("profilePic"), updateUserProfile);

// Route สำหรับการดึงภาพโปรไฟล์
router.get("/get-user-profile-pic", getProfilePic);

module.exports = router;
