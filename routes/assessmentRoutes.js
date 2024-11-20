// assessmentRoutes.js
const express = require("express");
const router = express.Router();
const assessmentController = require("../controllers/assessmentCotroller");
const {
  addAssessmentDetail,
  upload,
} = require("../controllers/assessmentDetailController");

router.post(
  "/assessment-details",
  upload.fields([
    { name: "assessment_image", maxCount: 1 },
    { name: "assessment_device_image", maxCount: 1 },
  ]),
  addAssessmentDetail
);

router.post("/addAssessments", assessmentController.addAssessment);

router.get(
  "/assessments-get-child/:child_id/failures",
  assessmentController.getFailedAssessmentsByChild
);

router.get(
  "/assessments-child/:child_id",
  assessmentController.getAssessmentsByChild
);

router.put(
  "/assessments-update/:assessment_id",
  assessmentController.updateAssessmentResult
);

module.exports = router;
