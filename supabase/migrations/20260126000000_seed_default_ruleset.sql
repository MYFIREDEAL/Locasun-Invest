-- ============================================================================
-- Migration: Seed Default Ruleset
-- Description: Insert a default global ruleset for building configuration
-- ============================================================================

-- Insert default global ruleset (org_id = NULL means global)
INSERT INTO building_rulesets (id, org_id, version, name, json, active) VALUES (
  'default0-rule-set0-0000-000000000001',
  NULL,  -- Global ruleset
  1,
  'Ruleset Standard v1',
  '{
    "name": "Ruleset Standard",
    "description": "Configuration par défaut pour hangars solaires",
    "families": [
      {
        "key": "hangar_agricole",
        "label": "Hangar Agricole",
        "description": "Bâtiment agricole avec toiture photovoltaïque",
        "params": [
          {
            "key": "largeur",
            "label": "Largeur",
            "type": "select",
            "unit": "m",
            "options": [
              {"value": 12, "label": "12 m"},
              {"value": 15, "label": "15 m"},
              {"value": 18, "label": "18 m"},
              {"value": 20, "label": "20 m", "default": true},
              {"value": 24, "label": "24 m"}
            ]
          },
          {
            "key": "longueur",
            "label": "Longueur",
            "type": "select",
            "unit": "m",
            "options": [
              {"value": 20, "label": "20 m"},
              {"value": 30, "label": "30 m"},
              {"value": 40, "label": "40 m", "default": true},
              {"value": 50, "label": "50 m"},
              {"value": 60, "label": "60 m"}
            ]
          },
          {
            "key": "hauteur_faitage",
            "label": "Hauteur au faîtage",
            "type": "select",
            "unit": "m",
            "options": [
              {"value": 6, "label": "6 m"},
              {"value": 7, "label": "7 m", "default": true},
              {"value": 8, "label": "8 m"},
              {"value": 9, "label": "9 m"}
            ]
          },
          {
            "key": "pente_toiture",
            "label": "Pente de toiture",
            "type": "select",
            "unit": "°",
            "options": [
              {"value": 10, "label": "10°"},
              {"value": 12, "label": "12°"},
              {"value": 15, "label": "15°", "default": true},
              {"value": 18, "label": "18°"}
            ]
          },
          {
            "key": "type_couverture",
            "label": "Type de couverture",
            "type": "select",
            "options": [
              {"value": "bac_acier", "label": "Bac acier", "default": true},
              {"value": "fibrociment", "label": "Fibrociment"},
              {"value": "tuiles", "label": "Tuiles mécaniques"}
            ]
          },
          {
            "key": "double_pente",
            "label": "Double pente équipée",
            "type": "boolean",
            "defaultValue": false
          }
        ]
      },
      {
        "key": "hangar_industriel",
        "label": "Hangar Industriel",
        "description": "Bâtiment industriel grande surface",
        "params": [
          {
            "key": "largeur",
            "label": "Largeur",
            "type": "select",
            "unit": "m",
            "options": [
              {"value": 20, "label": "20 m"},
              {"value": 25, "label": "25 m"},
              {"value": 30, "label": "30 m", "default": true},
              {"value": 40, "label": "40 m"}
            ]
          },
          {
            "key": "longueur",
            "label": "Longueur",
            "type": "select",
            "unit": "m",
            "options": [
              {"value": 40, "label": "40 m"},
              {"value": 60, "label": "60 m", "default": true},
              {"value": 80, "label": "80 m"},
              {"value": 100, "label": "100 m"}
            ]
          },
          {
            "key": "hauteur_sous_ferme",
            "label": "Hauteur sous ferme",
            "type": "select",
            "unit": "m",
            "options": [
              {"value": 6, "label": "6 m"},
              {"value": 8, "label": "8 m", "default": true},
              {"value": 10, "label": "10 m"},
              {"value": 12, "label": "12 m"}
            ]
          },
          {
            "key": "pente_toiture",
            "label": "Pente de toiture",
            "type": "select",
            "unit": "°",
            "options": [
              {"value": 5, "label": "5°"},
              {"value": 8, "label": "8°", "default": true},
              {"value": 10, "label": "10°"}
            ]
          }
        ]
      }
    ]
  }'::jsonb,
  true
) ON CONFLICT (id) DO NOTHING;
