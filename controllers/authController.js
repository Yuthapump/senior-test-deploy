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
  console.log("Request Body:", req.body);
  const { userName, email, password, phoneNumber, role, privacy } = req.body;

  // check data
  if (!userName || !password) {
    return res
      .status(400)
      .json({ success: false, message: "Missing username or password" });
  }

  try {
    // check existingUsers
    const existingUsers = await new Promise((resolve, reject) => {
      connection.query(
        "SELECT * FROM users WHERE username = ?", // เปลี่ยน userName เป็น username เพื่อให้ตรงกับชื่อคอลัมน์
        [userName],
        (err, results) => {
          if (err) return reject(err);
          resolve(results);
        }
      );
    });

    console.log("Existing users:", existingUsers); // เพิ่มการพิมพ์ผลลัพธ์

    if (Array.isArray(existingUsers) && existingUsers.length > 0) {
      return res
        .status(409)
        .json({ success: false, message: "User already exists" });
    }

    // hashedPassword
    const hashedPassword = await bcrypt.hash(password, 10);

    // Add new user
    await new Promise((resolve, reject) => {
      connection.query(
        "INSERT INTO users (username, email, password, phoneNumber, role, privacy) VALUES (?, ?, ?, ?, ?, ?)",
        [userName, email, hashedPassword, phoneNumber, role, privacy],
        (err) => {
          if (err) return reject(err);
          resolve();
        }
      );
    });
    // Generate JWT token
    const token = jwt.sign({ userName, role }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    // Return success response with the token
    return res.status(201).json({
      success: true,
      message: "Registration successful",
      token, // include the generated token in the response
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
    connection.query(
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
  console.log("Request Body:", req.body);
  console.log("Uploaded File:", req.file);
  const { childName, nickname, birthday, gender, parent_id } = req.body;
  const childPic = req.file; // File from multer, may be undefined if no file is uploaded

  // Basic input validation
  if (!childName || !birthday || !parent_id) {
    return res.status(400).json({ message: "Required fields are missing" });
  }

  // Check if the child already exists
  const checkQuery =
    "SELECT * FROM children WHERE childName = ? AND birthday = ? AND parent_id = ?";
  try {
    const [existingChild] = await db.query(checkQuery, [
      childName,
      birthday,
      parent_id,
    ]);

    if (existingChild.length > 0) {
      return res.status(409).json({ message: "Child already exists" });
    }

    // Handle file upload (if provided)
    let childPicUrl = null;
    if (childPic) {
      // Save file to a directory or cloud storage
      const filePath = path.join(__dirname, "uploads", childPic.filename);
      fs.renameSync(childPic.path, filePath); // Move file to correct location
      childPicUrl = filePath; // Save file path or URL to the database
    }

    // Insert new child record
    const insertQuery =
      "INSERT INTO children (childName, nickname, birthday, gender, parent_id) VALUES ( ?, ?, ?, ?, ?)";
    await connection.query(insertQuery, [
      childName,
      nickname,
      birthday,
      gender,
      parent_id,
      //childPicUrl, // Insert file path or URL, or null if no file
    ]);

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
