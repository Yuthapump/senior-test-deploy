// profileRoute.js
const express = require("express");
const multer = require("multer");

const router = express.Router();

const {
  updateProfilePic,
  getProfilePic,
} = require("../controllers/profileController");

// ตั้งค่า multer สำหรับจัดการ multipart/form-data (การอัพโหลดไฟล์)
const upload = multer({
  dest: "uploads/", // โฟลเดอร์ที่จะเก็บไฟล์ที่อัพโหลด
  limits: { fileSize: 5 * 1024 * 1024 }, // ขนาดไฟล์สูงสุด 5MB
});

// Route สำหรับการอัปเดตภาพโปรไฟล์
router.put(
  "/update-profile-pic",
  upload.single("profilePic"),
  updateProfilePic
);

// Route สำหรับการดึงภาพโปรไฟล์
router.get("/get-user-profile-pic", getProfilePic);

module.exports = router;
