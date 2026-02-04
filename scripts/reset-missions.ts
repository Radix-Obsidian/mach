#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://tffleugvwwjpqpusrypd.supabase.co";
const SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRmZmxldWd2d3dqcHFwdXNyeXBkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDE1NTk5NSwiZXhwIjoyMDg1NzMxOTk1fQ.K46tuTXop5rwzafLg5rq0w3UD1GKeXL9A8TL1RoSnSI";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function resetFailedMissions() {
  console.log("[DB Reset] Resetting failed missions to pending...");

  // Reset failed missions to pending
  const { data: resetData, error: resetError } = await supabase
    .from("missions")
    .update({ 
      status: "pending",
      flight_plan: null,
      updated_at: new Date().toISOString()
    })
    .eq("status", "failed")
    .select();

  if (resetError) {
    console.error("[DB Reset] Error resetting missions:", resetError);
    return;
  }

  console.log(`[DB Reset] ✓ Reset ${resetData?.length || 0} failed missions to pending`);

  // Check current missions
  const { data: allMissions, error: allError } = await supabase
    .from("missions")
    .select("*")
    .order("created_at", { ascending: false });

  if (allError) {
    console.error("[DB Reset] Error checking missions:", allError);
    return;
  }

  console.log("[DB Reset] Current missions status:");
  allMissions?.forEach((mission, index) => {
    console.log(`  ${index + 1}. ID: ${mission.id} - Status: ${mission.status}`);
    console.log(`     Objective: ${mission.objective.substring(0, 80)}...`);
  });

  console.log("[DB Reset] Ready for MACH worker processing!");
}

resetFailedMissions().catch(console.error);
