// assessmentController.js
const { pool } = require("../config/db");

// ฟังก์ชันสำหรับเพิ่มการประเมิน
const addAssessment = async (req, res) => {
  const { child_id, user_id, date, result } = req.body;

  try {
    const query = `
      INSERT INTO assessments (child_id, user_id, date, result)
      VALUES (?, ?, ?, ?)`;
    const [rows] = await pool.query(query, [child_id, user_id, date, result]);

    res.status(201).json({
      message: "Assessment added successfully",
      assessmentId: rows.insertId,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to add assessment" });
  }
};

// ฟังก์ชันสำหรับดึงการประเมินที่เด็กยังไม่ผ่าน โดยเรียงจากลำดับน้อยไปมาก
const getFailedAssessmentsByChild = async (req, res) => {
  const { child_id } = req.params;

  try {
    const query = `
      SELECT ad.id, ad.assessment_name, ad.result, ad.assessment_rank, a.child_id
      FROM assessment_details ad
      JOIN assessments a ON ad.assessment_id = a.id
      WHERE a.child_id = ? AND ad.result = 'Fail'
      ORDER BY ad.assessment_rank ASC`;

    const [results] = await pool.query(query, [child_id]);

    if (results.length > 0) {
      res.status(200).json(results);
    } else {
      res
        .status(404)
        .json({ message: "No failed assessments found for this child." });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to retrieve failed assessments" });
  }
};

// ฟังก์ชันสำหรับดึงรายละเอียดการประเมินทั้งหมดของเด็ก
const getAssessmentsByChild = async (req, res) => {
  const { child_id } = req.params;

  try {
    const query = `
      SELECT a.id, a.child_id, a.user_id, a.date, a.result, ad.assessment_name, ad.assessment_rank, ad.result as detail_result
      FROM assessments a
      JOIN assessment_details ad ON a.id = ad.assessment_id
      WHERE a.child_id = ?`;

    const [results] = await pool.query(query, [child_id]);

    if (results.length > 0) {
      res.status(200).json(results);
    } else {
      res.status(404).json({ message: "No assessments found for this child." });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to retrieve assessments" });
  }
};

// ฟังก์ชันสำหรับอัปเดตผลการประเมิน
const updateAssessmentResult = async (req, res) => {
  const { assessment_id } = req.params;
  const { result } = req.body;

  try {
    const query = `
      UPDATE assessment_details
      SET result = ?
      WHERE id = ?`;

    const [rows] = await pool.query(query, [result, assessment_id]);

    if (rows.affectedRows > 0) {
      res
        .status(200)
        .json({ message: "Assessment result updated successfully" });
    } else {
      res.status(404).json({ message: "Assessment not found" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to update assessment result" });
  }
};

module.exports = {
  addAssessment,
  getFailedAssessmentsByChild,
  getAssessmentsByChild,
  updateAssessmentResult,
};
