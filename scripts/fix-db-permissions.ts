#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://tffleugvwwjpqpusrypd.supabase.co";
const SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRmZmxldWd2d3dqcHFwdXNyeXBkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDE1NTk5NSwiZXhwIjoyMDg1NzMxOTk1fQ.K46tuTXop5rwzafLg5rq0w3UD1GKeXL9A8TL1RoSnSI";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function fixDbPermissions() {
  console.log("[DB Fix] Checking and fixing database permissions...");

  // First, let's check what auth role we're using
  console.log("[DB Fix] Testing service role access...");

  // Try to directly update one mission as a test
  const testMissionId = "3c760e45-1839-4e20-9c18-d7d7b7195ce1";
  
  console.log(`[DB Fix] Attempting to update mission ${testMissionId}...`);
  
  const { data: updateResult, error: updateError } = await supabase
    .from("missions")
    .update({ 
      status: "pending",
      flight_plan: null
    })
    .eq("id", testMissionId)
    .select();

  console.log(`[DB Fix] Update result: ${updateResult?.length || 0} rows affected`);
  console.log(`[DB Fix] Update error: ${updateError ? updateError.message : 'None'}`);

  if (updateError) {
    console.error("[DB Fix] Update failed with error:", updateError);
    console.log("[DB Fix] This suggests RLS policies are blocking the update");
    
    // Let's check the current RLS policies
    console.log("[DB Fix] Checking current RLS policies...");
    
    try {
      // Try to check RLS status
      const { data: rlsStatus, error: rlsError } = await supabase
        .rpc('check_rls_status', {});
        
      if (rlsError) {
        console.log("[DB Fix] Cannot check RLS status via RPC, trying alternative...");
      }
    } catch (err) {
      console.log("[DB Fix] RPC method not available");
    }
    
    return;
  }

  // Check if the update actually worked
  console.log("[DB Fix] Verifying update worked...");
  const { data: verifyResult, error: verifyError } = await supabase
    .from("missions")
    .select("id, status, flight_plan")
    .eq("id", testMissionId)
    .single();

  if (verifyError) {
    console.error("[DB Fix] Error verifying update:", verifyError);
    return;
  }

  console.log(`[DB Fix] Mission status after update: ${verifyResult.status}`);
  console.log(`[DB Fix] Flight plan after update: ${verifyResult.flight_plan ? 'Set' : 'Null'}`);

  if (verifyResult.status === "pending") {
    console.log("[DB Fix] ✓ Update successful! Now resetting all missions...");
    
    // Reset all missions
    const { data: resetAllResult, error: resetAllError } = await supabase
      .from("missions")
      .update({ 
        status: "pending",
        flight_plan: null
      })
      .neq("id", "00000000-0000-0000-0000-000000000000") // Update all rows
      .select();

    if (resetAllError) {
      console.error("[DB Fix] Error resetting all missions:", resetAllError);
      return;
    }

    console.log(`[DB Fix] ✓ Reset ${resetAllResult?.length || 0} missions to pending`);
    
    // Final verification
    const { data: finalCheck } = await supabase
      .from("missions")
      .select("status")
      .eq("status", "pending");

    console.log(`[DB Fix] ✓ Final check: ${finalCheck?.length || 0} missions are pending`);
  } else {
    console.log("[DB Fix] ✗ Update did not work - mission still has status:", verifyResult.status);
  }
}

fixDbPermissions().catch(console.error);
