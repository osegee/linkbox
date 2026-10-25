import IORedis from "ioredis";
import { env } from "./env";

const redisUrl = env.REDIS_URL || "redis://127.0.0.1:6379";

export const redisConnection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null, // BullMQ requires this setting to be null
});

redisConnection.on("connect", () => {
  console.log("Connected to local Redis successfully");
});

redisConnection.on("error", (err) => {
  console.error("Redis connection error:", err.message);
});