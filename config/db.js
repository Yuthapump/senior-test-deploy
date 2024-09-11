const mysql = require("mysql2/promise");
require("dotenv").config();

// เชื่อมต่อกับฐานข้อมูล MySQL
const connectDB = () => {
  /*const connection = mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    connectTimeout: 10000, // for Test
  });*/

  const connection = mysql.createConnection(process.env.DB_URL);

  connection.connect((err) => {
    if (err) {
      console.error("Error connecting to MySQL:", err);
      process.exit(1); // ออกจากโปรแกรมเมื่อเกิดข้อผิดพลาดในการเชื่อมต่อ
    }
    console.log("Connected to MySQL");
  });

  return connection;
};

module.exports = { connectDB };
