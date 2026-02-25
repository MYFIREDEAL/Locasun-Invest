-- Migration: Ajouter colonne parcelle_data JSONB dans building_configs
-- Stocke le résultat complet de /api/parcelle (cadastre, PLU, risques, altitude, etc.)
-- pour éviter de refaire 7+ appels API externes à chaque visite de l'onglet Synthèse.
-- Date: 2026-02-22

ALTER TABLE building_configs
ADD COLUMN IF NOT EXISTS parcelle_data JSONB;

COMMENT ON COLUMN building_configs.parcelle_data IS 'Cache du résultat ParcelleInfo (cadastre, PLU, risques, altitude, distance océan, etc.)';
