const bcrypt = require("bcryptjs");
const express = require("express");
const jwt = require("jsonwebtoken");
const { connectDB } = require("../config/db");
const path = require("path");
const fs = require("fs");
const multer = require("multer");

const app = express();
const connection = connectDB(); // connect to DB

// register function
const register = async (req, res) => {
  const { userName, email, password, phoneNumber, role, privacy } = req.body;

  if (!userName || !password) {
    return res
      .status(400)
      .json({ success: false, message: "Missing username or password" });
  }

  try {
    const connection = await connectDB(); // ใช้ async/await เพื่อรอการเชื่อมต่อฐานข้อมูล

    // ตรวจสอบผู้ใช้ที่มีอยู่แล้ว
    const [existingUsers] = await connection.execute(
      "SELECT * FROM users WHERE username = ?",
      [userName]
    );

    if (existingUsers.length > 0) {
      return res
        .status(409)
        .json({ success: false, message: "User already exists" });
    }

    // เข้ารหัสรหัสผ่าน
    const hashedPassword = await bcrypt.hash(password, 10);

    // เพิ่มผู้ใช้ใหม่
    await connection.execute(
      "INSERT INTO users (username, email, password, phoneNumber, role, privacy) VALUES (?, ?, ?, ?, ?, ?)",
      [userName, email, hashedPassword, phoneNumber, role, privacy]
    );

    // สร้าง JWT token
    const token = jwt.sign({ userName, role }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    return res.status(201).json({
      success: true,
      message: "Registration successful",
      token,
      role,
    });
  } catch (error) {
    console.error("Error during registration:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// login function
const login = async (req, res) => {
  const { userName, password } = req.body;

  if (!userName || !password) {
    return res
      .status(400)
      .json({ success: false, message: "Missing username or password" });
  }

  try {
    connection.execute(
      "SELECT * FROM users WHERE userName = ?",
      [userName],
      async (err, results) => {
        if (err) {
          return res
            .status(500)
            .json({ success: false, message: "Server error" });
        }

        if (results.length > 0) {
          const user = results[0];
          console.log("User:", user); // ตรวจสอบข้อมูลของ user
          const match = await bcrypt.compare(password, user.password);

          if (match) {
            if (user.role) {
              const token = jwt.sign(
                { userId: user.id, role: user.role },
                process.env.JWT_SECRET,
                {
                  expiresIn: "1h",
                }
              );
              return res.status(200).json({
                success: true,
                token,
                userId: user.id,
                role: user.role,
                message: "Login successful",
              });
            } else {
              return res.status(401).json({
                success: false,
                message: "Invalid username or password",
              });
            }
          }
        } else {
          return res
            .status(401)
            .json({ success: false, message: "Invalid username or password" });
        }
      }
    );
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// AddChild function with file handling
const addChild = async (req, res) => {
  const { childName, nickname, birthday, gender, parent_id } = req.body;
  const childPic = req.file;

  if (!childName || !birthday || !parent_id) {
    return res.status(400).json({ message: "Required fields are missing" });
  }

  try {
    const connection = await connectDB(); // ใช้การเชื่อมต่อฐานข้อมูล

    // ตรวจสอบว่ามีเด็กในระบบแล้วหรือไม่
    const [existingChild] = await connection.execute(
      "SELECT * FROM children WHERE childName = ? AND birthday = ? AND parent_id = ?",
      [childName, birthday, parent_id]
    );

    if (existingChild.length > 0) {
      return res.status(409).json({ message: "Child already exists" });
    }

    // เพิ่มข้อมูลเด็กใหม่
    await connection.execute(
      "INSERT INTO children (childName, nickname, birthday, gender, parent_id) VALUES (?, ?, ?, ?, ?)",
      [childName, nickname, birthday, gender, parent_id]
    );

    return res.status(201).json({ message: "Child added successfully" });
  } catch (err) {
    console.error("Error inserting data:", err);
    return res.status(500).json({ message: "Error adding child" });
  }
};

// Apply multer middleware to handle file uploads, allow requests without file
const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 5 * 1024 * 1024 }, // Limit file size (5MB)
});

// Apply multer to addChild route
app.post("/api/auth/addChild", upload.single("childPic"), addChild);

module.exports = { register, login, addChild };
