import Redis from "ioredis";
import "dotenv/config";

export const redis = new Redis({
  host: process.env.REDIS_HOST || "localhost",
  port: Number(process.env.REDIS_PORT || 6379),
  username: process.env.REDIS_USERNAME || undefined,
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: 3,
  connectTimeout: 10000,
});

redis.on("connect", () => {
  console.log("Redis Connected");
});

redis.on("error", (err) => {
  console.error("Redis Error:", err.message || err);
});

export const initializeRedis = async () => {
  await redis.ping();
  console.log("Redis connection check passed");
  return redis;
};

export default redis;