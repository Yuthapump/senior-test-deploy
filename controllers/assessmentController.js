// assessmentController.js
const { pool } = require("../config/db");

// ====================================================================================================================================================================================
// For Parent

const getAssessmentsByAspect = async (req, res) => {
  const { child_id, aspect, user_id, childAgeInMonths } = req.params;

  try {
    console.log("child_id: ", child_id);
    console.log("aspect: ", aspect);
    console.log("user_id: ", user_id);
    console.log("childAgeInMonths: ", childAgeInMonths);

    const ageInMonths = parseInt(childAgeInMonths, 10);
    const tableName = `assessment_details`;

    // ✅ ค้นหาการประเมินล่าสุดของเด็กใน aspect นี้
    const query = `
      SELECT a.assessment_id, a.assessment_date, ad.assessment_rank, a.status
      FROM assessments a
      JOIN ${tableName} ad ON a.assessment_details_id = ad.assessment_details_id
      WHERE a.child_id = ? AND ad.aspect = ?
      ORDER BY ad.assessment_rank DESC LIMIT 1
    `;
    const [rows] = await pool.query(query, [child_id, aspect]);

    // ✅ กรณีไม่มีการประเมินเลย → สร้างการประเมินใหม่
    if (rows.length === 0) {
      const defaultQuery = `
        SELECT assessment_details_id, aspect, assessment_rank, assessment_name, age_range
        FROM ${tableName}
        WHERE aspect = ?
        ORDER BY assessment_rank ASC
      `;
      const [defaultAssessments] = await pool.query(defaultQuery, [aspect]);

      const defaultAssessment = defaultAssessments.find((assessment) => {
        const [start, end] = assessment.age_range.split("-").map(Number);
        return ageInMonths >= start && ageInMonths <= end;
      });

      if (!defaultAssessment) {
        return res
          .status(404)
          .json({ error: "ไม่พบข้อมูลการประเมินสำหรับด้านที่ระบุ" });
      }

      const insertQuery = `
        INSERT INTO assessments (child_id, assessment_rank, aspect, status, user_id, assessment_details_id)
        VALUES (?, ?, ?, 'in_progress', ?, ?)
      `;
      const [result] = await pool.query(insertQuery, [
        child_id,
        defaultAssessment.assessment_rank,
        aspect,
        user_id,
        defaultAssessment.assessment_details_id,
      ]);

      const assessmentDetailsQuery = `
        SELECT * FROM ${tableName}
        WHERE assessment_rank = ? AND aspect = ?
      `;
      const [assessmentDetails] = await pool.query(assessmentDetailsQuery, [
        defaultAssessment.assessment_rank,
        aspect,
      ]);

      return res.status(201).json({
        message: "เริ่มต้นการประเมินใหม่",
        data: {
          assessment_id: result.insertId,
          child_id,
          assessment_rank: defaultAssessment.assessment_rank,
          aspect: defaultAssessment.aspect,
          assessment_name: defaultAssessment.assessment_name,
          status: "in_progress",
          assessment_date: new Date().toISOString(),
          details: assessmentDetails[0],
        },
      });
    }

    // ✅ กรณีมี `in_progress` → คืนค่าการประเมินปัจจุบัน
    const inProgressAssessments = rows.filter(
      (row) => row.status === "in_progress"
    );

    if (inProgressAssessments.length > 0) {
      const inProgressAssessment = inProgressAssessments
        .sort((a, b) => a.assessment_rank - b.assessment_rank)
        .pop();

      const assessmentDetailsQuery = `
        SELECT * FROM ${tableName}
        WHERE assessment_rank = ? AND aspect = ?
      `;
      const [assessmentDetails] = await pool.query(assessmentDetailsQuery, [
        inProgressAssessment.assessment_rank,
        aspect,
      ]);

      return res.status(200).json({
        message: "กำลังดำเนินการประเมิน",
        data: {
          assessment_id: inProgressAssessment.assessment_id,
          assessment_date: inProgressAssessment.assessment_date,
          ...inProgressAssessment,
          details: assessmentDetails[0],
        },
      });
    }

    // ✅ กรณีมี `passed_all` → ส่ง `assessmentDetails: null`
    const passedAllAssessments = rows.filter(
      (row) => row.status === "passed_all"
    );

    if (passedAllAssessments.length > 0) {
      return res.status(200).json({
        message: "การประเมินเสร็จสมบูรณ์สำหรับ aspect นี้",
        data: {
          assessment_id: null,
          child_id,
          aspect,
          assessment_rank: null,
          assessment_name: null,
          status: "passed_all",
          assessment_date: null,
          details: null,
        },
      });
    }

    return res.status(404).json({
      message: "ไม่พบการประเมินที่อยู่ในสถานะ 'in_progress' หรือ 'passed_all'",
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ error: "เกิดข้อผิดพลาดในการดึงข้อมูลการประเมิน" });
  }
};

const fetchNextAssessment = async (req, res) => {
  const { assessment_id, user_id } = req.body;
  const { child_id, aspect } = req.params;

  try {
    const updateQuery = `
      UPDATE assessments 
      SET status = 'passed'
      WHERE assessment_id = ? AND status = 'in_progress'`;

    const [updateResult] = await pool.query(updateQuery, [assessment_id]);

    if (updateResult.affectedRows === 0) {
      return res
        .status(404)
        .json({ message: "ไม่พบการประเมินหรือเสร็จสิ้นแล้ว" });
    }

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

    const rankQuery = `
      SELECT assessment_rank 
      FROM assessment_details 
      WHERE assessment_details_id = ?`;
    const [rankResult] = await pool.query(rankQuery, [assessmentDetailsId]);

    if (!rankResult.length) {
      return res.status(404).json({ message: "ไม่พบรายละเอียดการประเมิน" });
    }

    const assessmentRank = rankResult[0].assessment_rank;

    const nextAssessmentQuery = `
      SELECT ad.assessment_details_id AS assessment_detail_id, ad.aspect, ad.assessment_rank, ad.assessment_name
      FROM assessment_details ad
      WHERE ad.assessment_rank > ? AND ad.aspect = ?
      ORDER BY ad.assessment_rank ASC
      LIMIT 1`;

    const [nextAssessment] = await pool.query(nextAssessmentQuery, [
      assessmentRank,
      aspect,
    ]);

    if (nextAssessment.length > 0) {
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

      const assessmentDetailsQuery = `
        SELECT * FROM assessment_details
        WHERE assessment_rank = ? AND aspect = ?`;
      const [assessmentDetails] = await pool.query(assessmentDetailsQuery, [
        nextAssessment[0].assessment_rank,
        aspect,
      ]);

      return res.status(201).json({
        message: "สร้างและโหลดการประเมินถัดไปสำเร็จ",
        next_assessment: {
          assessment_id: result.insertId,
          child_id,
          user_id,
          assessment_rank: nextAssessment[0].assessment_rank,
          aspect: nextAssessment[0].aspect,
          assessment_name: nextAssessment[0].assessment_name,
          status: "in_progress",
          assessment_date: new Date().toISOString(),
          details: assessmentDetails[0],
        },
      });
    } else {
      const updateLastAssessmentQuery = `
        UPDATE assessments
        SET status = 'passed_all'
        WHERE assessment_id = ?`;

      await pool.query(updateLastAssessmentQuery, [assessment_id]);

      return res.status(200).json({
        message:
          "ผ่านการประเมินและไม่มีการประเมินเพิ่มเติมสำหรับ aspect นี้ (passed_all)",
        next_assessment: {
          assessment_id: null,
          child_id,
          user_id,
          assessment_rank: null,
          aspect,
          assessment_name: null,
          status: "passed_all",
          assessment_date: null,
          details: null, // ไม่ต้องส่งรายละเอียดเพราะไม่มี assessment ถัดไป
        },
      });
    }
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ error: "ไม่สามารถอัปเดตสถานะหรือดึงการประเมินถัดไปได้" });
  }
};

// ฟังก์ชันสำหรับดึงรายละเอียดการประเมินทั้งหมดของเด็ก
const getAssessmentsAllChild = async (req, res) => {
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

//
const getAssessmentsByChild = async (req, res) => {
  const { parent_id, child_id } = req.params;

  console.log("parent_id: ", parent_id);
  console.log("child_id: ", child_id);

  if (!parent_id || !child_id) {
    return res.status(400).json({
      message: "parent_id and child_id required",
    });
  }

  let connection;
  try {
    connection = await pool.getConnection();

    // ตรวจสอบว่าเด็กเป็นบุตรของ parent_id หรือไม่
    const [childRows] = await connection.execute(
      "SELECT * FROM children c JOIN parent_children pc ON c.child_id = pc.child_id WHERE c.child_id = ? AND pc.parent_id = ?",
      [child_id, parent_id]
    );

    if (childRows.length === 0) {
      return res.status(404).json({
        message: "ไม่พบข้อมูลเด็กสำหรับ parent_id ที่ระบุ",
      });
    }

    // ดึงข้อมูลการประเมินของเด็กที่มี status = 'in_progress'
    const [assessments] = await connection.execute(
      `SELECT a.assessment_id, a.assessment_rank, a.aspect, 
              a.assessment_details_id, a.assessment_date, a.status 
       FROM assessments a 
       WHERE a.child_id = ? AND a.status = 'in_progress'`,
      [child_id]
    );

    // ดึงรายละเอียดของ assessment_details จาก assessment_details_id
    for (let i = 0; i < assessments.length; i++) {
      const [details] = await connection.execute(
        `SELECT * FROM assessment_details WHERE assessment_details_id = ?`,
        [assessments[i].assessment_details_id]
      );
      assessments[i].details = details.length > 0 ? details[0] : null;
    }

    connection.release();

    if (assessments.length === 0) {
      return res.status(200).json({
        message: "ยังไม่มีการเริ่มต้นการประเมิน",
        parent_id,
        child: {
          child_id: childRows[0].child_id,
          firstName: childRows[0].firstName,
          lastName: childRows[0].lastName,
          nickName: childRows[0].nickName,
          birthday: childRows[0].birthday,
          gender: childRows[0].gender,
          childPic: childRows[0].childPic,
          assessments: [],
        },
      });
    }

    return res.status(200).json({
      message: "ดึงข้อมูลการประเมินของเด็กที่อยู่ในสถานะ 'in_progress' สำเร็จ",
      parent_id,
      child: {
        child_id: childRows[0].child_id,
        firstName: childRows[0].firstName,
        lastName: childRows[0].lastName,
        nickName: childRows[0].nickName,
        birthday: childRows[0].birthday,
        gender: childRows[0].gender,
        childPic: childRows[0].childPic,
        assessments: assessments,
      },
    });
  } catch (error) {
    console.error("Error fetching child assessment data:", error);
    return res.status(500).json({
      message: "เกิดข้อผิดพลาดในการดึงข้อมูลการประเมิน",
    });
  } finally {
    if (connection) connection.release();
  }
};

// Update assessment status to 'not_passed'
const updateAssessmentStatus = async (req, res) => {
  const { assessment_id } = req.body;
  const { child_id, aspect } = req.params;

  try {
    const updateQuery = `
      UPDATE assessments
      SET status = 'not_passed'
      WHERE assessment_id = ? AND status = 'in_progress'`;

    const [updateResult] = await pool.query(updateQuery, [assessment_id]);

    if (updateResult.affectedRows === 0) {
      return res.status(404).json({
        message: "Supervisor assessment not found or already completed",
      });
    }

    return res.status(200).json({
      message: "Supervisor assessment updated to 'not_passed' successfully",
      updated_assessment_id: assessment_id,
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "Failed to update supervisor assessment status" });
  }
};

// ====================================================================================================================================================================================
// For Supervisor

const getAssessmentsForSupervisor = async (req, res) => {
  const { child_id, aspect, supervisor_id, childAgeInMonths } = req.params;

  try {
    console.log("child_id: ", child_id);
    console.log("aspect: ", aspect);
    console.log("supervisor_id: ", supervisor_id);
    console.log("childAgeInMonths: ", childAgeInMonths);

    const ageInMonths = parseInt(childAgeInMonths, 10);
    const tableName = `assessment_details`;

    const query = `
      SELECT
        a.supervisor_assessment_id,
        a.assessment_date,
        ad.assessment_rank,
        a.status
      FROM assessment_supervisor a
      JOIN ${tableName} ad ON a.assessment_details_id = ad.assessment_details_id
      WHERE a.child_id = ? AND ad.aspect = ?
      ORDER BY ad.assessment_rank DESC LIMIT 1
    `;
    const [rows] = await pool.query(query, [child_id, aspect]);

    // ✅ กรณีไม่มี assessment → สร้าง assessment ใหม่
    if (rows.length === 0) {
      const defaultQuery = `
        SELECT assessment_details_id, aspect, assessment_rank, assessment_name, age_range
        FROM ${tableName}
        WHERE aspect = ?
        ORDER BY assessment_rank ASC
      `;
      const [defaultAssessments] = await pool.query(defaultQuery, [aspect]);

      const defaultAssessment = defaultAssessments.find((assessment) => {
        const [start, end] = assessment.age_range.split("-").map(Number);
        return ageInMonths >= start && ageInMonths <= end;
      });

      if (!defaultAssessment) {
        return res
          .status(404)
          .json({ error: "ไม่พบข้อมูลการประเมินสำหรับด้านที่ระบุ" });
      }

      const insertQuery = `
        INSERT INTO assessment_supervisor (child_id, assessment_rank, aspect, status, supervisor_id, assessment_details_id)
        VALUES (?, ?, ?, 'in_progress', ?, ?)
      `;
      const [result] = await pool.query(insertQuery, [
        child_id,
        defaultAssessment.assessment_rank,
        aspect,
        supervisor_id,
        defaultAssessment.assessment_details_id,
      ]);

      const assessmentDetailsQuery = `
        SELECT * FROM ${tableName}
        WHERE assessment_rank = ? AND aspect = ?
      `;
      const [assessmentDetails] = await pool.query(assessmentDetailsQuery, [
        defaultAssessment.assessment_rank,
        aspect,
      ]);

      return res.status(201).json({
        message: "เริ่มต้นการประเมินใหม่",
        data: {
          supervisor_assessment_id: result.insertId,
          child_id,
          assessment_rank: defaultAssessment.assessment_rank,
          aspect: defaultAssessment.aspect,
          assessment_name: defaultAssessment.assessment_name,
          status: "in_progress",
          assessment_date: new Date().toISOString(),
          details: assessmentDetails[0],
        },
      });
    }

    // ✅ กรณีมี `in_progress` → คืนค่าการประเมินปัจจุบัน
    const inProgressAssessments = rows.filter(
      (row) => row.status === "in_progress"
    );

    if (inProgressAssessments.length > 0) {
      const inProgressAssessment = inProgressAssessments
        .sort((a, b) => a.assessment_rank - b.assessment_rank)
        .pop();

      const assessmentDetailsQuery = `
        SELECT * FROM ${tableName}
        WHERE assessment_rank = ? AND aspect = ?
      `;
      const [assessmentDetails] = await pool.query(assessmentDetailsQuery, [
        inProgressAssessment.assessment_rank,
        aspect,
      ]);

      return res.status(200).json({
        message: "กำลังดำเนินการประเมิน",
        data: {
          assessment_id: inProgressAssessment.supervisor_assessment_id,
          assessment_date: inProgressAssessment.assessment_date,
          ...inProgressAssessment,
          details: assessmentDetails[0],
        },
      });
    }

    // ✅ กรณีมี `passed_all` → ส่ง `assessmentDetails: null`
    const passedAllAssessments = rows.filter(
      (row) => row.status === "passed_all"
    );

    if (passedAllAssessments.length > 0) {
      return res.status(200).json({
        message: "การประเมินเสร็จสมบูรณ์สำหรับ aspect นี้",
        data: {
          assessment_id: null,
          child_id,
          aspect,
          assessment_rank: null,
          assessment_name: null,
          status: "passed_all",
          assessment_date: null,
          details: null,
        },
      });
    }

    return res.status(404).json({
      message: "ไม่พบการประเมินที่อยู่ในสถานะ 'in_progress' หรือ 'passed_all'",
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ error: "เกิดข้อผิดพลาดในการดึงข้อมูลการประเมิน" });
  }
};

const updateSupervisorAssessment = async (req, res) => {
  const { supervisor_assessment_id } = req.body;
  const { child_id, aspect } = req.params;

  try {
    const updateQuery = `
      UPDATE assessment_supervisor
      SET status = 'not_passed'
      WHERE supervisor_assessment_id = ? AND status = 'in_progress'`;

    const [updateResult] = await pool.query(updateQuery, [
      supervisor_assessment_id,
    ]);

    if (updateResult.affectedRows === 0) {
      return res.status(404).json({
        message: "Supervisor assessment not found or already completed",
      });
    }

    return res.status(200).json({
      message: "Supervisor assessment updated to 'not_passed' successfully",
      updated_assessment_id: supervisor_assessment_id,
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "Failed to update supervisor assessment status" });
  }
};

const fetchNextAssessmentSupervisor = async (req, res) => {
  const { supervisor_assessment_id } = req.params;

  try {
    const updateQuery = `
      UPDATE assessment_supervisor
      SET status = 'passed'
      WHERE supervisor_assessment_id = ? AND status = 'in_progress'
    `;

    const [updateResult] = await pool.query(updateQuery, [
      supervisor_assessment_id,
    ]);

    if (updateResult.affectedRows === 0) {
      return res.status(404).json({
        message: "ไม่พบการประเมินหรือเสร็จสิ้นแล้ว",
      });
    }

    const nextAssessmentQuery = `
      SELECT ad.assessment_details_id AS assessment_detail_id, ad.aspect, ad.assessment_rank, ad.assessment_name
      FROM assessment_details ad
      WHERE ad.assessment_rank > (
        SELECT ad2.assessment_rank FROM assessment_supervisor asup
        JOIN assessment_details ad2 ON asup.assessment_details_id = ad2.assessment_details_id
        WHERE asup.supervisor_assessment_id = ?
      ) AND ad.aspect = (
        SELECT aspect FROM assessment_supervisor WHERE supervisor_assessment_id = ?
      )
      ORDER BY ad.assessment_rank ASC
      LIMIT 1
    `;

    const [nextAssessment] = await pool.query(nextAssessmentQuery, [
      supervisor_assessment_id,
      supervisor_assessment_id,
    ]);

    if (nextAssessment.length > 0) {
      return res.status(200).json({
        message: "พบการประเมินถัดไป",
        next_assessment: nextAssessment[0],
      });
    } else {
      const updateLastAssessmentQuery = `
        UPDATE assessment_supervisor
        SET status = 'passed_all'
        WHERE supervisor_assessment_id = ?
      `;

      await pool.query(updateLastAssessmentQuery, [supervisor_assessment_id]);

      return res.status(200).json({
        message:
          "ผ่านการประเมินและไม่มีการประเมินเพิ่มเติมสำหรับ aspect นี้ (passed_all)",
        next_assessment: {
          assessment_id: null,
          child_id: null,
          assessment_rank: null,
          aspect: null,
          assessment_name: null,
          status: "passed_all",
          assessment_date: null,
          details: null,
        },
      });
    }
  } catch (error) {
    console.error("Error fetching next assessment:", error);
    return res.status(500).json({ message: "Error fetching next assessment" });
  }
};

const getSupervisorAssessmentsAllData = async (req, res) => {
  const { supervisor_id } = req.params;

  try {
    const query = `
      SELECT 
        aspect,
        SUM(CASE WHEN status = 'passed' THEN 1 ELSE 0 END) AS passed_count,
        SUM(CASE WHEN status = 'not_passed' THEN 1 ELSE 0 END) AS not_passed_count
      FROM assessment_supervisor
      WHERE supervisor_id = ?
      GROUP BY aspect
      ORDER BY aspect ASC
    `;

    const [results] = await pool.query(query, [supervisor_id]);

    if (results.length === 0) {
      return res.status(200).json({
        message: "No assessments found for this supervisor.",
        data: [],
      });
    }

    res.status(200).json({
      message: "Supervisor assessments retrieved successfully.",
      data: results,
    });
  } catch (error) {
    console.error("Error fetching supervisor assessments:", error);
    res
      .status(500)
      .json({ error: "Failed to retrieve supervisor assessments" });
  }
};

module.exports = {
  getAssessmentsByAspect,
  getAssessmentsByChild,
  updateAssessmentStatus,
  fetchNextAssessment,
  getAssessmentsForSupervisor,
  updateSupervisorAssessment,
  fetchNextAssessmentSupervisor,
  getSupervisorAssessmentsAllData,
  getAssessmentsAllChild,
};
