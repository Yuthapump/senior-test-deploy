// profileRoute.js
const express = require("express");
const upload = require("../server");
const {
  updateProfilePic,
  getProfilePic,
} = require("../controllers/profileController");

const router = express.Router();

// Route สำหรับการอัปเดตภาพโปรไฟล์
/*router.post(
  "/update-profile-pic",
  upload.single("profilePic"),
  updateProfilePic
);*/

// Route สำหรับการดึงภาพโปรไฟล์
router.get("/get-user-profile-pic", getProfilePic);

module.exports = router;
