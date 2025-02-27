// profileRoute.js
const express = require("express");
const router = express.Router();

const profileController = require("../controllers/profileController");
const { upload } = require("../controllers/profileController");

// ♻️ Route สำหรับการอัปเดตภาพโปรไฟล์
router.put(
  "/update-profile",
  upload.single("profilePic"),
  profileController.updateUserProfile
);

router.put(
  "/update-child-profile",
  upload.single("childPic"),
  profileController.updateProfileChild
);

// Route สำหรับการดึงภาพโปรไฟล์
router.get("/get-user-profile-pic", profileController.getProfilePic);

// 🔥 Route สำหรับลบบัญชีผู้ใช้
router.delete("/delete-user/:user_id", profileController.deleteUserAccount);

// 🔥 Route สำหรับลบข้อมูลเด็ก
router.delete("/delete-child/:child_id", profileController.deleteChild);

// 🔥 Route สำหรับลบข้อมูลเด็ก Supervisor
router.delete(
  "/delete-child-supervisor/:supervisor_id/:child_id",
  profileController.deleteChildForSupervisor
);

module.exports = router;
