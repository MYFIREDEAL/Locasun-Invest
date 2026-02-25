-- Migration: Add finance_state and finance_snapshot JSONB columns to projects
-- These store the editable finance parameters and the validated KPI snapshot

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS finance_state   JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS finance_snapshot JSONB DEFAULT NULL;

-- Comment for documentation
COMMENT ON COLUMN projects.finance_state IS 'FinanceState JSONB — editable finance parameters (tariffs, costs, inflation). NULL = not yet configured.';
COMMENT ON COLUMN projects.finance_snapshot IS 'FinanceSnapshot JSONB — frozen KPIs computed at finance step validation. NULL = not yet validated.';
