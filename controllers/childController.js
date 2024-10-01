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
        nickName,
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

module.exports = { addChild };
