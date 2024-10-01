// profileRoute.js
const express = require("express");
const router = express.Router();

const { getChildData } = require("../controllers/childController");

// Route สำหรับการอัปเดตภาพโปรไฟล์
/*router.put(
  "/update-profile-pic",
  upload.single("profilePic"),
  updateProfilePic
);*/

// Route สำหรับการดึง
router.get("/get-child-data", getChildData);

module.exports = router;
