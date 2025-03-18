// assessmentRoutes.js
const express = require("express");
const router = express.Router();

const adminController = require("../controllers/adminController");

// Route User List
router.get("/get-user", adminController.user_list);

module.exports = router;
