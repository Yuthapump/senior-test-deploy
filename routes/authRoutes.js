// authRoutes.js
const express = require("express");
const { register, login } = require("../controllers/authController");
//const { validateRegister, validateLogin } = require("../middleware/validation");

const router = express.Router();

// Route for Register
router.post("/register", register);

// Route for Login
router.post("/login", login);

// Route for AddChild
//router.post("/addChild", addChild);

module.exports = router;
