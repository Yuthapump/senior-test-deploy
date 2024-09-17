const express = require("express");
const { getProfilePic } = require("../controllers/profileController");

const router = express.Router();

// เส้นทางสำหรับดึงภาพโปรไฟล์
router.get("/get-user-profile-pic", getProfilePic);

module.exports = router;
