-- Migration: Table pvgis_results pour stocker les calculs PVGIS
-- Date: 2026-01-27

-- ============================================================================
-- TABLE PVGIS_RESULTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS pvgis_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  
  -- Hash des inputs pour le cache (évite les appels redondants)
  input_hash TEXT NOT NULL,
  
  -- Snapshot des inputs au moment du calcul (pour audit et debug)
  inputs JSONB NOT NULL,
  
  -- Résultat complet PVGIS
  result JSONB NOT NULL,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Contrainte d'unicité: un seul résultat par hash par projet
  UNIQUE(project_id, input_hash)
);

-- ============================================================================
-- INDEX
-- ============================================================================

-- Index pour recherche par projet
CREATE INDEX IF NOT EXISTS idx_pvgis_results_project 
ON pvgis_results(project_id);

-- Index pour recherche par hash (cache lookup)
CREATE INDEX IF NOT EXISTS idx_pvgis_results_hash 
ON pvgis_results(project_id, input_hash);

-- ============================================================================
-- TRIGGER UPDATED_AT
-- ============================================================================

CREATE OR REPLACE FUNCTION update_pvgis_results_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_pvgis_results_updated_at ON pvgis_results;
CREATE TRIGGER trigger_pvgis_results_updated_at
  BEFORE UPDATE ON pvgis_results
  FOR EACH ROW
  EXECUTE FUNCTION update_pvgis_results_updated_at();

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE pvgis_results ENABLE ROW LEVEL SECURITY;

-- Policy: Les utilisateurs ne peuvent voir que les résultats de leur organisation
CREATE POLICY pvgis_results_select_policy ON pvgis_results
  FOR SELECT
  USING (
    project_id IN (
      SELECT p.id FROM projects p
      JOIN profiles pr ON pr.org_id = p.org_id
      WHERE pr.user_id = auth.uid()
    )
  );

-- Policy: Insertion uniquement pour les projets de l'organisation
CREATE POLICY pvgis_results_insert_policy ON pvgis_results
  FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT p.id FROM projects p
      JOIN profiles pr ON pr.org_id = p.org_id
      WHERE pr.user_id = auth.uid()
    )
  );

-- Policy: Mise à jour uniquement pour les projets de l'organisation
CREATE POLICY pvgis_results_update_policy ON pvgis_results
  FOR UPDATE
  USING (
    project_id IN (
      SELECT p.id FROM projects p
      JOIN profiles pr ON pr.org_id = p.org_id
      WHERE pr.user_id = auth.uid()
    )
  );

-- Policy: Suppression uniquement pour les admins
CREATE POLICY pvgis_results_delete_policy ON pvgis_results
  FOR DELETE
  USING (
    project_id IN (
      SELECT p.id FROM projects p
      JOIN profiles pr ON pr.org_id = p.org_id
      WHERE pr.user_id = auth.uid() AND pr.role = 'admin'
    )
  );

-- ============================================================================
-- COMMENTAIRES
-- ============================================================================

COMMENT ON TABLE pvgis_results IS 'Résultats de calcul PVGIS (production solaire) par projet';
COMMENT ON COLUMN pvgis_results.input_hash IS 'Hash des inputs pour cache (évite appels redondants si config inchangée)';
COMMENT ON COLUMN pvgis_results.inputs IS 'Snapshot des inputs: lat, lon, pans (azimuth, tilt, kwc), loss';
COMMENT ON COLUMN pvgis_results.result IS 'Résultat complet: pans[], totals, rawResponses';
