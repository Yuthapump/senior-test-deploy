// assessmentRoutes.js
const express = require("express");
const router = express.Router();

const assessmentController = require("../controllers/assessmentController");

// const { protect, restrictTo } = require("../controllers/authController");

// Route to fetch assessment details by child_id and aspect
router.get(
  "/assessments-get-details/:child_id/:aspect/:user_id/:childAgeInMonths",
  assessmentController.getAssessmentsByAspect
);

// Route to update assessments by assessment_id
("/assessments-next/:child_id");

// Route to fetch the next assessment for a child
router.get(
  "/assessments-next/:child_id",
  assessmentController.fetchNextAssessment
);
router.get(
  "/assessments-child/:child_id",
  assessmentController.getAssessmentsByChild
);

// Route to update an assessment result and get next assessment
router.post(
  "/assessments-update-status/:child_id/:aspect",
  assessmentController.updateAssessmentStatus
);

module.exports = router;
