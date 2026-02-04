#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://tffleugvwwjpqpusrypd.supabase.co";
const SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRmZmxldWd2d3dqcHFwdXNyeXBkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDE1NTk5NSwiZXhwIjoyMDg1NzMxOTk1fQ.K46tuTXop5rwzafLg5rq0w3UD1GKeXL9A8TL1RoSnSI";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function debugWorkerQuery() {
  console.log("[Debug Worker] Testing exact query from MACH worker...");

  // Test the exact query the worker uses
  console.log("[Debug Worker] Running: supabase.from('missions').select('*').eq('status', 'pending').order('created_at', { ascending: true }).limit(1)");
  
  const { data: missions, error } = await supabase
    .from("missions")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(1);

  console.log(`[Debug Worker] Query result: ${missions?.length || 0} missions found`);
  console.log(`[Debug Worker] Error: ${error ? error.message : 'None'}`);

  if (error) {
    console.error("[Debug Worker] Full error:", error);
    return;
  }

  if (missions && missions.length > 0) {
    console.log("[Debug Worker] Found mission:");
    console.log(`  ID: ${missions[0].id}`);
    console.log(`  Status: ${missions[0].status}`);
    console.log(`  Objective: ${missions[0].objective.substring(0, 100)}...`);
  } else {
    console.log("[Debug Worker] No missions found with this query");
    
    // Debug: Check what statuses exist
    console.log("[Debug Worker] Checking all possible statuses...");
    const { data: allMissions } = await supabase
      .from("missions")
      .select("status")
      .order("created_at", { ascending: false });

    const statusCounts = {};
    allMissions?.forEach(m => {
      statusCounts[m.status] = (statusCounts[m.status] || 0) + 1;
    });

    console.log("[Debug Worker] Status counts:", statusCounts);

    // Debug: Check if there are any missions at all
    const { data: anyMissions } = await supabase
      .from("missions")
      .select("id, status, objective")
      .order("created_at", { ascending: false })
      .limit(5);

    console.log("[Debug Worker] Last 5 missions:");
    anyMissions?.forEach((m, i) => {
      console.log(`  ${i + 1}. Status: ${m.status}, Objective: ${m.objective.substring(0, 60)}...`);
    });
  }
}

debugWorkerQuery().catch(console.error);
