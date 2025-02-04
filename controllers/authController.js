// authController.js
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { pool } = require("../config/db");
const crypto = require("crypto");
const nodemailer = require("nodemailer");

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
      "SELECT * FROM users WHERE LOWER(userName) = LOWER(?)",
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

    // for logging
    console.log("Login successful");
    console.log("User:", user);
    console.log("Token:", token);

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

//  Forget Password
const forgetPassword = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, message: "Missing email" });
  }

  try {
    const connection = await pool.getConnection();

    // ตรวจสอบว่าอีเมลมีอยู่ในระบบหรือไม่
    const [users] = await connection.execute(
      "SELECT user_id, userName FROM users WHERE email = ?",
      [email]
    );

    if (users.length === 0) {
      connection.release();
      return res
        .status(404)
        .json({ success: false, message: "Email not found" });
    }

    const user = users[0];

    // สร้างโทเค็นสำหรับรีเซ็ตรหัสผ่าน
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenExpire = new Date(Date.now() + 60 * 60 * 1000); // ✅ หมดอายุใน 1 ชั่วโมง

    // บันทึก Token ลงในฐานข้อมูล
    await connection.execute(
      "UPDATE users SET reset_token = ?, reset_token_expire = ? WHERE user_id = ?",
      [resetToken, resetTokenExpire, user.user_id]
    );

    connection.release();

    // ส่งอีเมลรีเซ็ตรหัสผ่าน
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const resetLink = `https://senior-test-deploy-production-1362.up.railway.app/api/auth/reset-password?token=${resetToken}`;
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Reset Your Password",
      text: `Hello ${user.userName},\n\nYou requested to reset your password. Click the link below:\n${resetLink}\n\nThis link is valid for 1 hour.`,
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({
      success: true,
      message: "Reset password email sent successfully",
    });
  } catch (error) {
    console.error("Error in forgot password:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ฟังก์ชัน Reset Password
const resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res
      .status(400)
      .json({ success: false, message: "Missing token or new password" });
  }

  try {
    const connection = await pool.getConnection();

    // ✅ ตรวจสอบว่า Token ยังไม่หมดอายุ
    const [users] = await connection.execute(
      "SELECT user_id FROM users WHERE reset_token = ? AND reset_token_expire > NOW()",
      [token]
    );

    if (users.length === 0) {
      connection.release();
      return res
        .status(400)
        .json({ success: false, message: "Invalid or expired token" });
    }

    const user = users[0];

    // ✅ เข้ารหัสรหัสผ่านใหม่
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // ✅ อัปเดตรหัสผ่านใหม่ และล้าง Token
    await connection.execute(
      "UPDATE users SET password = ?, reset_token = NULL, reset_token_expire = NULL WHERE user_id = ?",
      [hashedPassword, user.user_id]
    );

    connection.release();

    res
      .status(200)
      .json({ success: true, message: "Password reset successfully" });
  } catch (error) {
    console.error("Error in reset password:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = { register, login, forgetPassword, resetPassword };
