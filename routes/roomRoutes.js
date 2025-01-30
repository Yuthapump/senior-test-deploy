// roomRoutes.js
const express = require("express");
const router = express.Router();

const {
  addRooms,
  getRoomData,
  getAllData,
  upload,
} = require("../controllers/roomController");

// Route AddRoom
router.post("/add-room", upload.single("roomsPic"), addRooms);

router.get("/get-room-data", getRoomData);

router.get("/get-all-data", getAllData);

module.exports = router;
