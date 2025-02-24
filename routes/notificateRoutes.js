// notificateRoute.js
const express = require("express");
const router = express.Router();

const {
  approveAccessRequest,
  getAllNotifications,
  saveExpoPushToken,
  markNotificationAsRead,
} = require("../controllers/notificateController");

// Route approveAccessRequest
router.post("/appprove-access-request", approveAccessRequest);

// Route getAllNotifications
router.get("/get-all-notificate", getAllNotifications);

// Route saveExpoPushToken
router.post("/save-push-token", saveExpoPushToken);

// Route markNotificationAsRead
router.post("/mark-notification-read", markNotificationAsRead);

module.exports = router;
