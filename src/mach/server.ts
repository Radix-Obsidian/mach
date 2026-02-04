import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { webhookRouter } from "./routes/webhook.js";
import { healthRouter } from "./routes/health.js";
import { startPollingMode } from "./worker.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(express.json());

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

// Serve static frontend (built React app)
const frontendPath = path.join(__dirname, "../../mach-frontend/dist");
app.use(express.static(frontendPath));

// SPA fallback - serve index.html for all non-API routes
app.get("*", (req, res) => {
  if (!req.path.startsWith("/api")) {
    res.sendFile(path.join(frontendPath, "index.html"));
  }
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
