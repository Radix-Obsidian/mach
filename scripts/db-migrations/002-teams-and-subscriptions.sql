-- Phase 1: Teams, Subscriptions, and Analytics Schema
-- Minimal, proven approach - creates tables with basic RLS
-- Run in Supabase SQL Editor step by step
-- Created: 2026-02-05

-- ============================================================================
-- 1. USER PROFILES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;

CREATE POLICY "Users can read own profile" ON public.user_profiles
FOR SELECT USING (auth.uid() IS NOT NULL AND id = auth.uid());

CREATE POLICY "Users can update own profile" ON public.user_profiles
FOR UPDATE USING (auth.uid() IS NOT NULL AND id = auth.uid())
WITH CHECK (auth.uid() IS NOT NULL AND id = auth.uid());

COMMENT ON TABLE public.user_profiles IS 'Extended user profile information';

-- ============================================================================
-- 2. TEAMS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Team owners can delete" ON public.teams;
DROP POLICY IF EXISTS "Team members can read" ON public.teams;
DROP POLICY IF EXISTS "Team owners can update" ON public.teams;

CREATE POLICY "Team owners can delete" ON public.teams
FOR DELETE USING (auth.uid() IS NOT NULL AND owner_id = auth.uid());

CREATE POLICY "Team owners can update" ON public.teams
FOR UPDATE USING (auth.uid() IS NOT NULL AND owner_id = auth.uid())
WITH CHECK (auth.uid() IS NOT NULL AND owner_id = auth.uid());

CREATE POLICY "Team members can read" ON public.teams
FOR SELECT USING (auth.uid() IS NOT NULL AND owner_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_teams_owner_id ON public.teams(owner_id);

COMMENT ON TABLE public.teams IS 'Teams for collaborative missions';

-- ============================================================================
-- 3. TEAM MEMBERS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'manager', 'member')),
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(team_id, user_id)
);

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Team owners can manage members" ON public.team_members;
DROP POLICY IF EXISTS "Team members can read memberships" ON public.team_members;

CREATE POLICY "Team owners can manage members" ON public.team_members
FOR ALL USING (auth.uid() IS NOT NULL AND user_id = auth.uid());

CREATE POLICY "Team members can read memberships" ON public.team_members
FOR SELECT USING (auth.uid() IS NOT NULL AND user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON public.team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON public.team_members(team_id);

COMMENT ON TABLE public.team_members IS 'Association between teams and users';

-- ============================================================================
-- 4. SUBSCRIPTIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  plan_tier TEXT NOT NULL DEFAULT 'free' CHECK (plan_tier IN ('free', 'starter', 'pro', 'enterprise')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'past_due', 'trialing')),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  missions_quota INTEGER NOT NULL DEFAULT 3,
  missions_used INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own subscription" ON public.subscriptions;

CREATE POLICY "Users can read own subscription" ON public.subscriptions
FOR SELECT USING (auth.uid() IS NOT NULL AND user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer ON public.subscriptions(stripe_customer_id);

COMMENT ON TABLE public.subscriptions IS 'Subscription and quota information';

-- ============================================================================
-- 5. ALTER MISSIONS TABLE - Add team support
-- ============================================================================

-- First, drop all old missions policies to avoid conflicts
DROP POLICY IF EXISTS "Allow anon read access" ON public.missions;
DROP POLICY IF EXISTS "Allow anon insert access" ON public.missions;
DROP POLICY IF EXISTS "Allow service role full access" ON public.missions;
DROP POLICY IF EXISTS "Authenticated users can read own missions" ON public.missions;
DROP POLICY IF EXISTS "Authenticated users can create own missions" ON public.missions;
DROP POLICY IF EXISTS "Authenticated users can update own missions" ON public.missions;
DROP POLICY IF EXISTS "Authenticated users can delete own missions" ON public.missions;

-- Add team support columns
ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL;
ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS mission_type TEXT DEFAULT 'individual' CHECK (mission_type IN ('individual', 'team'));

CREATE INDEX IF NOT EXISTS idx_missions_team_id ON public.missions(team_id);

COMMENT ON COLUMN public.missions.team_id IS 'Team this mission belongs to (NULL for individual missions)';
COMMENT ON COLUMN public.missions.mission_type IS 'individual or team mission';

-- Add temporary basic policies for missions (will be replaced by 003 with team-aware policies)
CREATE POLICY "Authenticated users can read own missions" ON public.missions
FOR SELECT USING (auth.uid() IS NOT NULL AND owner_id = auth.uid());

CREATE POLICY "Authenticated users can create missions" ON public.missions
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND owner_id = auth.uid());

CREATE POLICY "Authenticated users can update own missions" ON public.missions
FOR UPDATE USING (auth.uid() IS NOT NULL AND owner_id = auth.uid())
WITH CHECK (auth.uid() IS NOT NULL AND owner_id = auth.uid());

CREATE POLICY "Authenticated users can delete own missions" ON public.missions
FOR DELETE USING (auth.uid() IS NOT NULL AND owner_id = auth.uid());

-- ============================================================================
-- 6. MISSION ANALYTICS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.mission_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  processing_time_ms INTEGER,
  agent_tokens_used INTEGER,
  quality_score DECIMAL(3,2),
  was_rejected BOOLEAN DEFAULT false,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.mission_analytics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own mission analytics" ON public.mission_analytics;

CREATE POLICY "Users can read own mission analytics" ON public.mission_analytics
FOR SELECT USING (auth.uid() IS NOT NULL AND user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_mission_analytics_mission_id ON public.mission_analytics(mission_id);
CREATE INDEX IF NOT EXISTS idx_mission_analytics_user_id ON public.mission_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_mission_analytics_team_id ON public.mission_analytics(team_id);

COMMENT ON TABLE public.mission_analytics IS 'Analytics and metrics for missions';

-- ============================================================================
-- 7. AUTO-SYNC TRIGGERS
-- ============================================================================

-- Create user_profiles on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email)
  VALUES (new.id, new.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Increment missions_used on mission creation
CREATE OR REPLACE FUNCTION public.increment_missions_used()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.owner_id IS NOT NULL THEN
    INSERT INTO public.subscriptions (user_id, missions_quota, missions_used)
    VALUES (NEW.owner_id, 3, 1)
    ON CONFLICT (user_id) DO UPDATE
    SET missions_used = subscriptions.missions_used + 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_mission_created ON public.missions;
CREATE TRIGGER on_mission_created
  AFTER INSERT ON public.missions
  FOR EACH ROW EXECUTE FUNCTION public.increment_missions_used();

-- ============================================================================
-- VERIFICATION
-- ============================================================================

SELECT
  EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_profiles') as user_profiles_created,
  EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'teams') as teams_created,
  EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'team_members') as team_members_created,
  EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'subscriptions') as subscriptions_created,
  EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'mission_analytics') as mission_analytics_created;
