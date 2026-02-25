-- Migration: Building Pricing Table
-- Description: Store building pricing grid (tarifs charpente + couverture + fondations)
-- Source: grille Nelson Énergies 2025

-- TABLE: building_pricing
CREATE TABLE building_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE, -- NULL for global pricing
  type TEXT NOT NULL,                    -- Building type (SYM, ASYM1, ASYM2, etc.)
  width DECIMAL(10,2) NOT NULL,          -- Width in meters (code interne)
  spacing DECIMAL(10,2) NOT NULL DEFAULT 7.5, -- Entraxe travées (m)
  nb_spans INTEGER NOT NULL,             -- Nombre de travées
  kwc DECIMAL(10,2) NOT NULL,            -- kWc correspondant (pour vérification)
  tarif INTEGER NOT NULL,                -- Tarif sans PV en € (fondations + charpente + couverture)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique constraint: one price per type+width+nbSpans per org (or global)
  UNIQUE(org_id, type, width, nb_spans)
);

-- Index for fast lookups
CREATE INDEX idx_building_pricing_type_width ON building_pricing(type, width);
CREATE INDEX idx_building_pricing_org_id ON building_pricing(org_id);

-- RLS policies
ALTER TABLE building_pricing ENABLE ROW LEVEL SECURITY;

-- Everyone can read global pricing (org_id IS NULL)
CREATE POLICY "Users can view global pricing"
  ON building_pricing FOR SELECT
  USING (org_id IS NULL);

-- Users can view their org's pricing
CREATE POLICY "Users can view org pricing"
  ON building_pricing FOR SELECT
  USING (org_id IN (
    SELECT org_id FROM profiles WHERE user_id = auth.uid()
  ));

-- Admins can manage org pricing
CREATE POLICY "Admins can manage org pricing"
  ON building_pricing FOR ALL
  USING (org_id IN (
    SELECT org_id FROM profiles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
  ));

-- Super admins can manage global pricing
CREATE POLICY "Super admins can manage global pricing"
  ON building_pricing FOR ALL
  USING (
    org_id IS NULL AND EXISTS (
      SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'super_admin'
    )
  );

-- Trigger for updated_at
CREATE TRIGGER update_building_pricing_updated_at
  BEFORE UPDATE ON building_pricing
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Seed default global pricing from Nelson Énergies 2025 grid

-- ASYM1 16.4m (O01-O13)
INSERT INTO building_pricing (org_id, type, width, spacing, nb_spans, kwc, tarif) VALUES
  (NULL, 'ASYM1', 16.4, 7.5, 4,  96,  57288),
  (NULL, 'ASYM1', 16.4, 7.5, 5,  126, 68777),
  (NULL, 'ASYM1', 16.4, 7.5, 6,  151, 80452),
  (NULL, 'ASYM1', 16.4, 7.5, 7,  175, 92127),
  (NULL, 'ASYM1', 16.4, 7.5, 8,  199, 103630),
  (NULL, 'ASYM1', 16.4, 7.5, 9,  229, 115305),
  (NULL, 'ASYM1', 16.4, 7.5, 10, 253, 127820),
  (NULL, 'ASYM1', 16.4, 7.5, 11, 278, 139495),
  (NULL, 'ASYM1', 16.4, 7.5, 12, 302, 150985),
  (NULL, 'ASYM1', 16.4, 7.5, 13, 332, 162488),
  (NULL, 'ASYM1', 16.4, 7.5, 14, 356, 176705),
  (NULL, 'ASYM1', 16.4, 7.5, 15, 380, 188380),
  (NULL, 'ASYM1', 16.4, 7.5, 16, 405, 200055);

-- ASYM1 20m (O14-O26)
INSERT INTO building_pricing (org_id, type, width, spacing, nb_spans, kwc, tarif) VALUES
  (NULL, 'ASYM1', 20, 7.5, 4,  120, 69598),
  (NULL, 'ASYM1', 20, 7.5, 5,  156, 83948),
  (NULL, 'ASYM1', 20, 7.5, 6,  186, 98469),
  (NULL, 'ASYM1', 20, 7.5, 7,  215, 113659),
  (NULL, 'ASYM1', 20, 7.5, 8,  245, 128366),
  (NULL, 'ASYM1', 20, 7.5, 9,  282, 142888),
  (NULL, 'ASYM1', 20, 7.5, 10, 312, 157238),
  (NULL, 'ASYM1', 20, 7.5, 11, 342, 171759),
  (NULL, 'ASYM1', 20, 7.5, 12, 372, 186109),
  (NULL, 'ASYM1', 20, 7.5, 13, 409, 200816),
  (NULL, 'ASYM1', 20, 7.5, 14, 438, 217969),
  (NULL, 'ASYM1', 20, 7.5, 15, 468, 233159),
  (NULL, 'ASYM1', 20, 7.5, 16, 498, 247680);

-- ASYM2 25.5m (O27-O35)
INSERT INTO building_pricing (org_id, type, width, spacing, nb_spans, kwc, tarif) VALUES
  (NULL, 'ASYM2', 25.5, 7.5, 4,  156, 100498),
  (NULL, 'ASYM2', 25.5, 7.5, 5,  199, 120820),
  (NULL, 'ASYM2', 25.5, 7.5, 6,  240, 141143),
  (NULL, 'ASYM2', 25.5, 7.5, 7,  282, 161465),
  (NULL, 'ASYM2', 25.5, 7.5, 8,  324, 181788),
  (NULL, 'ASYM2', 25.5, 7.5, 9,  366, 202110),
  (NULL, 'ASYM2', 25.5, 7.5, 10, 408, 222433),
  (NULL, 'ASYM2', 25.5, 7.5, 11, 450, 242755),
  (NULL, 'ASYM2', 25.5, 7.5, 12, 492, 263078);

-- ASYM2 29.1m (O36-O42)
INSERT INTO building_pricing (org_id, type, width, spacing, nb_spans, kwc, tarif) VALUES
  (NULL, 'ASYM2', 29.1, 7.5, 4,  180, 116597),
  (NULL, 'ASYM2', 29.1, 7.5, 5,  228, 140434),
  (NULL, 'ASYM2', 29.1, 7.5, 6,  276, 164270),
  (NULL, 'ASYM2', 29.1, 7.5, 7,  324, 188107),
  (NULL, 'ASYM2', 29.1, 7.5, 8,  372, 211943),
  (NULL, 'ASYM2', 29.1, 7.5, 9,  420, 235780),
  (NULL, 'ASYM2', 29.1, 7.5, 10, 468, 259616);

-- SYM 15m (H01-H13)
INSERT INTO building_pricing (org_id, type, width, spacing, nb_spans, kwc, tarif) VALUES
  (NULL, 'SYM', 15, 7.5, 4,  90,  51990),
  (NULL, 'SYM', 15, 7.5, 5,  117, 62325),
  (NULL, 'SYM', 15, 7.5, 6,  144, 72661),
  (NULL, 'SYM', 15, 7.5, 7,  171, 82996),
  (NULL, 'SYM', 15, 7.5, 8,  198, 93331),
  (NULL, 'SYM', 15, 7.5, 9,  225, 103667),
  (NULL, 'SYM', 15, 7.5, 10, 252, 114002),
  (NULL, 'SYM', 15, 7.5, 11, 279, 124338),
  (NULL, 'SYM', 15, 7.5, 12, 306, 134673),
  (NULL, 'SYM', 15, 7.5, 13, 333, 145008),
  (NULL, 'SYM', 15, 7.5, 14, 360, 155344),
  (NULL, 'SYM', 15, 7.5, 15, 388, 165679),
  (NULL, 'SYM', 15, 7.5, 16, 415, 176015);

-- SYM 18.6m (H14-H26)
INSERT INTO building_pricing (org_id, type, width, spacing, nb_spans, kwc, tarif) VALUES
  (NULL, 'SYM', 18.6, 7.5, 4,  114, 62018),
  (NULL, 'SYM', 18.6, 7.5, 5,  148, 74619),
  (NULL, 'SYM', 18.6, 7.5, 6,  176, 87051),
  (NULL, 'SYM', 18.6, 7.5, 7,  210, 99484),
  (NULL, 'SYM', 18.6, 7.5, 8,  244, 111916),
  (NULL, 'SYM', 18.6, 7.5, 9,  272, 124349),
  (NULL, 'SYM', 18.6, 7.5, 10, 306, 136781),
  (NULL, 'SYM', 18.6, 7.5, 11, 340, 149214),
  (NULL, 'SYM', 18.6, 7.5, 12, 368, 161646),
  (NULL, 'SYM', 18.6, 7.5, 13, 402, 174079),
  (NULL, 'SYM', 18.6, 7.5, 14, 436, 186511),
  (NULL, 'SYM', 18.6, 7.5, 15, 464, 198944),
  (NULL, 'SYM', 18.6, 7.5, 16, 498, 211376);

-- SYM 22.35m (H27-H37)
INSERT INTO building_pricing (org_id, type, width, spacing, nb_spans, kwc, tarif) VALUES
  (NULL, 'SYM', 22.3, 7.5, 4,  138, 74709),
  (NULL, 'SYM', 22.3, 7.5, 5,  176, 89899),
  (NULL, 'SYM', 22.3, 7.5, 6,  214, 105089),
  (NULL, 'SYM', 22.3, 7.5, 7,  252, 120279),
  (NULL, 'SYM', 22.3, 7.5, 8,  290, 135469),
  (NULL, 'SYM', 22.3, 7.5, 9,  328, 150659),
  (NULL, 'SYM', 22.3, 7.5, 10, 366, 165849),
  (NULL, 'SYM', 22.3, 7.5, 11, 404, 181039),
  (NULL, 'SYM', 22.3, 7.5, 12, 442, 196229),
  (NULL, 'SYM', 22.3, 7.5, 13, 480, 211419),
  (NULL, 'SYM', 22.3, 7.5, 14, 518, 226609);

-- SYM 26.05m (H38-H46)
INSERT INTO building_pricing (org_id, type, width, spacing, nb_spans, kwc, tarif) VALUES
  (NULL, 'SYM', 26, 7.5, 4,  162, 87225),
  (NULL, 'SYM', 26, 7.5, 5,  208, 105175),
  (NULL, 'SYM', 26, 7.5, 6,  252, 123125),
  (NULL, 'SYM', 26, 7.5, 7,  296, 141075),
  (NULL, 'SYM', 26, 7.5, 8,  340, 159025),
  (NULL, 'SYM', 26, 7.5, 9,  384, 176975),
  (NULL, 'SYM', 26, 7.5, 10, 428, 194925),
  (NULL, 'SYM', 26, 7.5, 11, 472, 212875),
  (NULL, 'SYM', 26, 7.5, 12, 516, 230825);

-- SYM 29.75m (H47-H54)
INSERT INTO building_pricing (org_id, type, width, spacing, nb_spans, kwc, tarif) VALUES
  (NULL, 'SYM', 29.8, 7.5, 4,  186, 99916),
  (NULL, 'SYM', 29.8, 7.5, 5,  238, 120349),
  (NULL, 'SYM', 29.8, 7.5, 6,  290, 140783),
  (NULL, 'SYM', 29.8, 7.5, 7,  342, 161216),
  (NULL, 'SYM', 29.8, 7.5, 8,  394, 181649),
  (NULL, 'SYM', 29.8, 7.5, 9,  446, 202083),
  (NULL, 'SYM', 29.8, 7.5, 10, 498, 222516),
  (NULL, 'SYM', 29.8, 7.5, 11, 550, 242949);

-- SYM 33.46m (H55-H61)
INSERT INTO building_pricing (org_id, type, width, spacing, nb_spans, kwc, tarif) VALUES
  (NULL, 'SYM', 33.5, 7.5, 4,  210, 114831),
  (NULL, 'SYM', 33.5, 7.5, 5,  268, 138828),
  (NULL, 'SYM', 33.5, 7.5, 6,  326, 162825),
  (NULL, 'SYM', 33.5, 7.5, 7,  384, 186822),
  (NULL, 'SYM', 33.5, 7.5, 8,  442, 210819),
  (NULL, 'SYM', 33.5, 7.5, 9,  500, 234816),
  (NULL, 'SYM', 33.5, 7.5, 10, 558, 276651);
