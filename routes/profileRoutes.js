// profileRoute.js
const express = require("express");
const router = express.Router();

const {
  updateProfilePic,
  getProfilePic,
  upload,
} = require("../controllers/profileController");

// Route สำหรับการอัปเดตภาพโปรไฟล์
router.put(
  "/update-profile-pic",
  upload.single("profilePic"),
  updateProfilePic
);

// Route สำหรับการดึงภาพโปรไฟล์
router.get("/get-user-profile-pic", getProfilePic);

module.exports = router;
