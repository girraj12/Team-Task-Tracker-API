import "dotenv/config";
import express from "express";
import cors from "cors";
import { checkDatabaseConnection } from "./config/db.js";
import { initializeRedis } from "./config/redis.js";

const port = process.env.PORT || 3000;

const startServer = async () => {
  try {
    await Promise.all([
      checkDatabaseConnection(),
      initializeRedis()
    ]);

    const app = express();
    app.use(cors({ origin: "*" }));
    app.use(express.json());

    app.get("/health", (req, res) => {
      res.status(200).json({
        status: "ok",
        message: "Team Task Tracker API is running"
      });
    });

    app.listen(port, () => {
      console.log(`Team Task Tracker API running on PORT ${port}`);
    });
  } catch (error) {
    console.error("Server startup failed:", error.message);
    process.exit(1);
  }
};

startServer();