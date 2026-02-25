-- Migration: Ajouter les champs de localisation et orientation du bâtiment
-- Date: 2026-01-27

-- ============================================================================
-- AJOUT DES CHAMPS DE LOCALISATION À building_configs
-- ============================================================================

-- Centroïde du bâtiment (point GPS)
ALTER TABLE building_configs 
ADD COLUMN IF NOT EXISTS centroid_lat DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS centroid_lon DOUBLE PRECISION;

-- Orientation du bâtiment (angle du faîtage par rapport au nord, 0-360°)
-- 0° = faîtage orienté Nord-Sud, 90° = faîtage orienté Est-Ouest
ALTER TABLE building_configs 
ADD COLUMN IF NOT EXISTS orientation_deg DOUBLE PRECISION DEFAULT 0;

-- Azimuts des pans (calculés depuis orientation)
-- Pan A = pan "gauche" quand on regarde vers le Nord
-- Pan B = pan "droit" quand on regarde vers le Nord
-- Pour un bâtiment SYM avec faîtage Est-Ouest: Pan A = Sud (180°), Pan B = Nord (0°)
ALTER TABLE building_configs 
ADD COLUMN IF NOT EXISTS azimuth_pan_a_deg DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS azimuth_pan_b_deg DOUBLE PRECISION;

-- Polygon de l'emprise au sol (GeoJSON format stocké en JSONB)
-- Contient les 4 coins du bâtiment + fermeture
ALTER TABLE building_configs 
ADD COLUMN IF NOT EXISTS polygon JSONB;

-- ============================================================================
-- COMMENTAIRES
-- ============================================================================

COMMENT ON COLUMN building_configs.centroid_lat IS 'Latitude du centre du bâtiment (WGS84)';
COMMENT ON COLUMN building_configs.centroid_lon IS 'Longitude du centre du bâtiment (WGS84)';
COMMENT ON COLUMN building_configs.orientation_deg IS 'Orientation du faîtage en degrés (0=N-S, 90=E-O, 0-360)';
COMMENT ON COLUMN building_configs.azimuth_pan_a_deg IS 'Azimut du Pan A en degrés (0-360, 0=Nord)';
COMMENT ON COLUMN building_configs.azimuth_pan_b_deg IS 'Azimut du Pan B en degrés (0-360, 0=Nord), NULL si monopente';
COMMENT ON COLUMN building_configs.polygon IS 'Emprise au sol en GeoJSON (type Polygon)';

-- ============================================================================
-- INDEX POUR RECHERCHE GÉOSPATIALE (basique sans PostGIS)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_building_configs_location 
ON building_configs (centroid_lat, centroid_lon) 
WHERE centroid_lat IS NOT NULL AND centroid_lon IS NOT NULL;
