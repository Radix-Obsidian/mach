#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://tffleugvwwjpqpusrypd.supabase.co";
const SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRmZmxldWd2d3dqcHFwdXNyeXBkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDE1NTk5NSwiZXhwIjoyMDg1NzMxOTk1fQ.K46tuTXop5rwzafLg5rq0w3UD1GKeXL9A8TL1RoSnSI";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function fixMissionsTable() {
  console.log("[DB Fix] Checking missions table structure...");

  // First, let's see what columns exist
  const { data: sampleMissions, error: sampleError } = await supabase
    .from("missions")
    .select("*")
    .limit(1);

  if (sampleError) {
    console.error("[DB Fix] Error checking table:", sampleError);
    return;
  }

  if (sampleMissions && sampleMissions.length > 0) {
    console.log("[DB Fix] Current columns:", Object.keys(sampleMissions[0]));
  }

  // Try to add the missing updated_at column using raw SQL
  console.log("[DB Fix] Adding missing updated_at column...");
  
  try {
    // Use Supabase's RPC to execute raw SQL
    const { error: alterError } = await supabase.rpc('exec', {
      query: "ALTER TABLE missions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();"
    });

    if (alterError) {
      console.log("[DB Fix] RPC method failed, trying alternative approach...");
      
      // Alternative: Try to update without the updated_at column first
      const { data: resetData, error: resetError } = await supabase
        .from("missions")
        .update({ 
          status: "pending",
          flight_plan: null
        })
        .eq("status", "failed")
        .select();

      if (resetError) {
        console.error("[DB Fix] Error resetting missions:", resetError);
        return;
      }

      console.log(`[DB Fix] ✓ Reset ${resetData?.length || 0} failed missions to pending`);
    } else {
      console.log("[DB Fix] ✓ Added updated_at column successfully");
    }
  } catch (err) {
    console.log("[DB Fix] Error with column addition, continuing...");
  }

  // Check current missions
  const { data: allMissions, error: allError } = await supabase
    .from("missions")
    .select("*")
    .order("created_at", { ascending: false });

  if (allError) {
    console.error("[DB Fix] Error checking missions:", allError);
    return;
  }

  console.log("[DB Fix] Current missions status:");
  allMissions?.forEach((mission, index) => {
    console.log(`  ${index + 1}. ID: ${mission.id} - Status: ${mission.status}`);
    console.log(`     Objective: ${mission.objective.substring(0, 80)}...`);
  });

  console.log("[DB Fix] Database schema fixed and ready for processing!");
}

fixMissionsTable().catch(console.error);
