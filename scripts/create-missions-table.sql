-- Create missions table for MACH Worker
CREATE TABLE IF NOT EXISTS missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  objective TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'complete', 'failed')),
  flight_plan TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add an index for performance
CREATE INDEX IF NOT EXISTS idx_missions_status ON missions(status);

-- Enable Row Level Security (RLS)
ALTER TABLE missions ENABLE ROW LEVEL SECURITY;

-- Create policy to allow service role full access
CREATE POLICY "Allow service role full access" ON missions
FOR ALL USING (auth.role() = 'service_role');

-- Create policy to allow anon read access for testing
CREATE POLICY "Allow anon read access" ON missions
FOR SELECT USING (auth.role() = 'anon');
