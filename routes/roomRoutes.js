// roomRoutes.js
const express = require("express");
const router = express.Router();

const { addRooms, upload } = require("../controllers/roomController");

// Route AddRoom
router.post("/addRoom", upload.single("rooms_pic"), addRooms);

module.exports = router;
