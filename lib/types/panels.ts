import { z } from "zod";

// ============================================================================
// MODÈLES DE PANNEAUX SOLAIRES
// ============================================================================

export const panelModelSchema = z.object({
  id: z.string(),
  name: z.string(),
  manufacturer: z.string(),
  length_m: z.number().min(0.5).max(3),    // Longueur du panneau (m)
  width_m: z.number().min(0.5).max(2),     // Largeur du panneau (m)
  power_w: z.number().min(100).max(1000),  // Puissance crête (W)
});

export type PanelModel = z.infer<typeof panelModelSchema>;

// ============================================================================
// BIBLIOTHÈQUE DE PANNEAUX (hardcodé pour l'instant, DB plus tard)
// ============================================================================

export const PANEL_LIBRARY: PanelModel[] = [
  // Panneau calibré pour pattern 13×8 en paysage (104 panneaux/pan = 48.36 kWc sur SYM 30×15)
  // Avec margin=0.02m, gap=0.015m, orientation=landscape, travée 7.5m, égout 5.5m
  {
    id: "nelson_standard_465",
    name: "Standard 465W (13×8)",
    manufacturer: "Nelson",
    length_m: 2.29,       // Longueur optimisée pour 13 panneaux sur 30m
    width_m: 0.93,        // Largeur optimisée pour 8 panneaux sur 7.61m rampant
    power_w: 465,
  },
  {
    id: "jinko_tiger_neo_580",
    name: "Tiger Neo 580W",
    manufacturer: "Jinko Solar",
    length_m: 2.278,
    width_m: 1.134,
    power_w: 580,
  },
  {
    id: "longi_himo6_555",
    name: "Hi-MO 6 555W",
    manufacturer: "LONGi",
    length_m: 2.278,
    width_m: 1.134,
    power_w: 555,
  },
  {
    id: "canadian_hiku7_670",
    name: "HiKu7 670W",
    manufacturer: "Canadian Solar",
    length_m: 2.384,
    width_m: 1.303,
    power_w: 670,
  },
];

// Panneau par défaut (compatible Nelson)
export const DEFAULT_PANEL_ID = "nelson_standard_465";

export function getPanelById(id: string): PanelModel | null {
  return PANEL_LIBRARY.find((p) => p.id === id) ?? null;
}

export function getDefaultPanel(): PanelModel {
  return PANEL_LIBRARY.find((p) => p.id === DEFAULT_PANEL_ID) ?? PANEL_LIBRARY[0]!;
}

// ============================================================================
// PARAMÈTRES DE CALEPINAGE
// ============================================================================

export const PANEL_ORIENTATIONS = ["auto", "portrait", "landscape"] as const;
export type PanelOrientation = (typeof PANEL_ORIENTATIONS)[number];

export const calepinageParamsSchema = z.object({
  panelId: z.string().default(DEFAULT_PANEL_ID),
  margin_m: z.number().min(0).max(1).default(0.10),    // Marge périmètre (m)
  gap_m: z.number().min(0).max(0.5).default(0.02),     // Espacement entre panneaux (m)
  orientation: z.enum(PANEL_ORIENTATIONS).default("auto"),
});

export type CalepinageParams = z.infer<typeof calepinageParamsSchema>;

export const DEFAULT_CALEPINAGE: CalepinageParams = {
  panelId: DEFAULT_PANEL_ID,
  margin_m: 0.02,        // 2 cm en périphérie (5 cm = trop conservateur)
  gap_m: 0.015,          // 1,5 cm entre modules (2 cm OK mais un peu large)
  orientation: "landscape", // PAYSAGE (horizontale) par défaut
};

// ============================================================================
// RÉSULTAT DE CALEPINAGE PAR ZONE
// ============================================================================

export const zoneCalepinageResultSchema = z.object({
  zoneName: z.string(),              // "panA" ou "panB"
  surfaceZone_m2: z.number(),        // Surface de la zone
  surfaceUtile_m2: z.number(),       // Surface utile (après marges)
  nbPanelsX: z.number(),             // Nb panneaux en largeur
  nbPanelsY: z.number(),             // Nb panneaux en longueur
  nbPanels: z.number(),              // Nb total panneaux dans la zone
  kwc: z.number(),                   // Puissance zone (kWc)
  orientationUsed: z.enum(PANEL_ORIENTATIONS), // Orientation utilisée
});

export type ZoneCalepinageResult = z.infer<typeof zoneCalepinageResultSchema>;

export const calepinageResultSchema = z.object({
  panel: panelModelSchema,
  params: calepinageParamsSchema,
  zones: z.array(zoneCalepinageResultSchema),
  panelsTotal: z.number(),
  kwcTotal: z.number(),
});

export type CalepinageResult = z.infer<typeof calepinageResultSchema>;
