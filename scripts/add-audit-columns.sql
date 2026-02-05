-- Add audit columns to missions table for MEP audit system
-- Safe to rerun: uses IF NOT EXISTS / conditional adds

ALTER TABLE missions ADD COLUMN IF NOT EXISTS repository_url TEXT;
ALTER TABLE missions ADD COLUMN IF NOT EXISTS spec_documents JSONB DEFAULT '[]'::jsonb;
ALTER TABLE missions ADD COLUMN IF NOT EXISTS audit_report JSONB;
ALTER TABLE missions ADD COLUMN IF NOT EXISTS business_context JSONB;

-- Index for filtering by repo
CREATE INDEX IF NOT EXISTS idx_missions_repository ON missions(repository_url);

COMMENT ON COLUMN missions.repository_url IS 'GitHub/GitLab repository URL for codebase audit';
COMMENT ON COLUMN missions.spec_documents IS 'Array of uploaded document metadata: [{name, url, type, size}]';
COMMENT ON COLUMN missions.audit_report IS 'Structured audit findings from Mach analysis';
COMMENT ON COLUMN missions.business_context IS 'Revenue model, user metrics, business constraints';
