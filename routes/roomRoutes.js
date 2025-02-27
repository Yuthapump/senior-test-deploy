// roomRoutes.js
const express = require("express");
const router = express.Router();

const {
  addRooms,
  getRoomData,
  getAllData,
  getChildDataOfRoom,
  deleteRoom,
  removeChildFromRoom,
  upload,
} = require("../controllers/roomController");

// Route AddRoom
router.post("/add-room", upload.single("roomsPic"), addRooms);

router.get("/get-room-data", getRoomData);

router.get("/get-all-data", getAllData);

router.get("/get-child-data-of-room", getChildDataOfRoom);

router.delete("/delete-room", deleteRoom);

router.delete("/remove-child-from-room", removeChildFromRoom);

router.put(
  "/update-room/:rooms_id/:supervisor_id",
  upload.single("roomsPic"),
  addRooms
);

module.exports = router;
