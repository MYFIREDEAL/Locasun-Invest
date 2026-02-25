-- ============================================================================
-- Migration: Initial Schema Setup
-- Description: Create core tables with multi-tenant RLS and workflow status
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- ============================================================================
-- TABLE: organizations
-- Description: Multi-tenant organizations
-- ============================================================================
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_organizations_created_at ON organizations(created_at);

-- ============================================================================
-- TABLE: profiles
-- Description: User profiles with organization membership and role
-- ============================================================================
CREATE TABLE profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'pro', 'partner', 'client')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_profiles_org_id ON profiles(org_id);
CREATE INDEX idx_profiles_role ON profiles(role);

-- ============================================================================
-- TABLE: projects
-- Description: Projects with workflow status and multi-tenant access control
-- ============================================================================
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('PRO_SERVICE', 'CLIENT_SELF_SERVICE')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'accepted', 'rejected', 'returned')),
  created_by_role TEXT NOT NULL CHECK (created_by_role IN ('pro', 'client')),
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_to_org_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  
  -- Decision fields
  decision_reason_code TEXT,
  decision_comment TEXT,
  decided_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_projects_org_id ON projects(org_id);
CREATE INDEX idx_projects_owner_user_id ON projects(owner_user_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_mode ON projects(mode);
CREATE INDEX idx_projects_assigned_to_org_id ON projects(assigned_to_org_id);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TABLE: building_rulesets
-- Description: Building configuration rulesets (org-specific or global)
-- ============================================================================
CREATE TABLE building_rulesets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE, -- NULL for global rulesets
  version INT NOT NULL DEFAULT 1,
  name TEXT NOT NULL,
  json JSONB NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT unique_org_name_version UNIQUE (org_id, name, version)
);

CREATE INDEX idx_building_rulesets_org_id ON building_rulesets(org_id);
CREATE INDEX idx_building_rulesets_active ON building_rulesets(active);

-- ============================================================================
-- TABLE: building_configs
-- Description: Building configurations for projects
-- ============================================================================
CREATE TABLE building_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  family_type TEXT NOT NULL,
  params JSONB NOT NULL DEFAULT '{}',
  derived JSONB NOT NULL DEFAULT '{}',
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_building_configs_project_id ON building_configs(project_id);

-- ============================================================================
-- TABLE: implantations
-- Description: Geographic implantation data with PostGIS
-- ============================================================================
CREATE TABLE implantations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  polygon GEOGRAPHY(POLYGON, 4326),
  centroid GEOGRAPHY(POINT, 4326),
  azimuth_building_deg NUMERIC(5, 2),
  azimuth_pan_a_deg NUMERIC(5, 2),
  azimuth_pan_b_deg NUMERIC(5, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT azimuth_building_range CHECK (azimuth_building_deg >= 0 AND azimuth_building_deg < 360),
  CONSTRAINT azimuth_pan_a_range CHECK (azimuth_pan_a_deg >= 0 AND azimuth_pan_a_deg < 360),
  CONSTRAINT azimuth_pan_b_range CHECK (azimuth_pan_b_deg >= 0 AND azimuth_pan_b_deg < 360)
);

CREATE INDEX idx_implantations_project_id ON implantations(project_id);
CREATE INDEX idx_implantations_polygon ON implantations USING GIST(polygon);
CREATE INDEX idx_implantations_centroid ON implantations USING GIST(centroid);

-- ============================================================================
-- TABLE: pvgis_results
-- Description: PVGIS API results cache
-- ============================================================================
CREATE TABLE pvgis_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  inputs JSONB NOT NULL DEFAULT '{}',
  annual JSONB NOT NULL DEFAULT '{}',
  monthly JSONB NOT NULL DEFAULT '{}',
  raw JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pvgis_results_project_id ON pvgis_results(project_id);

-- ============================================================================
-- TABLE: enedis_context
-- Description: Enedis network context data
-- ============================================================================
CREATE TABLE enedis_context (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  nearest JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_enedis_context_project_id ON enedis_context(project_id);

-- ============================================================================
-- TABLE: integrations
-- Description: Third-party integrations configuration per organization
-- ============================================================================
CREATE TABLE integrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT unique_org_integration_type UNIQUE (org_id, type)
);

CREATE INDEX idx_integrations_org_id ON integrations(org_id);
CREATE INDEX idx_integrations_type ON integrations(type);
CREATE INDEX idx_integrations_enabled ON integrations(enabled);

-- ============================================================================
-- TABLE: integration_runs
-- Description: Integration execution logs
-- ============================================================================
CREATE TABLE integration_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'success', 'failed')),
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_integration_runs_project_id ON integration_runs(project_id);
CREATE INDEX idx_integration_runs_integration_id ON integration_runs(integration_id);
CREATE INDEX idx_integration_runs_status ON integration_runs(status);

-- ============================================================================
-- TABLE: project_snapshots
-- Description: Project state snapshots for history/versioning
-- ============================================================================
CREATE TABLE project_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  snapshot JSONB NOT NULL DEFAULT '{}',
  snapshot_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_project_snapshots_project_id ON project_snapshots(project_id);
CREATE INDEX idx_project_snapshots_hash ON project_snapshots(snapshot_hash);
CREATE INDEX idx_project_snapshots_created_at ON project_snapshots(created_at);
