-- Phase 1: Mach Deck - Spatial Analytics Canvas
-- Creates canvas_instances and canvas_cards tables for agent-driven visualization
-- Run in Supabase SQL Editor step by step
-- Created: 2026-02-05

-- ============================================================================
-- 1. CANVAS INSTANCES TABLE (one per user/team)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.canvas_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  canvas_name TEXT DEFAULT 'My Mach Deck',
  viewport_x FLOAT DEFAULT 0,
  viewport_y FLOAT DEFAULT 0,
  viewport_zoom FLOAT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_user_canvas UNIQUE(owner_id, team_id)
);

ALTER TABLE public.canvas_instances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own canvas" ON public.canvas_instances;
DROP POLICY IF EXISTS "Users can update their own canvas" ON public.canvas_instances;
DROP POLICY IF EXISTS "Service role full access to canvas_instances" ON public.canvas_instances;

CREATE POLICY "Users can view their own canvas" ON public.canvas_instances
FOR SELECT USING (
  auth.uid() IS NOT NULL AND (
    owner_id = auth.uid() OR
    team_id IN (
      SELECT team_id FROM public.team_members
      WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can update their own canvas" ON public.canvas_instances
FOR UPDATE USING (
  auth.uid() IS NOT NULL AND owner_id = auth.uid()
)
WITH CHECK (
  auth.uid() IS NOT NULL AND owner_id = auth.uid()
);

CREATE POLICY "Service role full access to canvas_instances" ON public.canvas_instances
FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_canvas_instances_owner_id ON public.canvas_instances(owner_id);
CREATE INDEX IF NOT EXISTS idx_canvas_instances_team_id ON public.canvas_instances(team_id);

COMMENT ON TABLE public.canvas_instances IS 'Canvas state for Mach Deck - stores viewport and metadata';

-- ============================================================================
-- 2. CANVAS CARDS TABLE (Avionics Cards)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.canvas_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canvas_id UUID NOT NULL REFERENCES public.canvas_instances(id) ON DELETE CASCADE,
  card_type TEXT NOT NULL CHECK (card_type IN ('avionics_card', 'metric_card', 'signal_card')),
  position_x FLOAT NOT NULL,
  position_y FLOAT NOT NULL,
  width FLOAT DEFAULT 400,
  height FLOAT DEFAULT 300,
  a2ui_payload JSONB NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.canvas_cards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view cards on their canvas" ON public.canvas_cards;
DROP POLICY IF EXISTS "Users can update their own cards" ON public.canvas_cards;
DROP POLICY IF EXISTS "Users can delete their own cards" ON public.canvas_cards;
DROP POLICY IF EXISTS "Service role full access to canvas_cards" ON public.canvas_cards;

CREATE POLICY "Users can view cards on their canvas" ON public.canvas_cards
FOR SELECT USING (
  auth.uid() IS NOT NULL AND
  canvas_id IN (
    SELECT id FROM public.canvas_instances
    WHERE owner_id = auth.uid() OR
          team_id IN (
            SELECT team_id FROM public.team_members
            WHERE user_id = auth.uid()
          )
  )
);

CREATE POLICY "Users can update their own cards" ON public.canvas_cards
FOR UPDATE USING (
  auth.uid() IS NOT NULL AND
  canvas_id IN (
    SELECT id FROM public.canvas_instances
    WHERE owner_id = auth.uid()
  )
)
WITH CHECK (
  auth.uid() IS NOT NULL AND
  canvas_id IN (
    SELECT id FROM public.canvas_instances
    WHERE owner_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their own cards" ON public.canvas_cards
FOR DELETE USING (
  auth.uid() IS NOT NULL AND
  canvas_id IN (
    SELECT id FROM public.canvas_instances
    WHERE owner_id = auth.uid()
  )
);

CREATE POLICY "Service role full access to canvas_cards" ON public.canvas_cards
FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_canvas_cards_canvas_id ON public.canvas_cards(canvas_id);
CREATE INDEX IF NOT EXISTS idx_canvas_cards_created_at ON public.canvas_cards(created_at);
CREATE INDEX IF NOT EXISTS idx_canvas_cards_type ON public.canvas_cards(card_type);

COMMENT ON TABLE public.canvas_cards IS 'Avionics cards on the Mach Deck canvas';
COMMENT ON COLUMN public.canvas_cards.a2ui_payload IS 'A2UI JSONL payloads stored as JSON array';
COMMENT ON COLUMN public.canvas_cards.metadata IS 'Card metadata: mission_id, confidence_score, card_title, etc';

-- ============================================================================
-- 3. AUTO-CREATE CANVAS ON FIRST MISSION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_first_mission_canvas()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.owner_id IS NOT NULL THEN
    INSERT INTO public.canvas_instances (owner_id)
    VALUES (NEW.owner_id)
    ON CONFLICT (owner_id, team_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_mission_created_canvas ON public.missions;
CREATE TRIGGER on_mission_created_canvas
  AFTER INSERT ON public.missions
  FOR EACH ROW EXECUTE FUNCTION public.handle_first_mission_canvas();

-- ============================================================================
-- VERIFICATION
-- ============================================================================

SELECT
  EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'canvas_instances') as canvas_instances_created,
  EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'canvas_cards') as canvas_cards_created;
