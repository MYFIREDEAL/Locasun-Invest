-- ============================================================================
-- Migration: Map Annotations
-- Description: Table for map annotation points, lines, and building anchor
-- ============================================================================

-- ============================================================================
-- TABLE: map_annotations
-- Description: Annotations cartographiques (icônes, câbles, ancre bâtiment)
-- ============================================================================
CREATE TABLE map_annotations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('point', 'line', 'anchor')),
  subtype TEXT NOT NULL CHECK (subtype IN (
    'transfo', 'pdl', 'photo', 'incendie', 'eau', 'eaux_pluviales',
    'maison', 'batiment_existant', 'acces', 'batiment', 'cable'
  )),
  geometry JSONB NOT NULL,
  linked_start_id UUID REFERENCES map_annotations(id) ON DELETE SET NULL,
  linked_end_id UUID REFERENCES map_annotations(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_map_annotations_project_id ON map_annotations(project_id);
CREATE INDEX idx_map_annotations_type ON map_annotations(type);
CREATE INDEX idx_map_annotations_linked_start ON map_annotations(linked_start_id);
CREATE INDEX idx_map_annotations_linked_end ON map_annotations(linked_end_id);

-- ============================================================================
-- RLS: map_annotations
-- Same org-isolation as projects (via project_id → projects.org_id)
-- ============================================================================
ALTER TABLE map_annotations ENABLE ROW LEVEL SECURITY;

-- SELECT: Users can view annotations for projects in their org
CREATE POLICY "Users can view annotations in their org projects"
  ON map_annotations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = map_annotations.project_id
        AND p.org_id = public.user_org_id()
    )
  );

-- INSERT: Users can create annotations for projects in their org
CREATE POLICY "Users can create annotations in their org projects"
  ON map_annotations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = map_annotations.project_id
        AND p.org_id = public.user_org_id()
    )
  );

-- UPDATE: Users can update annotations for projects in their org
CREATE POLICY "Users can update annotations in their org projects"
  ON map_annotations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = map_annotations.project_id
        AND p.org_id = public.user_org_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = map_annotations.project_id
        AND p.org_id = public.user_org_id()
    )
  );

-- DELETE: Users can delete annotations for projects in their org
CREATE POLICY "Users can delete annotations in their org projects"
  ON map_annotations FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = map_annotations.project_id
        AND p.org_id = public.user_org_id()
    )
  );

-- Comment
COMMENT ON TABLE map_annotations IS 'Annotations cartographiques: icônes techniques, câbles, ancre bâtiment';
