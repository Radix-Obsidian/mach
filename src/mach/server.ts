import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { webhookRouter } from "./routes/webhook.js";
import { healthRouter } from "./routes/health.js";
import { missionsRouter } from "./routes/missions.js";
import { startPollingMode } from "./worker.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(express.json());

// CORS for local dev (Vite runs on a different port)
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

// Request logging
app.use((req, _res, next) => {
  if (req.path.startsWith("/api")) {
    console.log(`[Mach] ${req.method} ${req.path}`);
  }
  next();
});

// API routes
app.use("/api", webhookRouter);
app.use("/api", healthRouter);
app.use("/api", missionsRouter);

// Serve static frontend (built React app)
const frontendPath = path.join(__dirname, "static");
app.use(express.static(frontendPath));

// SPA fallback - serve index.html for all non-API GET routes
app.use((req, res, next) => {
  if (req.method !== "GET" || req.path.startsWith("/api")) {
    next();
    return;
  }

  res.sendFile(path.join(frontendPath, "index.html"));
});

// Start server
app.listen(PORT, () => {
  console.log("=".repeat(60));
  console.log(`[Mach] 🚀 Unified server running on port ${PORT}`);
  console.log(`[Mach] 📁 Frontend: ${frontendPath}`);
  console.log(`[Mach] 🔗 API: http://localhost:${PORT}/api`);
  console.log("=".repeat(60));

  // In development or if MACH_POLLING=1, use polling mode as fallback
  if (process.env.NODE_ENV === "development" || process.env.MACH_POLLING === "1") {
    console.log("[Mach] 🔄 Starting polling mode (dev fallback)...");
    startPollingMode();
  } else {
    console.log("[Mach] ⚡ Webhook mode enabled - waiting for Supabase triggers");
  }
});

export { app };
