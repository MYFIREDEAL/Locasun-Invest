-- Add share_token column to projects for public sharing of offres pages
-- Token is a random 12-char base62 string, unique, nullable (generated on demand)

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS share_token text UNIQUE;

-- Index for fast lookup by share_token
CREATE INDEX IF NOT EXISTS idx_projects_share_token
  ON projects (share_token)
  WHERE share_token IS NOT NULL;
