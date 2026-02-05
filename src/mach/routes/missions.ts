import { Router } from "express";
import { createClient } from "@supabase/supabase-js";
import { processMission } from "../worker.js";
import { authenticateUser, AuthenticatedRequest } from "../middleware/auth.js";

const router = Router();

// Lazy Supabase init — env vars are loaded by server.ts before first request
let _supabase: ReturnType<typeof createClient> | null | undefined;
function getSupabase() {
  if (_supabase === undefined) {
    const url = process.env.VITE_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY;
    _supabase = url && key ? createClient(url, key) : null;
  }
  return _supabase;
}

// Create a new mission (requires authentication)
router.post(
  "/missions",
  authenticateUser,
  async (req: AuthenticatedRequest, res) => {
    const supabase = getSupabase();
    if (!supabase) {
      return res.status(503).json({ error: "Supabase not configured" });
    }

    // Verify user is authenticated
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { objective, repository_url, business_context } = req.body as {
      objective?: string;
      repository_url?: string;
      business_context?: { revenue_model?: string; monthly_revenue?: number; user_count?: number };
    };
    if (!objective || objective.trim() === "") {
      return res.status(400).json({ error: "objective is required" });
    }

    try {
      // Check quota
      const { data: subscription, error: subError } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", req.user.id)
        .single();

      if (subError && subError.code !== "PGRST116") {
        // PGRST116 = no rows (new user)
        console.error("[Mach Missions] Subscription fetch failed:", subError);
        return res.status(500).json({ error: "Failed to check quota" });
      }

      // If subscription exists and quota is exceeded, reject
      if (
        subscription &&
        subscription.missions_used >= subscription.missions_quota
      ) {
        console.log(
          `[Mach Missions] Quota exceeded for user ${req.user.id}: ${subscription.missions_used}/${subscription.missions_quota}`
        );
        return res.status(402).json({
          error: "Monthly mission quota exceeded",
          current_tier: subscription.plan_tier,
          missions_used: subscription.missions_used,
          missions_quota: subscription.missions_quota,
        });
      }

      const insertPayload: Record<string, unknown> = {
        objective: objective.trim(),
        status: "pending",
        owner_id: req.user.id, // Capture authenticated user as owner
      };
      if (repository_url) insertPayload.repository_url = repository_url;
      if (business_context) insertPayload.business_context = business_context;

      const { data, error } = await supabase
        .from("missions")
        .insert(insertPayload)
        .select()
        .single();

      if (error) {
        console.error("[Mach Missions] Insert failed:", error);
        return res.status(500).json({ error: error.message });
      }

      console.log(
        `[Mach Missions] Created mission ${data.id} for user ${req.user.id}`
      );

      // Fire-and-forget: process the mission immediately
      processMission(data.id, data.objective).catch((err) =>
        console.error(`[Mach Missions] Processing failed for ${data.id}:`, err)
      );

      return res.status(201).json(data);
    } catch (err) {
      console.error("[Mach Missions] Unexpected error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

// Get mission by ID (service-key read, bypasses RLS)
router.get("/missions/:id", async (req, res) => {
  const supabase = getSupabase();
  if (!supabase) {
    return res.status(503).json({ error: "Supabase not configured" });
  }

  const { id } = req.params;

  const { data, error } = await supabase
    .from("missions")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    return res.status(404).json({ error: "Mission not found" });
  }

  return res.status(200).json(data);
});

export { router as missionsRouter };
