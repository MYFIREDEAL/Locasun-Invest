-- ============================================================================
-- Table building_configs
-- Stocke les configurations de bâtiment pour chaque projet
-- ============================================================================

CREATE TABLE building_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  params JSONB NOT NULL,
  derived JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Une seule config par projet
  CONSTRAINT building_configs_project_unique UNIQUE (project_id)
);

-- Index pour recherche par projet
CREATE INDEX idx_building_configs_project ON building_configs(project_id);

-- ============================================================================
-- RLS Policies
-- ============================================================================

ALTER TABLE building_configs ENABLE ROW LEVEL SECURITY;

-- Lecture: membre de l'org du projet
CREATE POLICY "building_configs_select" ON building_configs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      JOIN profiles pr ON pr.org_id = p.org_id
      WHERE p.id = building_configs.project_id
      AND pr.user_id = auth.uid()
    )
  );

-- Insertion: membre de l'org du projet
CREATE POLICY "building_configs_insert" ON building_configs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects p
      JOIN profiles pr ON pr.org_id = p.org_id
      WHERE p.id = building_configs.project_id
      AND pr.user_id = auth.uid()
    )
  );

-- Mise à jour: membre de l'org + projet en draft/returned
CREATE POLICY "building_configs_update" ON building_configs FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      JOIN profiles pr ON pr.org_id = p.org_id
      WHERE p.id = building_configs.project_id
      AND pr.user_id = auth.uid()
      AND p.status IN ('draft', 'returned')
    )
  );

-- Suppression: membre de l'org + projet en draft
CREATE POLICY "building_configs_delete" ON building_configs FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      JOIN profiles pr ON pr.org_id = p.org_id
      WHERE p.id = building_configs.project_id
      AND pr.user_id = auth.uid()
      AND p.status = 'draft'
    )
  );
