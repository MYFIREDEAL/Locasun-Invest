-- ============================================================================
-- Migration: Owned Parcelles
-- Description: Parcelles possédées par le client (ajoutées manuellement
--              via picking carte ou toggle sur parcelles secondaires)
-- ============================================================================

CREATE TABLE owned_parcelles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  
  -- Identifiant cadastral unique (ex: "403290000D0519")
  idu TEXT NOT NULL,
  
  -- Source : 'manual' = ajoutée par clic carte, 'secondary' = toggle sur parcelle secondaire
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'secondary')),
  
  -- Données cadastrales (propriétés APICarto)
  cadastre_props JSONB NOT NULL,
  
  -- Géométrie GeoJSON MultiPolygon (nullable pour les secondaires dont la géo est déjà dans parcelle.info)
  geometry JSONB,
  
  -- Zone urbanisme PLU (nullable)
  zone_urba JSONB,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Un IDU par projet maximum
  CONSTRAINT owned_parcelles_project_idu_unique UNIQUE (project_id, idu)
);

-- Index pour recherche par projet
CREATE INDEX idx_owned_parcelles_project ON owned_parcelles(project_id);

-- ============================================================================
-- RLS Policies — même pattern que map_annotations (org-isolation via project_id)
-- ============================================================================
ALTER TABLE owned_parcelles ENABLE ROW LEVEL SECURITY;

-- SELECT: Users can view owned parcelles for projects in their org
CREATE POLICY "owned_parcelles_select" ON owned_parcelles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      JOIN profiles pr ON pr.org_id = p.org_id
      WHERE p.id = owned_parcelles.project_id
      AND pr.user_id = auth.uid()
    )
  );

-- INSERT: Users can add owned parcelles to projects in their org
CREATE POLICY "owned_parcelles_insert" ON owned_parcelles FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects p
      JOIN profiles pr ON pr.org_id = p.org_id
      WHERE p.id = owned_parcelles.project_id
      AND pr.user_id = auth.uid()
    )
  );

-- DELETE: Users can remove owned parcelles from projects in their org (draft/returned)
CREATE POLICY "owned_parcelles_delete" ON owned_parcelles FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      JOIN profiles pr ON pr.org_id = p.org_id
      WHERE p.id = owned_parcelles.project_id
      AND pr.user_id = auth.uid()
      AND p.status IN ('draft', 'returned')
    )
  );
