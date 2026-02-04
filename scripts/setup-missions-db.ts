#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://tffleugvwwjpqpusrypd.supabase.co";
const SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRmZmxldWd2d3dqcHFwdXNyeXBkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDE1NTk5NSwiZXhwIjoyMDg1NzMxOTk1fQ.K46tuTXop5rwzafLg5rq0w3UD1GKeXL9A8TL1RoSnSI";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function setupMissionsTable() {
  console.log("[DB Setup] Creating missions table...");

  const { error } = await supabase.rpc('exec_sql', {
    query: `
      CREATE TABLE IF NOT EXISTS missions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        objective TEXT NOT NULL,
        status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'complete', 'failed')),
        flight_plan TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_missions_status ON missions(status);
      ALTER TABLE missions ENABLE ROW LEVEL SECURITY;

      CREATE POLICY "Allow service role full access" ON missions
      FOR ALL USING (auth.role() = 'service_role');

      CREATE POLICY "Allow anon read access" ON missions
      FOR SELECT USING (auth.role() = 'anon');
    `
  });

  if (error) {
    console.error("[DB Setup] Error creating table:", error);
    return;
  }

  console.log("[DB Setup] ✓ Missions table created successfully");

  // Add a test mission
  console.log("[DB Setup] Adding test mission...");
  const { data, error: insertError } = await supabase
    .from("missions")
    .insert({
      objective: "Create a detailed flight plan for a business trip from New York JFK to Los Angeles LAX with 1 stop in Denver. Include departure/arrival times, airline recommendations, and ground transportation options.",
      status: "pending"
    })
    .select()
    .single();

  if (insertError) {
    console.error("[DB Setup] Error adding test mission:", insertError);
    return;
  }

  console.log(`[DB Setup] ✓ Test mission added: ${data.id}`);
  console.log(`[DB Setup] Mission objective: "${data.objective}"`);
  console.log("[DB Setup] Database setup complete!");
}

setupMissionsTable().catch(console.error);
