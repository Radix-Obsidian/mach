import { Router } from "express";
import { createClient } from "@supabase/supabase-js";

const router = Router();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

type HealthStatus = {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  version: string;
  checks: {
    server: boolean;
    supabase: boolean;
    anthropic: boolean;
  };
  uptime: number;
};

const startTime = Date.now();

router.get("/health", async (_req, res) => {
  const checks = {
    server: true,
    supabase: false,
    anthropic: !!process.env.ANTHROPIC_API_KEY,
  };

  // Check Supabase connection
  if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
    try {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
      const { error } = await supabase.from("missions").select("id").limit(1);
      checks.supabase = !error;
    } catch {
      checks.supabase = false;
    }
  }

  const allHealthy = Object.values(checks).every(Boolean);
  const someHealthy = Object.values(checks).some(Boolean);

  const health: HealthStatus = {
    status: allHealthy ? "healthy" : someHealthy ? "degraded" : "unhealthy",
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || "dev",
    checks,
    uptime: Math.floor((Date.now() - startTime) / 1000),
  };

  const statusCode = allHealthy ? 200 : someHealthy ? 200 : 503;
  return res.status(statusCode).json(health);
});

router.get("/status", async (_req, res) => {
  // Quick status check without database probe
  return res.status(200).json({
    status: "ok",
    mode: process.env.MACH_POLLING === "1" ? "polling" : "webhook",
    timestamp: new Date().toISOString(),
  });
});

export { router as healthRouter };
