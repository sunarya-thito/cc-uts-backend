import { Pool } from "pg"

// Create a connection pool to the PostgreSQL database on RDS
export const db = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: Number.parseInt(process.env.DB_PORT || "5432"),
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
})

// Test the database connection
db.connect((err, client, release) => {
  if (err) {
    return
  }
  release()
})

// Export the query method for convenience
export const query = (text: string, params?: any[]) => db.query(text, params)
