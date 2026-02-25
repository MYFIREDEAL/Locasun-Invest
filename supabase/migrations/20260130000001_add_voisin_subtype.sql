-- ============================================================================
-- Migration: Add voisin subtype
-- Description: Add 'voisin' to the subtype CHECK constraint for map_annotations
-- ============================================================================

ALTER TABLE map_annotations DROP CONSTRAINT IF EXISTS map_annotations_subtype_check;

ALTER TABLE map_annotations ADD CONSTRAINT map_annotations_subtype_check
  CHECK (subtype IN (
    'transfo', 'pdl', 'photo', 'incendie', 'eau', 'eaux_pluviales',
    'maison', 'batiment_existant', 'acces', 'batiment', 'cable', 'voisin'
  ));
