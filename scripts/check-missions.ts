#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://tffleugvwwjpqpusrypd.supabase.co";
const SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRmZmxldWd2d3dqcHFwdXNyeXBkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDE1NTk5NSwiZXhwIjoyMDg1NzMxOTk1fQ.K46tuTXop5rwzafLg5rq0w3UD1GKeXL9A8TL1RoSnSI";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkMissions() {
  console.log("[DB Check] Checking missions table...");

  // Check all missions
  const { data: allMissions, error: allError } = await supabase
    .from("missions")
    .select("*")
    .order("created_at", { ascending: false });

  if (allError) {
    console.error("[DB Check] Error fetching missions:", allError);
    return;
  }

  console.log(`[DB Check] Total missions: ${allMissions?.length || 0}`);

  if (allMissions && allMissions.length > 0) {
    console.log("[DB Check] All missions:");
    allMissions.forEach((mission, index) => {
      console.log(`  ${index + 1}. ID: ${mission.id}`);
      console.log(`     Status: ${mission.status}`);
      console.log(`     Objective: ${mission.objective.substring(0, 100)}...`);
      console.log(`     Created: ${mission.created_at}`);
      console.log(`     Updated: ${mission.updated_at}`);
      console.log(`     Flight Plan: ${mission.flight_plan ? 'Yes' : 'No'}`);
      console.log("");
    });
  }

  // Check pending missions specifically
  const { data: pendingMissions, error: pendingError } = await supabase
    .from("missions")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (pendingError) {
    console.error("[DB Check] Error fetching pending missions:", pendingError);
    return;
  }

  console.log(`[DB Check] Pending missions: ${pendingMissions?.length || 0}`);

  if (pendingMissions && pendingMissions.length > 0) {
    console.log("[DB Check] Pending missions details:");
    pendingMissions.forEach((mission, index) => {
      console.log(`  ${index + 1}. ID: ${mission.id}`);
      console.log(`     Objective: ${mission.objective}`);
      console.log(`     Created: ${mission.created_at}`);
    });
  } else {
    console.log("[DB Check] No pending missions found");
  }
}

checkMissions().catch(console.error);
