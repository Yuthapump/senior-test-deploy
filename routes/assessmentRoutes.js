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

// Route to fetch the next assessment for a child
router.post(
  "/assessments-next/:child_id/:aspect",
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
