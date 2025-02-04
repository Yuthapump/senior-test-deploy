// authRoutes.js
const express = require("express");
const {
  register,
  login,
  forgetPassword,
  resetPassword,
} = require("../controllers/authController");

const router = express.Router();

// Route for Register
router.post("/register", register);

// Route for Login
router.post("/login", login);

// Route for Forget Password
router.post("/forget-password", forgetPassword);

// Route for Reset Password
router.post("/reset-password", resetPassword);

module.exports = router;
