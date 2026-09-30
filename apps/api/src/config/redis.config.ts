import { registerAs } from "@nestjs/config";

export default registerAs("redis", () => {
  // Use REDIS_URL if provided, otherwise fall back to individual components
  if (process.env.REDIS_URL) {
    return { url: process.env.REDIS_URL };
  }

  return {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379", 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || "0", 10),
  };
});

export const queueConfig = registerAs("queue", () => ({
  redis: process.env.REDIS_URL || {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379", 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },
}));
