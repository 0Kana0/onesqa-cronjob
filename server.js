// server.js (CommonJS)
require("dotenv").config();

const http = require("http");
const path = require("path");
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const db = require("./db/models"); // ต้องมี db/models/index.js export sequelize + models
const { startDailyJobs } = require("./cron/dailyJob");

const PORT = Number(process.env.PORT || 5000);
const TZ = process.env.TZ || "Asia/Bangkok";

async function start() {
  const app = express();

  // สำหรับรันหลัง nginx/proxy
  app.set("trust proxy", 1);

  // CORS (ปรับ origin ตามจริงได้)
  const corsOrigin = process.env.CORS_ORIGIN || "*";
  app.use(
    cors({
      origin: corsOrigin === "*" ? true : corsOrigin.split(",").map((s) => s.trim()),
      credentials: true,
    })
  );

  app.use(cookieParser());
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

  // --- เชื่อมต่อ DB ---
  try {
    if (!db?.sequelize) throw new Error("db.sequelize not found (check ./db/models/index.js)");
    await db.sequelize.authenticate();
    console.log("✅ Database connected");
  } catch (err) {
    console.error("❌ Database connection failed:", err?.message || err);
    process.exit(1);
  }

  // --- เริ่ม Cron Jobs ---
  try {
    startDailyJobs();
    console.log("✅ Cron jobs started");
  } catch (err) {
    console.error("❌ Start cron jobs failed:", err?.message || err);
  }

  // --- Start HTTP Server ---
  const server = http.createServer(app);

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });

  // Graceful shutdown
  const shutdown = async (signal) => {
    console.log(`\n🛑 Received ${signal}, shutting down...`);
    server.close(async () => {
      try {
        await db.sequelize.close();
        console.log("✅ DB connection closed");
      } catch (e) {
        console.error("❌ Error closing DB:", e?.message || e);
      }
      process.exit(0);
    });
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

start();
