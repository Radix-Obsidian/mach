-- Create missions table for MACH Worker
CREATE TABLE IF NOT EXISTS missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  objective TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'complete', 'failed')),
  flight_plan TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE missions ADD COLUMN IF NOT EXISTS owner_id UUID;
ALTER TABLE missions ALTER COLUMN owner_id SET DEFAULT auth.uid();

ALTER TABLE missions ADD COLUMN IF NOT EXISTS agent_prompt TEXT;

-- Add an index for performance
CREATE INDEX IF NOT EXISTS idx_missions_status ON missions(status);
CREATE INDEX IF NOT EXISTS idx_missions_owner_id ON missions(owner_id);

-- Enable Row Level Security (RLS)
ALTER TABLE missions ENABLE ROW LEVEL SECURITY;

-- Drop any legacy anon policies if they exist
DROP POLICY IF EXISTS "Allow anon read access" ON missions;
DROP POLICY IF EXISTS "Allow anon insert access" ON missions;

-- Drop authenticated policies if they exist (script is safe to rerun)
DROP POLICY IF EXISTS "Authenticated users can read own missions" ON missions;
DROP POLICY IF EXISTS "Authenticated users can create own missions" ON missions;
DROP POLICY IF EXISTS "Authenticated users can update own missions" ON missions;
DROP POLICY IF EXISTS "Authenticated users can delete own missions" ON missions;
DROP POLICY IF EXISTS "Allow service role full access" ON missions;

-- Create policy to allow service role full access
CREATE POLICY "Allow service role full access" ON missions
FOR ALL USING (auth.role() = 'service_role');

-- Authenticated users can read their own missions
CREATE POLICY "Authenticated users can read own missions" ON missions
FOR SELECT USING (auth.uid() IS NOT NULL AND owner_id = auth.uid());

-- Authenticated users can create missions for themselves
CREATE POLICY "Authenticated users can create own missions" ON missions
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND owner_id = auth.uid());

-- Authenticated users can update their own missions
CREATE POLICY "Authenticated users can update own missions" ON missions
FOR UPDATE USING (auth.uid() IS NOT NULL AND owner_id = auth.uid())
WITH CHECK (auth.uid() IS NOT NULL AND owner_id = auth.uid());

-- Authenticated users can delete their own missions
CREATE POLICY "Authenticated users can delete own missions" ON missions
FOR DELETE USING (auth.uid() IS NOT NULL AND owner_id = auth.uid());
