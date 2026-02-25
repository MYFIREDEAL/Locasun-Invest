-- Migration: Add enedis_context column to building_configs
-- Description: Store Enedis network analysis context (nearest poste, distances, summary)

-- Add JSONB column for Enedis network context
ALTER TABLE building_configs
  ADD COLUMN IF NOT EXISTS enedis_context JSONB DEFAULT NULL;

-- Comment for documentation
COMMENT ON COLUMN building_configs.enedis_context IS 
  'Contexte réseau Enedis: poste le plus proche, distance, résumé des éléments chargés, timestamp';
