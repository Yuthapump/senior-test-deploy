// profileRoute.js
const express = require("express");
const router = express.Router();

// const {
//   getChildData,
//   addChild,
//   upload,
// } = require("../controllers/childController");

const { childapi } = require("../controllers/childController");

// Route Addchild
router.post("/addChild", childapi.upload.single("childPic"), childapi.addChild);

// Route สำหรับการดึง
router.get("/get-child-data", childapi.getChildData);

module.exports = router;
