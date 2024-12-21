// assessmentController.js
const { pool } = require("../config/db");

const getAssessmentsByAspect = async (req, res) => {
  const { child_id, aspect } = req.params;

  try {
    // ดึงข้อมูลการประเมินทั้งหมดสำหรับ child_id และ aspect ที่ระบุ
    const query = `
      SELECT 
        a.id AS assessment_id,
        ad.assessment_rank,
        ad.assessment_name,
        a.status
      FROM assessments a
      JOIN assessment_details ad ON a.assessment_rank = ad.assessment_rank
      WHERE a.child_id = ? AND ad.aspect = ?
      ORDER BY ad.assessment_rank ASC
    `;

    const [rows] = await pool.query(query, [child_id, aspect]);

    if (rows.length === 0) {
      // ถ้าไม่มีการประเมินสำหรับ aspect นี้ ให้เพิ่มการประเมิน rank 1 และตั้งสถานะเป็น 'in_progress'
      const defaultQuery = `
        SELECT 
          id AS assessment_detail_id,
          aspect,
          assessment_rank,
          assessment_name
        FROM assessment_details
        WHERE aspect = ?
        ORDER BY assessment_rank ASC
        LIMIT 1
      `;

      const [defaultAssessment] = await pool.query(defaultQuery, [aspect]);

      if (defaultAssessment.length === 0) {
        return res.status(404).json({
          error: "No assessment details found for the specified aspect.",
        });
      }

      // เพิ่มข้อมูลการประเมินใหม่ใน assessments โดยตั้งค่า status เป็น 'in_progress'
      const insertQuery = `
        INSERT INTO assessments (child_id, assessment_rank, aspect, status)
        VALUES (?, ?, ?, 'in_progress')
      `;

      const [result] = await pool.query(insertQuery, [
        child_id,
        defaultAssessment[0].assessment_rank,
        aspect,
      ]);

      return res.status(201).json({
        message: "Assessment initialized with rank 1",
        data: {
          assessment_id: result.insertId,
          child_id: child_id,
          assessment_rank: defaultAssessment[0].assessment_rank,
          aspect: defaultAssessment[0].aspect,
          status: "in_progress", // ตั้งค่าตัวสถานะเป็น 'in_progress'
          assessment_date: new Date().toISOString(),
        },
      });
    } else {
      // ถ้ามีการประเมินให้เช็คสถานะ
      const inProgressAssessments = rows.filter(
        (row) => row.status === "in_progress"
      );

      if (inProgressAssessments.length > 0) {
        // ถ้ามีการประเมินที่สถานะ 'in_progress' ให้ส่งข้อมูลที่ล่าสุด
        const inProgressAssessment = inProgressAssessments
          .sort((a, b) => a.assessment_rank - b.assessment_rank)
          .pop();
        return res.status(200).json({
          message: "Assessment in progress",
          data: inProgressAssessment,
        });
      } else {
        // ถ้าทุกการประเมินผ่าน
        return res.status(200).json({
          message: "All assessments completed",
          data: rows,
        });
      }
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to retrieve assessments" });
  }
};

// ฟังก์ชันสำหรับดึงรายละเอียดการประเมินทั้งหมดของเด็ก
const getAssessmentsByChild = async (req, res) => {
  const { child_id } = req.params;

  // Validate child_id
  if (!Number.isInteger(Number(child_id))) {
    return res.status(400).json({ error: "Invalid child ID provided." });
  }

  try {
    const query = `
      SELECT 
        a.id AS assessment_id,
        c.child_name AS child_name, -- ชื่อเด็ก
        a.child_id AS child_id,
        a.user_id AS evaluator_id,
        u.username AS evaluator_name, -- ชื่อผู้ประเมิน
        a.aspect AS aspect_name,
        a.assessment_rank AS aspect_rank,
        a.assessment_date AS assessment_date,
        a.status AS status
      FROM assessments a
      JOIN children c ON a.child_id = c.child_id
      JOIN users u ON a.user_id = u.user_id
      WHERE a.child_id = ?`;

    const [results] = await pool.query(query, [child_id]);

    if (results.length === 0) {
      return res
        .status(200)
        .json({ message: "No assessments found.", data: [] });
    }

    res
      .status(200)
      .json({ message: "Assessments retrieved successfully.", data: results });
  } catch (error) {
    console.error("Error fetching assessments:", error);
    res.status(500).json({ error: "Failed to retrieve assessments" });
  }
};

// ฟังก์ชันสำหรับอัปเดตผลการประเมินจาก 'in_progress' เป็น 'passed' และดึงรายละเอียดการประเมินถัดไป
const updateAssessmentStatus = async (req, res) => {
  const { assessment_id, result } = req.body; // รับ assessment_id และผลลัพธ์จาก frontend
  const { child_id, aspect } = req.params; // รับ child_id และ aspect จาก URL

  try {
    // อัปเดตสถานะของการประเมินที่กำลังอยู่ในสถานะ 'in_progress' เป็น 'passed'
    const updateQuery = `
      UPDATE assessments 
      SET status = 'passed', result = ?
      WHERE id = ? AND status = 'in_progress'`;

    const [updateResult] = await pool.query(updateQuery, [
      result,
      assessment_id,
    ]);

    if (updateResult.affectedRows === 0) {
      // ถ้าไม่มีการอัปเดต (อาจเป็นเพราะสถานะไม่ใช่ 'in_progress')
      return res
        .status(404)
        .json({ message: "Assessment not found or already completed" });
    }

    // ค้นหาการประเมินถัดไปที่ต้องทำสำหรับ aspect นี้
    const nextAssessmentQuery = `
      SELECT ad.id AS assessment_detail_id, ad.aspect, ad.assessment_rank, ad.assessment_name
      FROM assessment_details ad
      WHERE ad.aspect = ? AND ad.assessment_rank > (SELECT assessment_rank FROM assessment_details WHERE id = ?)
      ORDER BY ad.assessment_rank ASC
      LIMIT 1`;

    const [nextAssessment] = await pool.query(nextAssessmentQuery, [
      aspect,
      assessment_id,
    ]);

    if (nextAssessment.length > 0) {
      // ถ้ามีการประเมินถัดไป
      return res.status(200).json({
        message: "Assessment passed and next assessment loaded",
        next_assessment: nextAssessment[0],
      });
    } else {
      // ถ้าไม่มีการประเมินถัดไป
      return res.status(200).json({
        message: "Assessment passed and no more assessments for this aspect",
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Failed to update assessment status or fetch next assessment",
    });
  }
};

module.exports = {
  getAssessmentsByAspect,
  getAssessmentsByChild,
  updateAssessmentStatus,
};
