#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://tffleugvwwjpqpusrypd.supabase.co";
const SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRmZmxldWd2d3dqcHFwdXNyeXBkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDE1NTk5NSwiZXhwIjoyMDg1NzMxOTk1fQ.K46tuTXop5rwzafLg5rq0w3UD1GKeXL9A8TL1RoSnSI";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function forceResetMissions() {
  console.log("[DB Force Reset] Forcing reset of all missions to pending...");

  // Force reset all missions to pending
  const { data: resetData, error: resetError } = await supabase
    .from("missions")
    .update({ 
      status: "pending",
      flight_plan: null
    })
    .neq("id", "00000000-0000-0000-0000-000000000000") // Update all rows
    .select();

  if (resetError) {
    console.error("[DB Force Reset] Error resetting missions:", resetError);
    return;
  }

  console.log(`[DB Force Reset] ✓ Reset ${resetData?.length || 0} missions to pending`);

  // Verify the reset worked
  const { data: pendingMissions, error: pendingError } = await supabase
    .from("missions")
    .select("*")
    .eq("status", "pending");

  if (pendingError) {
    console.error("[DB Force Reset] Error checking pending missions:", pendingError);
    return;
  }

  console.log(`[DB Force Reset] ✓ Confirmed ${pendingMissions?.length || 0} missions are pending`);

  // Show current status
  const { data: allMissions, error: allError } = await supabase
    .from("missions")
    .select("*")
    .order("created_at", { ascending: false });

  if (allError) {
    console.error("[DB Force Reset] Error checking all missions:", allError);
    return;
  }

  console.log("[DB Force Reset] Current missions:");
  allMissions?.forEach((mission, index) => {
    console.log(`  ${index + 1}. ID: ${mission.id.substring(0, 8)}... - Status: ${mission.status}`);
    console.log(`     Objective: ${mission.objective.substring(0, 60)}...`);
  });

  console.log("[DB Force Reset] Ready for MACH worker processing!");
}

forceResetMissions().catch(console.error);
