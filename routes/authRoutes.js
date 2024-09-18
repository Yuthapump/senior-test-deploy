// authRoutes.js
const express = require("express");
const { register, login } = require("../controllers/authController");

const router = express.Router();

// Route for Register
router.post("/register", register);

// Route for Login
router.post("/login", login);

module.exports = router;
