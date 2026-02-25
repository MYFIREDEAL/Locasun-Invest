-- ============================================================================
-- Migration: Row Level Security Policies
-- Description: Multi-tenant RLS with workflow-based access control
-- ============================================================================

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Get current user's organization ID
CREATE OR REPLACE FUNCTION public.user_org_id()
RETURNS UUID AS $$
  SELECT org_id FROM public.profiles WHERE user_id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER;

-- Get current user's role
CREATE OR REPLACE FUNCTION public.user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE user_id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER;

-- Check if user is admin/pro/partner (has elevated privileges)
CREATE OR REPLACE FUNCTION public.user_is_elevated()
RETURNS BOOLEAN AS $$
  SELECT role IN ('admin', 'pro', 'partner') FROM public.profiles WHERE user_id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER;

-- ============================================================================
-- RLS: organizations
-- ============================================================================
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Users can only see their own organization
CREATE POLICY "Users can view their own organization"
  ON organizations FOR SELECT
  USING (id = public.user_org_id());

-- Only admins can insert/update/delete organizations (handled via service role typically)
CREATE POLICY "Admins can manage organizations"
  ON organizations FOR ALL
  USING (public.user_role() = 'admin')
  WITH CHECK (public.user_role() = 'admin');

-- ============================================================================
-- RLS: profiles
-- ============================================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Users can view profiles in their organization
CREATE POLICY "Users can view profiles in their organization"
  ON profiles FOR SELECT
  USING (org_id = public.user_org_id());

-- Users can view their own profile
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  USING (user_id = auth.uid());

-- Only admins can manage profiles
CREATE POLICY "Admins can manage profiles"
  ON profiles FOR ALL
  USING (public.user_role() = 'admin' AND org_id = public.user_org_id())
  WITH CHECK (public.user_role() = 'admin' AND org_id = public.user_org_id());

-- ============================================================================
-- RLS: projects
-- Complex multi-tenant rules based on mode and status
-- ============================================================================
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- SELECT: Users can view projects in their org
CREATE POLICY "Users can view projects in their organization"
  ON projects FOR SELECT
  USING (org_id = public.user_org_id());

-- INSERT: Users can create projects in their org
CREATE POLICY "Users can create projects in their organization"
  ON projects FOR INSERT
  WITH CHECK (
    org_id = public.user_org_id() AND
    owner_user_id = auth.uid()
  );

-- UPDATE: Complex rules based on mode, status, and role
CREATE POLICY "Users can update projects based on workflow"
  ON projects FOR UPDATE
  USING (
    org_id = public.user_org_id() AND
    (
      -- Case 1: PRO_SERVICE mode in draft - elevated users can edit
      (mode = 'PRO_SERVICE' AND status = 'draft' AND public.user_is_elevated()) OR
      
      -- Case 2: CLIENT_SELF_SERVICE mode in draft or returned - owner can edit
      (mode = 'CLIENT_SELF_SERVICE' AND status IN ('draft', 'returned') AND owner_user_id = auth.uid()) OR
      
      -- Case 3: Submitted/accepted/rejected - elevated users can update decision fields only
      (status IN ('submitted', 'accepted', 'rejected') AND public.user_is_elevated())
    )
  )
  WITH CHECK (
    org_id = public.user_org_id() AND
    (
      -- Same conditions as USING clause
      (mode = 'PRO_SERVICE' AND status = 'draft' AND public.user_is_elevated()) OR
      (mode = 'CLIENT_SELF_SERVICE' AND status IN ('draft', 'returned') AND owner_user_id = auth.uid()) OR
      (status IN ('submitted', 'accepted', 'rejected') AND public.user_is_elevated())
    )
  );

-- DELETE: Only admins can delete projects
CREATE POLICY "Admins can delete projects"
  ON projects FOR DELETE
  USING (
    org_id = public.user_org_id() AND
    public.user_role() = 'admin'
  );

-- ============================================================================
-- RLS: building_rulesets
-- ============================================================================
ALTER TABLE building_rulesets ENABLE ROW LEVEL SECURITY;

-- Users can view rulesets for their org or global ones (org_id IS NULL)
CREATE POLICY "Users can view org and global rulesets"
  ON building_rulesets FOR SELECT
  USING (org_id = public.user_org_id() OR org_id IS NULL);

-- Elevated users can manage org rulesets
CREATE POLICY "Elevated users can manage org rulesets"
  ON building_rulesets FOR ALL
  USING (public.user_is_elevated() AND org_id = public.user_org_id())
  WITH CHECK (public.user_is_elevated() AND org_id = public.user_org_id());

-- ============================================================================
-- RLS: building_configs
-- ============================================================================
ALTER TABLE building_configs ENABLE ROW LEVEL SECURITY;

-- Users can view configs for projects they can access
CREATE POLICY "Users can view building_configs for accessible projects"
  ON building_configs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = building_configs.project_id
        AND projects.org_id = public.user_org_id()
    )
  );

-- Users can manage configs for projects they own or have access to
CREATE POLICY "Users can manage building_configs for their projects"
  ON building_configs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = building_configs.project_id
        AND projects.org_id = public.user_org_id()
        AND (
          projects.owner_user_id = auth.uid() OR
          public.user_is_elevated()
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = building_configs.project_id
        AND projects.org_id = public.user_org_id()
        AND (
          projects.owner_user_id = auth.uid() OR
          public.user_is_elevated()
        )
    )
  );

-- ============================================================================
-- RLS: implantations
-- ============================================================================
ALTER TABLE implantations ENABLE ROW LEVEL SECURITY;

-- Users can view implantations for accessible projects
CREATE POLICY "Users can view implantations for accessible projects"
  ON implantations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = implantations.project_id
        AND projects.org_id = public.user_org_id()
    )
  );

-- Users can manage implantations for their projects
CREATE POLICY "Users can manage implantations for their projects"
  ON implantations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = implantations.project_id
        AND projects.org_id = public.user_org_id()
        AND (
          projects.owner_user_id = auth.uid() OR
          public.user_is_elevated()
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = implantations.project_id
        AND projects.org_id = public.user_org_id()
        AND (
          projects.owner_user_id = auth.uid() OR
          public.user_is_elevated()
        )
    )
  );

-- ============================================================================
-- RLS: pvgis_results
-- ============================================================================
ALTER TABLE pvgis_results ENABLE ROW LEVEL SECURITY;

-- Users can view PVGIS results for accessible projects
CREATE POLICY "Users can view pvgis_results for accessible projects"
  ON pvgis_results FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = pvgis_results.project_id
        AND projects.org_id = public.user_org_id()
    )
  );

-- Only elevated users can insert PVGIS results (typically via API routes)
CREATE POLICY "Elevated users can manage pvgis_results"
  ON pvgis_results FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = pvgis_results.project_id
        AND projects.org_id = public.user_org_id()
        AND public.user_is_elevated()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = pvgis_results.project_id
        AND projects.org_id = public.user_org_id()
        AND public.user_is_elevated()
    )
  );

-- ============================================================================
-- RLS: enedis_context
-- ============================================================================
ALTER TABLE enedis_context ENABLE ROW LEVEL SECURITY;

-- Users can view Enedis context for accessible projects
CREATE POLICY "Users can view enedis_context for accessible projects"
  ON enedis_context FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = enedis_context.project_id
        AND projects.org_id = public.user_org_id()
    )
  );

-- Only elevated users can manage Enedis context
CREATE POLICY "Elevated users can manage enedis_context"
  ON enedis_context FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = enedis_context.project_id
        AND projects.org_id = public.user_org_id()
        AND public.user_is_elevated()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = enedis_context.project_id
        AND projects.org_id = public.user_org_id()
        AND public.user_is_elevated()
    )
  );

-- ============================================================================
-- RLS: integrations
-- ============================================================================
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;

-- Users can view integrations for their org
CREATE POLICY "Users can view org integrations"
  ON integrations FOR SELECT
  USING (org_id = public.user_org_id());

-- Only admins can manage integrations
CREATE POLICY "Admins can manage integrations"
  ON integrations FOR ALL
  USING (org_id = public.user_org_id() AND public.user_role() = 'admin')
  WITH CHECK (org_id = public.user_org_id() AND public.user_role() = 'admin');

-- ============================================================================
-- RLS: integration_runs
-- ============================================================================
ALTER TABLE integration_runs ENABLE ROW LEVEL SECURITY;

-- Users can view integration runs for accessible projects
CREATE POLICY "Users can view integration_runs for accessible projects"
  ON integration_runs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = integration_runs.project_id
        AND projects.org_id = public.user_org_id()
    )
  );

-- Elevated users can manage integration runs
CREATE POLICY "Elevated users can manage integration_runs"
  ON integration_runs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = integration_runs.project_id
        AND projects.org_id = public.user_org_id()
        AND public.user_is_elevated()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = integration_runs.project_id
        AND projects.org_id = public.user_org_id()
        AND public.user_is_elevated()
    )
  );

-- ============================================================================
-- RLS: project_snapshots
-- ============================================================================
ALTER TABLE project_snapshots ENABLE ROW LEVEL SECURITY;

-- Users can view snapshots for accessible projects
CREATE POLICY "Users can view snapshots for accessible projects"
  ON project_snapshots FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_snapshots.project_id
        AND projects.org_id = public.user_org_id()
    )
  );

-- All users can create snapshots (auto-generated)
CREATE POLICY "Users can create snapshots for accessible projects"
  ON project_snapshots FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_snapshots.project_id
        AND projects.org_id = public.user_org_id()
    )
  );

-- Only admins can delete snapshots
CREATE POLICY "Admins can delete snapshots"
  ON project_snapshots FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_snapshots.project_id
        AND projects.org_id = public.user_org_id()
        AND public.user_role() = 'admin'
    )
  );
