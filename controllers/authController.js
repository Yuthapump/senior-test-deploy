// authController.js
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { pool } = require("../config/db"); // เปลี่ยนเป็น pool

// register function
const register = async (req, res) => {
  console.log("Users Req Data: ", req.body);
  const { userName, email, password, phoneNumber, role, privacy } = req.body;

  if (!userName || !password) {
    return res
      .status(400)
      .json({ success: false, message: "Missing username or password" });
  }

  try {
    const connection = await pool.getConnection(); // Use pool to connect to the database

    // Check if user already exists
    const [existingUsers] = await connection.execute(
      "SELECT * FROM users WHERE username = ?",
      [userName]
    );

    if (existingUsers.length > 0) {
      connection.release(); // Release connection back to the pool
      return res
        .status(409)
        .json({ success: false, message: "User already exists" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert new user
    const [result] = await connection.execute(
      "INSERT INTO users (username, email, password, phoneNumber, role, privacy) VALUES (?, ?, ?, ?, ?, ?)",
      [userName, email, hashedPassword, phoneNumber, role, privacy]
    );

    const userId = result.insertId; // Get the newly inserted user's ID

    connection.release(); // Release connection back to the pool

    // Create JWT token
    const token = jwt.sign(
      {
        userId,
        userName,
        email,
        phoneNumber,
        role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "1h",
      }
    );

    return res.status(201).json({
      success: true,
      message: "Registration successful",
      token,
      userId,
      userName,
      email,
      phoneNumber,
      role,
    });
  } catch (error) {
    console.error("Error during registration:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// login function
const login = async (req, res) => {
  console.log("Login Data: ", req.body);
  const { userName, password } = req.body;

  if (!userName || !password) {
    return res
      .status(400)
      .json({ success: false, message: "Missing username or password" });
  }

  try {
    const connection = await pool.getConnection(); // ใช้ pool เพื่อเชื่อมต่อฐานข้อมูล

    // ดำเนินการค้นหาผู้ใช้
    const [results] = await connection.execute(
      "SELECT * FROM users WHERE userName = ?",
      [userName]
    );

    if (results.length === 0) {
      connection.release(); // คืน connection กลับไปที่ pool
      return res.status(401).json({
        success: false,
        message: "Invalid username or password",
      });
    }

    const user = results[0];
    console.log("User:", user); // ตรวจสอบข้อมูลของ user

    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      connection.release(); // คืน connection กลับไปที่ pool
      return res.status(401).json({
        success: false,
        message: "Invalid username or password",
      });
    }

    const token = jwt.sign(
      {
        userId: user.user_id,
        userName: user.userName,
        email: user.email,
        phoneNumber: user.phoneNumber,
        role: user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    connection.release(); // คืน connection กลับไปที่ pool

    return res.status(200).json({
      success: true,
      token,
      userId: user.user_id,
      userName: user.userName,
      email: user.email,
      phoneNumber: user.phoneNumber,
      role: user.role,
      message: "Login successful",
    });
  } catch (error) {
    console.error("Server error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = { register, login };
