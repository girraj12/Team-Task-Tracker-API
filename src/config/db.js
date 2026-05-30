import "dotenv/config";
import mysql from "mysql2/promise";

export const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

export const checkDatabaseConnection = async () => {
  try {
    const connection = await pool.getConnection();

    await connection.ping();

    console.log("Database connection established");

    connection.release();

    return true;
  } catch (error) {
    console.error("Database connection failed:", error.message);
    throw error;
  }
};

export const read = async (query, params = {}) => {
  const [rows] = await pool.execute(query, params);
  return rows;
};

export const write = async (query, params = {}) => {
  const [result] = await pool.execute(query, params);
  return result;
};
