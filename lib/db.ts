import mysql from "mysql2/promise";

// Create a connection pool to the MySQL database
export const db = mysql.createPool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: Number.parseInt(process.env.DB_PORT || "3306"),
  waitForConnections: true,
  connectionLimit: 10, // You can adjust pool size
  queueLimit: 0,
  // ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
});

// Test the database connection
(async () => {
  try {
    console.log("Connecting to MySQL...");
    const connection = await db.getConnection();
    console.log("MySQL connection successful");
    connection.release();
  } catch (err) {
    console.error("MySQL connection error:", err);
  }
})();