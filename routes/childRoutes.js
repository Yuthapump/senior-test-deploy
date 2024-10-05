// profileRoute.js
const express = require("express");
const router = express.Router();

const {
  getChildData,
  addChild,
  upload,
} = require("../controllers/childController");

// Route Addchild
router.post("/addChild", upload.single("childPic"), addChild);

// Route สำหรับการดึง
router.get("/get-child-data", getChildData);

module.exports = router;
