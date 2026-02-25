-- Migration: Building Variants Table
-- Description: Store building variant configurations (heights, positions per type+width)

-- TABLE: building_variants
CREATE TABLE building_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE, -- NULL for global variants
  type TEXT NOT NULL,                    -- Building type (SYM, ASYM1, ASYM2, etc.)
  width DECIMAL(10,2) NOT NULL,          -- Width in meters
  height_sabliere_left DECIMAL(10,2) NOT NULL,   -- Left eave height (m)
  height_sabliere_right DECIMAL(10,2) NOT NULL,  -- Right eave height (m)
  height_faitage DECIMAL(10,2) NOT NULL,         -- Ridge height (m)
  faitage_position DECIMAL(10,2),        -- Ridge position from left (m) - for ASYM
  poteau_position DECIMAL(10,2),         -- Intermediate pole position from left (m) - for ASYM2
  zone_left DECIMAL(10,2),               -- Left zone width (m) - legacy
  zone_right DECIMAL(10,2),              -- Right zone width (m) - legacy
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique constraint: one variant per type+width per org (or global)
  UNIQUE(org_id, type, width)
);

-- Index for fast lookups
CREATE INDEX idx_building_variants_type_width ON building_variants(type, width);
CREATE INDEX idx_building_variants_org_id ON building_variants(org_id);

-- RLS policies
ALTER TABLE building_variants ENABLE ROW LEVEL SECURITY;

-- Everyone can read global variants (org_id IS NULL)
CREATE POLICY "Users can view global variants"
  ON building_variants FOR SELECT
  USING (org_id IS NULL);

-- Users can view their org's variants
CREATE POLICY "Users can view org variants"
  ON building_variants FOR SELECT
  USING (org_id IN (
    SELECT org_id FROM profiles WHERE user_id = auth.uid()
  ));

-- Admins can manage org variants
CREATE POLICY "Admins can manage org variants"
  ON building_variants FOR ALL
  USING (org_id IN (
    SELECT org_id FROM profiles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
  ));

-- Super admins can manage global variants
CREATE POLICY "Super admins can manage global variants"
  ON building_variants FOR ALL
  USING (
    org_id IS NULL AND EXISTS (
      SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'super_admin'
    )
  );

-- Trigger for updated_at
CREATE TRIGGER update_building_variants_updated_at
  BEFORE UPDATE ON building_variants
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Seed default global variants
INSERT INTO building_variants (org_id, type, width, height_sabliere_left, height_sabliere_right, height_faitage, faitage_position, poteau_position, zone_left, zone_right) VALUES
  -- Symétrique
  (NULL, 'SYM', 15, 5.5, 5.5, 6.8, NULL, NULL, NULL, NULL),
  (NULL, 'SYM', 18.6, 5.5, 5.5, 7.1, NULL, NULL, NULL, NULL),
  (NULL, 'SYM', 22.3, 5.5, 5.5, 7.5, NULL, NULL, NULL, NULL),
  (NULL, 'SYM', 26, 5.5, 5.5, 7.8, NULL, NULL, NULL, NULL),
  (NULL, 'SYM', 29.8, 5.5, 5.5, 8.1, NULL, NULL, NULL, NULL),
  (NULL, 'SYM', 33.5, 5.5, 5.5, 8.5, NULL, NULL, NULL, NULL),
  
  -- Asymétrique 1 zone
  (NULL, 'ASYM1', 16.4, 6.4, 4, 7.4, 3.73, NULL, NULL, NULL),
  (NULL, 'ASYM1', 20, 7.2, 4, 8.4, 4.48, NULL, NULL, NULL),
  
  -- Asymétrique 2 zones
  (NULL, 'ASYM2', 25.5, 6.9, 4, 8.9, 6.55, 6.55, 6.55, 18.95),
  (NULL, 'ASYM2', 29.1, 7.9, 4, 9.8, 6.55, 6.55, 6.55, 22.55),
  
  -- Monopente
  (NULL, 'MONO', 12.7, 7.4, 4, 7.4, NULL, NULL, NULL, NULL),
  (NULL, 'MONO', 16.4, 8.4, 4, 8.4, NULL, NULL, NULL, NULL),
  
  -- Ombrière VL simple gauche
  (NULL, 'VL_LEFT', 6.9, 4.7, 3.7, 4.7, NULL, NULL, NULL, NULL),
  
  -- Ombrière VL simple droite
  (NULL, 'VL_RIGHT', 6.9, 4.1, 2.9, 4.1, NULL, NULL, NULL, NULL),
  
  -- Ombrière VL double
  (NULL, 'VL_DOUBLE', 9.1, 4.6, 3, 4.6, NULL, NULL, NULL, NULL),
  (NULL, 'VL_DOUBLE', 11.3, 4.7, 2.8, 4.7, NULL, NULL, NULL, NULL),
  
  -- Ombrière PL
  (NULL, 'PL', 15.8, 7.9, 5.1, 7.9, 7.9, 7.9, 7.9, 7.9),
  (NULL, 'PL', 20.2, 9.3, 5.7, 9.3, 10.1, 10.1, 10.1, 10.1),
  (NULL, 'PL', 24.6, 9.3, 5, 9.3, 12.3, 12.3, 12.3, 12.3);
