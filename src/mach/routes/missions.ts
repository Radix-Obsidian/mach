import { Router } from "express";
import { createClient } from "@supabase/supabase-js";
import { processMission } from "../worker.js";

const router = Router();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const supabase =
  SUPABASE_URL && SUPABASE_SERVICE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    : null;

// Create a new mission (service-key insert, bypasses RLS)
router.post("/missions", async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ error: "Supabase not configured" });
  }

  const { objective } = req.body as { objective?: string };
  if (!objective || objective.trim() === "") {
    return res.status(400).json({ error: "objective is required" });
  }

  try {
    const { data, error } = await supabase
      .from("missions")
      .insert({ objective: objective.trim(), status: "pending" })
      .select()
      .single();

    if (error) {
      console.error("[Mach Missions] Insert failed:", error);
      return res.status(500).json({ error: error.message });
    }

    console.log(`[Mach Missions] Created mission ${data.id}`);

    // Fire-and-forget: process the mission immediately
    processMission(data.id, data.objective).catch((err) =>
      console.error(`[Mach Missions] Processing failed for ${data.id}:`, err),
    );

    return res.status(201).json(data);
  } catch (err) {
    console.error("[Mach Missions] Unexpected error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Get mission by ID (service-key read, bypasses RLS)
router.get("/missions/:id", async (req, res) => {
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
