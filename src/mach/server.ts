import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadDotEnv } from "../infra/dotenv.js";

// Load environment variables BEFORE importing modules that read process.env at top-level
loadDotEnv({ quiet: true });

import { deckRouter } from "./routes/deck.js";
import { documentsRouter } from "./routes/documents.js";
import { healthRouter } from "./routes/health.js";
import { missionsRouter } from "./routes/missions.js";
import { stripeRouter } from "./routes/stripe.js";
import { webhookRouter } from "./routes/webhook.js";
import { startPollingMode } from "./worker.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 8080;

// Stripe webhook must receive raw body, so process it before JSON parsing
app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), (req, res, next) => {
  // Store raw body for Stripe signature verification
  (req as any).rawBody = req.body;
  next();
});

// Middleware — increased limit for base64 document uploads
app.use(express.json({ limit: "20mb" }));

// CORS for local dev (Vite runs on a different port)
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Allow-Credentials", "true");
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
app.use("/api", documentsRouter);
app.use("/api", stripeRouter);
app.use("/api", deckRouter);

// Serve landing page static assets (styles.css, script.js, etc.)
const landingPath = path.join(__dirname, "../../landing");
app.use(express.static(landingPath));

// Serve static frontend (built React app) from /app path
const frontendPath = path.join(__dirname, "static");
app.use("/app", express.static(frontendPath));

// Routes: landing page vs SPA
app.get("/", (req, res) => {
  // Serve landing page at root
  res.sendFile(path.join(landingPath, "index.html"));
});

// Serve React SPA for /app and all /app/* routes
app.get(/^\/app(\/.*)?$/, (req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

// Fallback: serve landing page for any other GET request (404 alternative)
app.use((req, res, next) => {
  if (req.method !== "GET" || req.path.startsWith("/api")) {
    next();
    return;
  }

  // For any unmatched GET request, serve landing page
  res.sendFile(path.join(landingPath, "index.html"));
});

// Start server
app.listen(PORT, () => {
  console.log("=".repeat(60));
  console.log(`[Mach] 🚀 Unified server running on port ${PORT}`);
  console.log(`[Mach] 📁 Frontend: ${frontendPath}`);
  console.log(`[Mach] 🔗 API: http://localhost:${PORT}/api`);

  // Environment diagnostic
  const hasUrl = !!process.env.VITE_SUPABASE_URL;
  const hasKey = !!process.env.SUPABASE_SERVICE_KEY;
  const keyPrefix = process.env.SUPABASE_SERVICE_KEY?.slice(0, 12) || "MISSING";
  const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY;
  const devQuota = process.env.MACH_DEV_UNLIMITED_QUOTA === "1";
  console.log(
    `[Mach] 🔐 Supabase URL: ${hasUrl ? "✅" : "❌"} | Key: ${hasKey ? `✅ (${keyPrefix}...)` : "❌"}`,
  );
  console.log(
    `[Mach] 🤖 Anthropic: ${hasAnthropicKey ? "✅" : "❌"} | Dev Quota Bypass: ${devQuota ? "✅ ON" : "OFF"}`,
  );
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
