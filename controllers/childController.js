const { connectDB } = require("../config/db");

// addChild function
const addChild = async (req, res) => {
  console.log("Child Data: ", req.body);
  const { childName, nickName, birthday, gender, parent_id } = req.body;
  const childPic = req.file ? req.file.path : null; // Get file path

  if (!childName || !birthday || !parent_id) {
    return res.status(400).json({ message: "Required fields are missing" });
  }

  try {
    const connection = await connectDB();

    // Check if child already exists
    const [existingChild] = await connection.execute(
      "SELECT * FROM children WHERE childName = ? AND birthday = ? AND parent_id = ?",
      [childName, birthday, parent_id]
    );

    if (existingChild.length > 0) {
      return res.status(409).json({ message: "Child already exists" });
    }

    // Insert new child data
    const [result] = await connection.execute(
      "INSERT INTO children (childName, nickName, birthday, gender, parent_id, childPic) VALUES (?, ?, ?, ?, ?, ?)",
      [childName, nickName, birthday, gender, parent_id, childPic]
    );

    // Log child data
    console.log("Child Data inserted successfully: ", {
      childName,
      nickName,
      birthday,
      gender,
      parent_id,
      childPic,
      insertId: result.insertId,
    });

    return res.status(201).json({ message: "Child added successfully" });
  } catch (err) {
    console.error("Error inserting data:", err);
    return res.status(500).json({ message: "Error adding child" });
  }
};

module.exports = { addChild };
