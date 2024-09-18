// authRoutes.js
const express = require("express");
const { register, login } = require("../controllers/authController");
const {
  updateProfilePic,
  getProfilePic,
} = require("../controllers/profileController"); // นำเข้าฟังก์ชันที่เกี่ยวข้อง

const router = express.Router();

// Route for Register
router.post("/register", register);

// Route for Login
router.post("/login", login);

// Route for updating profile picture
router.put("/updateProfilePic", updateProfilePic);

// Route for getting profile picture
router.get("/get-user-profile-pic", getProfilePic);

// เส้นทางสำหรับการเพิ่มข้อมูลเด็ก
// router.post("/addChild", addChild); // ลบคอมเมนต์หากต้องการใช้งาน

module.exports = router;
