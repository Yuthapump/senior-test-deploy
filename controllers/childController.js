// childController.js
const { pool } = require("../config/db"); // เปลี่ยนเป็น pool
const path = require("path");

// addChild function
const addChild = async (req, res) => {
  console.log("Child Data: ", req.body);
  if (!req.file) {
    console.error("File not received");
  } else {
    console.log("reqfile: ", req.file);
  }

  const { childName, nickname, birthday, gender, parent_id } = req.body;
  const childPic = req.file ? path.normalize(req.file.path) : null; // แปลงพาธไฟล์ให้เป็นรูปแบบสากล

  console.log("Req ChildPic: ", childPic);
  console.log("Uploaded file: ", req.file);

  if (!childName || !birthday || !parent_id) {
    return res.status(400).json({ message: "Required fields are missing" });
  }

  if (!childPic) {
    console.warn("No file uploaded");
  }

  try {
    const connection = await pool.getConnection(); // ใช้ pool เพื่อเชื่อมต่อ

    // Check if child already exists
    const [existingChild] = await connection.execute(
      "SELECT * FROM children WHERE childName = ? AND birthday = ? AND parent_id = ?",
      [childName, birthday, parent_id]
    );

    if (existingChild.length > 0) {
      connection.release(); // คืน connection กลับสู่ pool
      return res.status(409).json({ message: "Child already exists" });
    }

    // Insert new child data
    const [result] = await connection.execute(
      "INSERT INTO children (childName, nickname, birthday, gender, parent_id, childPic) VALUES (?, ?, ?, ?, ?, COALESCE(?, NULL))",
      [childName, nickname, birthday, gender, parent_id, childPic]
    );

    // Log child data
    console.log("Child Data inserted successfully: ", {
      childName,
      nickname,
      birthday,
      gender,
      parent_id,
      childPic,
      insertId: result.insertId,
    });

    connection.release(); // คืน connection กลับสู่ pool

    return res.status(201).json({
      message: "Child added successfully",
      childData: {
        childName,
        nickname,
        birthday,
        gender,
        parent_id,
        childPic,
        insertId: result.insertId,
      },
    });
  } catch (err) {
    console.error("Error inserting data:", err);
    return res.status(500).json({ message: "Error adding child" });
  }
};

// function to get child data
const getChildData = async (req, res) => {
  try {
    const { parent_id } = req.query;

    const connection = await pool.getConnection();

    // ตรวจสอบว่า parent_id
    if (!parent_id) {
      connection.release(); // คืน connection กลับสู่ pool
      return res.status(400).json({ message: "parent_id is required" });
    }

    // ดึงข้อมูลเด็กตาม parent_id
    const [children] = await connection.execute(
      "SELECT * FROM children WHERE parent_id = ?",
      [parent_id]
    );

    connection.release(); // คืน connection กลับสู่ pool

    // ตรวจสอบจำนวนข้อมูลเด็ก
    if (children.length === 0) {
      // คืนค่า 200 และ children เป็นอาร์เรย์ว่าง
      return res.status(200).json({ success: true, children: [] });
    }

    return res.status(200).json({ success: true, children });
  } catch (error) {
    console.error("Error fetching child data: ", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

module.exports = { addChild, getChildData };
