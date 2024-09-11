const express = require("express");
const { register, login, addChild } = require("../controllers/authController");

const router = express.Router();

// Route for Register
router.post("/register", register);

// Route for Login
router.post("/login", login);

// Route for AddChild
router.post("/addChild", addChild);

module.exports = router;
