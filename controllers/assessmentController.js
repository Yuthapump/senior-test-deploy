// assessmentController.js
const { pool } = require("../config/db");

const getAssessmentsByAspect = async (req, res) => {
  const { child_id, aspect, user_id, childAgeInMonths } = req.params;

  try {
    console.log("child_id: ", child_id);
    console.log("aspect: ", aspect);
    console.log("user_id: ", user_id);
    console.log("childAgeInMonths: ", childAgeInMonths); // แสดงค่า childAgeInMonths ใน console

    // แปลง childAgeInMonths จากสตริงเป็นจำนวนเต็ม
    const ageInMonths = parseInt(childAgeInMonths, 10);

    // กำหนดชื่อตารางตาม aspect
    const tableName = `assessment_details`;

    // คำสั่ง SQL สำหรับดึงข้อมูลการประเมินที่มีอยู่สำหรับ child_id และ aspect ที่ระบุ
    const query = `
      SELECT
        a.assessment_id,
        a.assessment_date,
        ad.assessment_rank,
        a.status
      FROM assessments a
      JOIN ${tableName} ad ON a.assessment_details_id = ad.assessment_details_id
      WHERE a.child_id = ? AND ad.aspect = ?
      ORDER BY ad.assessment_rank DESC LIMIT 1
    `;
    const [rows] = await pool.query(query, [child_id, aspect]);

    if (rows.length === 0) {
      // ถ้ายังไม่มีการประเมิน จึงต้องสร้างการประเมินใหม่
      const defaultQuery = `
        SELECT 
          assessment_details_id,
          aspect,
          assessment_rank,
          assessment_name,
          age_range
        FROM ${tableName}
        WHERE aspect = ?
        ORDER BY assessment_rank ASC
      `;
      const [defaultAssessments] = await pool.query(defaultQuery, [aspect]);

      // หา assessment ที่มีช่วงอายุที่ตรงกับ ageInMonths
      const defaultAssessment = defaultAssessments.find((assessment) => {
        const [start, end] = assessment.age_range.split("-").map(Number);
        return ageInMonths >= start && ageInMonths <= end;
      });

      if (!defaultAssessment) {
        return res.status(404).json({
          error: "ไม่พบข้อมูลการประเมินสำหรับด้านที่ระบุ",
        });
      }

      // แทรกการประเมินใหม่โดยกำหนดสถานะเป็น 'in_progress' และ user_id
      const insertQuery = `
        INSERT INTO assessments (child_id, assessment_rank, aspect, status, user_id, assessment_details_id)
        VALUES (?, ?, ?, 'in_progress', ?, ?)
      `;
      const [result] = await pool.query(insertQuery, [
        child_id,
        defaultAssessment.assessment_rank,
        aspect,
        user_id,
        defaultAssessment.assessment_details_id, // เพิ่ม assessment_details_id จาก assessment_details
      ]);

      // ดึงรายละเอียดของการประเมินจาก assessment_details ตาม assessment_rank
      const assessmentDetailsQuery = `
        SELECT * FROM ${tableName}
        WHERE assessment_rank = ? AND aspect = ?
      `;
      const [assessmentDetails] = await pool.query(assessmentDetailsQuery, [
        defaultAssessment.assessment_rank,
        aspect,
      ]);

      return res.status(201).json({
        message:
          "การประเมินถูกตั้งค่าเป็นเริ่มต้นด้วยอันดับที่ใกล้เคียงกับอายุของเด็ก",
        data: {
          assessment_id: result.insertId,
          child_id: child_id,
          assessment_rank: defaultAssessment.assessment_rank,
          aspect: defaultAssessment.aspect,
          assessment_name: defaultAssessment.assessment_name,
          status: "in_progress",
          assessment_date: new Date().toISOString(),
          details: assessmentDetails[0], // ส่งรายละเอียดจาก assessment_details
        },
      });
    } else {
      // หากมีการประเมินอยู่แล้ว ตรวจสอบสถานะ 'in_progress'
      const inProgressAssessments = rows.filter(
        (row) => row.status === "in_progress"
      );

      if (inProgressAssessments.length > 0) {
        // คืนค่าการประเมินที่ยังอยู่ในสถานะ 'in_progress' และแสดงรายละเอียดการประเมิน
        const inProgressAssessment = inProgressAssessments
          .sort((a, b) => a.assessment_rank - b.assessment_rank)
          .pop();

        // ดึงรายละเอียดของการประเมินจาก assessment_details ตาม assessment_rank
        const assessmentDetailsQuery = `
          SELECT * FROM ${tableName}
          WHERE assessment_rank = ? AND aspect = ?
        `;
        const [assessmentDetails] = await pool.query(assessmentDetailsQuery, [
          inProgressAssessment.assessment_rank,
          aspect,
        ]);

        return res.status(200).json({
          message: "การประเมินอยู่ระหว่างดำเนินการ",
          data: {
            assessment_id: inProgressAssessment.assessment_id,
            assessment_date: inProgressAssessment.assessment_date,
            ...inProgressAssessment,
            details: assessmentDetails[0], // ส่งรายละเอียดจาก assessment_details
          },
        });
      }
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "เกิดข้อผิดพลาดในการดึงข้อมูลการประเมิน",
    });
  }
};

const fetchNextAssessment = async (req, res) => {
  const { assessment_id, user_id } = req.body; // รับ assessment_id และ user_id จาก frontend
  const { child_id, aspect } = req.params; // รับ child_id และ aspect จาก URL

  try {
    // อัปเดตสถานะของการประเมินที่กำลังอยู่ในสถานะ 'in_progress' เป็น 'passed'
    const updateQuery = `
      UPDATE assessments 
      SET status = 'passed'
      WHERE assessment_id = ? AND status = 'in_progress'`;

    const [updateResult] = await pool.query(updateQuery, [assessment_id]);

    if (updateResult.affectedRows === 0) {
      // ถ้าไม่มีการอัปเดต (อาจเป็นเพราะสถานะไม่ใช่ 'in_progress')
      return res
        .status(404)
        .json({ message: "ไม่พบการประเมินหรือการประเมินเสร็จสิ้นแล้ว" });
    }

    // ดึง assessment_details_id จากตาราง assessments
    const getAssessmentDetailsIdQuery = `
      SELECT assessment_details_id 
      FROM assessments 
      WHERE assessment_id = ?`;
    const [assessmentDetailsIdResult] = await pool.query(
      getAssessmentDetailsIdQuery,
      [assessment_id]
    );

    if (!assessmentDetailsIdResult.length) {
      return res.status(404).json({
        message: "ไม่พบ assessment_details_id สำหรับ assessment_id นี้",
      });
    }

    const assessmentDetailsId =
      assessmentDetailsIdResult[0].assessment_details_id;

    // ดึง assessment_rank จากตาราง assessment_details_${aspect}
    const rankQuery = `
      SELECT assessment_rank 
      FROM assessment_details_${aspect.toLowerCase()} 
      WHERE assessment_details_id = ?`;
    const [rankResult] = await pool.query(rankQuery, [assessmentDetailsId]);

    if (!rankResult.length) {
      return res.status(404).json({
        message: "ไม่พบรายละเอียดการประเมินสำหรับ assessment_details_id นี้",
      });
    }

    const assessmentRank = rankResult[0].assessment_rank;
    console.log("Current assessment_rank:", assessmentRank);

    // ค้นหาการประเมินถัดไป
    const nextAssessmentQuery = `
      SELECT ad.assessment_details_id AS assessment_detail_id, ad.aspect, ad.assessment_rank, ad.assessment_name
      FROM assessment_details_${aspect.toLowerCase()} ad
      WHERE ad.assessment_rank > ?
      ORDER BY ad.assessment_rank ASC
      LIMIT 1`;

    const [nextAssessment] = await pool.query(nextAssessmentQuery, [
      assessmentRank,
    ]);

    console.log("Next assessment:", nextAssessment);

    if (nextAssessment.length > 0) {
      // ถ้ามีการประเมินถัดไป
      const insertQuery = `
        INSERT INTO assessments (child_id, assessment_details_id, assessment_rank, aspect, status, user_id)
        VALUES (?, ?, ?, ?, 'in_progress', ?)`;
      const [result] = await pool.query(insertQuery, [
        child_id,
        nextAssessment[0].assessment_detail_id,
        nextAssessment[0].assessment_rank,
        aspect,
        user_id,
      ]);

      // ดึงรายละเอียดของการประเมินจาก assessment_details ตาม assessment_rank
      const assessmentDetailsQuery = `
        SELECT * FROM assessment_details_${aspect.toLowerCase()}
        WHERE assessment_rank = ? AND aspect = ?
      `;
      const [assessmentDetails] = await pool.query(assessmentDetailsQuery, [
        nextAssessment[0].assessment_rank,
        aspect,
      ]);

      return res.status(201).json({
        message: "สร้างและโหลดการประเมินถัดไปสำเร็จ",
        next_assessment: {
          assessment_id: result.insertId,
          child_id: child_id,
          user_id: user_id,
          assessment_rank: nextAssessment[0].assessment_rank,
          aspect: nextAssessment[0].aspect,
          assessment_name: nextAssessment[0].assessment_name,
          status: "in_progress",
          assessment_date: new Date().toISOString(),
          details: assessmentDetails[0], // ส่งรายละเอียดจาก assessment_details
        },
      });
    } else {
      // ถ้าไม่มีการประเมินถัดไป
      return res.status(200).json({
        message: "ผ่านการประเมินและไม่มีการประเมินเพิ่มเติมสำหรับ aspect นี้",
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "ไม่สามารถอัปเดตสถานะหรือดึงการประเมินถัดไปได้",
    });
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
        c.childName AS child_name, -- ชื่อเด็ก
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
  fetchNextAssessment,
};
