-- Phase 1B: Advanced RLS Policies for Team-Based Access
-- Run AFTER 002-teams-and-subscriptions.sql completes successfully
-- Updates missions RLS to support team access control
-- Created: 2026-02-05

-- ============================================================================
-- REPLACE MISSIONS TABLE RLS POLICIES WITH TEAM-AWARE VERSIONS
-- Now that all prerequisite tables (teams, team_members) are created
-- ============================================================================

-- Drop temporary policies from 002 to replace with team-aware versions
DROP POLICY IF EXISTS "Authenticated users can read own missions" ON public.missions;
DROP POLICY IF EXISTS "Authenticated users can create missions" ON public.missions;
DROP POLICY IF EXISTS "Authenticated users can update own missions" ON public.missions;
DROP POLICY IF EXISTS "Authenticated users can delete own missions" ON public.missions;

-- Policy: Users can read missions they own OR team missions
CREATE POLICY "Authenticated users can read own or team missions" ON public.missions
FOR SELECT USING (
  auth.uid() IS NOT NULL AND (
    owner_id = auth.uid() OR
    (
      team_id IS NOT NULL AND
      EXISTS (
        SELECT 1 FROM public.team_members
        WHERE team_members.team_id = missions.team_id
        AND team_members.user_id = auth.uid()
      )
    )
  )
);

-- Policy: Users can create missions for themselves or teams
CREATE POLICY "Authenticated users can create missions" ON public.missions
FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND
  owner_id = auth.uid() AND
  (
    team_id IS NULL OR
    EXISTS (
      SELECT 1 FROM public.team_members
      WHERE team_members.team_id = missions.team_id
      AND team_members.user_id = auth.uid()
    )
  )
);

-- Policy: Users can update missions they own (team-aware)
CREATE POLICY "Authenticated users can update own missions" ON public.missions
FOR UPDATE USING (
  auth.uid() IS NOT NULL AND owner_id = auth.uid()
)
WITH CHECK (
  auth.uid() IS NOT NULL AND owner_id = auth.uid()
);

-- Policy: Users can delete missions they own
CREATE POLICY "Authenticated users can delete own missions" ON public.missions
FOR DELETE USING (
  auth.uid() IS NOT NULL AND owner_id = auth.uid()
);

-- ============================================================================
-- UPDATE MISSION ANALYTICS RLS POLICY
-- Now supports team-based access
-- ============================================================================

DROP POLICY IF EXISTS "Users can read own mission analytics" ON public.mission_analytics;

CREATE POLICY "Users can read own mission analytics" ON public.mission_analytics
FOR SELECT USING (
  auth.uid() IS NOT NULL AND (
    user_id = auth.uid() OR
    (
      team_id IS NOT NULL AND
      EXISTS (
        SELECT 1 FROM public.team_members
        WHERE team_members.team_id = mission_analytics.team_id
        AND team_members.user_id = auth.uid()
      )
    )
  )
);

-- ============================================================================
-- UPDATE TEAMS RLS POLICY
-- Teams members (via team_members) can read team info
-- ============================================================================

DROP POLICY IF EXISTS "Team members can read" ON public.teams;

CREATE POLICY "Team members can read" ON public.teams
FOR SELECT USING (
  auth.uid() IS NOT NULL AND (
    owner_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.team_members
      WHERE team_members.team_id = teams.id
      AND team_members.user_id = auth.uid()
    )
  )
);

-- ============================================================================
-- VERIFICATION
-- ============================================================================

SELECT
  COUNT(*) as mission_policies
FROM pg_policies
WHERE tablename = 'missions' AND schemaname = 'public'
UNION ALL
SELECT COUNT(*) FROM pg_policies
WHERE tablename = 'mission_analytics' AND schemaname = 'public'
UNION ALL
SELECT COUNT(*) FROM pg_policies
WHERE tablename = 'teams' AND schemaname = 'public';
