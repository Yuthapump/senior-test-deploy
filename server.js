const express = require("express");
const multer = require("multer");
const cors = require("cors");
const authRuthes = require("./routes/authRoutes");
require("dotenv").config();
const { addChild } = require("./controllers/childController");

const app = express();
const port = process.env.PORT;

// Setup multer for handling multipart/form-data (file uploads)
const upload = multer({
  dest: "uploads/", // Directory to save uploaded files
  limits: { fileSize: 5 * 1024 * 1024 }, // Limit file size (5MB)
});

// Middleware
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:8081",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Middleware to parse JSON bodies
app.use(express.json());

// Routes
app.use("/api/auth", authRuthes);

// Route for adding a child
app.post("/api/auth/addChild", upload.single("childPic"), addChild);

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
