import { z } from "zod";

// ============================================================================
// TYPES DE BÂTIMENT
// ============================================================================

/**
 * 8 types de structure de bâtiment
 * - SYM: Symétrique (2 pans égaux)
 * - ASYM1: Asymétrique 1 zone (sans poteau intermédiaire)
 * - ASYM2: Asymétrique 2 zones (avec poteau intermédiaire)
 * - MONO: Monopente (1 seul pan)
 * - VL_LEFT: Vélum gauche
 * - VL_RIGHT: Vélum droit
 * - VL_DOUBLE: Double vélum
 * - PL: Plat
 */
export const BUILDING_TYPES = [
  "SYM",
  "ASYM1", 
  "ASYM2",
  "MONO",
  "VL_LEFT",
  "VL_RIGHT",
  "VL_DOUBLE",
  "PL",
] as const;

export type BuildingType = (typeof BUILDING_TYPES)[number];

export const BUILDING_TYPE_LABELS: Record<BuildingType, string> = {
  SYM: "Symétrique",
  ASYM1: "Asymétrique 1 zone",
  ASYM2: "Asymétrique 2 zones",
  MONO: "Monopente",
  VL_LEFT: "Ombrière VL simple gauche",
  VL_RIGHT: "Ombrière VL simple droite",
  VL_DOUBLE: "Ombrière VL double",
  PL: "Ombrière PL",
};

// ============================================================================
// EXTENSIONS (auvent, appentis)
// ============================================================================

export const EXTENSION_TYPES = ["none", "auvent", "appentis"] as const;
export type ExtensionType = (typeof EXTENSION_TYPES)[number];

export const EXTENSION_LABELS: Record<ExtensionType, string> = {
  none: "Aucune",
  auvent: "Auvent",
  appentis: "Appentis",
};

// ============================================================================
// COULEURS DE STRUCTURE (poteaux, pannes, contreventements)
// ============================================================================

export const STRUCTURE_COLORS = [
  "#1a1a1a",  // Noir
  "#374151",  // Gris anthracite
  "#6b7280",  // Gris
  "#f5f5f4",  // Blanc cassé
  "#78350f",  // Marron RAL 8017
  "#1e3a5f",  // Bleu RAL 5010
  "#065f46",  // Vert RAL 6005
] as const;

export type StructureColor = (typeof STRUCTURE_COLORS)[number];

export const STRUCTURE_COLOR_LABELS: Record<StructureColor, string> = {
  "#1a1a1a": "Noir",
  "#374151": "Gris anthracite",
  "#6b7280": "Gris",
  "#f5f5f4": "Blanc cassé",
  "#78350f": "Marron (RAL 8017)",
  "#1e3a5f": "Bleu (RAL 5010)",
  "#065f46": "Vert (RAL 6005)",
};

export const DEFAULT_STRUCTURE_COLOR: StructureColor = "#1a1a1a";

// ============================================================================
// ESPACEMENTS TRAVÉE AUTORISÉS
// ============================================================================

export const ALLOWED_SPACINGS = [6, 7.5] as const;
export type AllowedSpacing = (typeof ALLOWED_SPACINGS)[number];

// ============================================================================
// CONSTANTES PANNEAUX SOLAIRES
// ============================================================================

/**
 * Dimensions et puissance des panneaux solaires
 * Surface de rampant exacte pour PVGIS, ratio calibré Nelson par type
 */
export const PANEL_SPECS = {
  powerWc: 465,           // Puissance par panneau (Wc)
  width: 1.134,           // Largeur panneau (m)
  height: 2.278,          // Hauteur panneau (m) - portrait
  // Ratio par défaut (sera override par type si besoin)
  surfacePerPanelM2: 2.45,
} as const;

/**
 * Ratio surface rampant / panneau par type de bâtiment
 * Calibré sur les données Nelson pour coller à ±5 panneaux
 * Note: Nelson affiche parfois surface au sol, nous utilisons surface rampant
 */
export const PANEL_RATIO_BY_TYPE: Record<BuildingType, number> = {
  SYM: 2.20,        // 457m² rampant / 208 panneaux = 2.20 (Nelson: 96.72 kWc)
  ASYM1: 2.45,      // 510m² / 208 panneaux = 2.45
  ASYM2: 2.17,      // 903.6m² / 416 panneaux = 2.17
  MONO: 2.45,       // Standard (similaire ASYM1)
  VL_LEFT: 2.20,    // Ombrières: ratio similaire à SYM
  VL_RIGHT: 2.20,
  VL_DOUBLE: 2.20,
  PL: 2.17,         // Similaire à ASYM2 (structure avec poteau)
};

// ============================================================================
// LARGEURS AUTORISÉES PAR TYPE
// ============================================================================

export const WIDTHS_BY_TYPE: Record<BuildingType, readonly number[]> = {
  SYM: [15, 18.6, 22.3, 26, 29.8, 33.5],
  ASYM1: [16.4, 20],
  ASYM2: [25.5, 29.1],
  MONO: [12.7, 16.4],
  VL_LEFT: [6.9],
  VL_RIGHT: [6.9],
  VL_DOUBLE: [9.1, 11.3],
  PL: [15.8, 20.2, 24.6],
} as const;

// Pour compatibilité, on garde une liste globale
export const DEFAULT_WIDTHS = [6.9, 9.1, 11.3, 12.7, 15, 15.8, 16.4, 18.6, 20, 20.2, 22.3, 24.6, 25.5, 26, 29.1, 29.8, 33.5] as const;

// ============================================================================
// PENTES FIXES PAR TYPE (en degrés)
// ============================================================================

export const SLOPE_BY_TYPE: Record<BuildingType, number> = {
  SYM: 10,
  ASYM1: 15,
  ASYM2: 15,
  MONO: 15,
  VL_LEFT: 10,
  VL_RIGHT: 10,
  VL_DOUBLE: 10,
  PL: 10,
};

// ============================================================================
// HAUTEUR SABLIÈRE (ÉGOUT) PAR TYPE (en mètres)
// ============================================================================

export const SABLIERE_BY_TYPE: Record<BuildingType, number | null> = {
  SYM: 5.5,
  ASYM1: 4,
  ASYM2: 4,
  MONO: 4,
  VL_LEFT: null,  // Ombrière: pas de sablière standard
  VL_RIGHT: null,
  VL_DOUBLE: null,
  PL: null,
};

// Pour les sélecteurs (si on veut quand même proposer des choix)
export const ALLOWED_SABLIERE_HEIGHTS = [3, 3.5, 4, 4.5, 5, 5.5, 6, 7, 8] as const;
export const ALLOWED_FAITAGE_HEIGHTS = [4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

// ============================================================================
// POSITION DES POTEAUX INTERMÉDIAIRES
// ============================================================================

export const POLE_POSITIONS = ["center", "left", "right", "both", "offset_left", "offset_right"] as const;
export type PolePosition = (typeof POLE_POSITIONS)[number];

export const POLE_POSITION_LABELS: Record<PolePosition, string> = {
  center: "Centre",
  left: "Gauche",
  right: "Droite",
  both: "Gauche et droite",
  offset_left: "Décalé gauche (sous faîtage)",
  offset_right: "Décalé droite (sous faîtage)",
};

// ============================================================================
// CONTRAINTES PAR TYPE
// ============================================================================

interface TypeConstraints {
  hasTwoPans: boolean;                    // A 2 pans (A et B)
  hasSlope: boolean;                      // Nécessite une pente
  allowsExtensions: boolean;              // Autorise auvent/appentis
  panARatio?: number;                     // Ratio pan A (ex: 0.75 pour ASYM1)
  panBRatio?: number;                     // Ratio pan B
  requiresIntermediatePoles?: boolean;    // Poteaux intermédiaires obligatoires
  optionalIntermediatePoles?: boolean;    // Poteaux intermédiaires optionnels (selon largeur)
  polePosition?: PolePosition;            // Position des poteaux intermédiaires
}

export const TYPE_CONSTRAINTS: Record<BuildingType, TypeConstraints> = {
  SYM: { 
    hasTwoPans: true, 
    hasSlope: true, 
    allowsExtensions: false,          // Pas d'extensions sur symétrique
    panARatio: 0.5,
    panBRatio: 0.5,
    optionalIntermediatePoles: true,  // Optionnel si largeur > 20m
    polePosition: "center",
  },
  ASYM1: { 
    hasTwoPans: true,                 // 2 pans asymétriques (petit Nord + grand Sud)
    hasSlope: true, 
    allowsExtensions: true,           // Auvent/Appentis autorisés
    // Les ratios sont calculés dynamiquement à partir des hauteurs de variante
    panARatio: 0.23,                  // ~3.73m / 16.4m (calculé depuis hauteurs)
    panBRatio: 0.77,                  // ~12.69m / 16.4m
    optionalIntermediatePoles: false, // Pas de poteau pour ASYM1
    polePosition: undefined,
  },
  ASYM2: { 
    hasTwoPans: true, 
    hasSlope: true, 
    allowsExtensions: true,           // Auvent/Appentis autorisés
    panARatio: 0.514,                 // 13.1 / 25.5 ≈ 51.4%
    panBRatio: 0.486,                 // 12.4 / 25.5 ≈ 48.6%
    requiresIntermediatePoles: true,  // Poteau obligatoire (2 zones)
    polePosition: "center",
  },
  MONO: { 
    hasTwoPans: false, 
    hasSlope: true, 
    allowsExtensions: true,           // Auvent/Appentis autorisés
    panARatio: 1,
    panBRatio: 0,
    optionalIntermediatePoles: false, // Pas de poteau
    polePosition: undefined,
  },
  VL_LEFT: { 
    hasTwoPans: false,                // Ombrière = 1 seul pan incliné
    hasSlope: true, 
    allowsExtensions: false,
    panARatio: 1,
    panBRatio: 0,
    requiresIntermediatePoles: true,  // Poteaux sur un côté
    polePosition: "left",
  },
  VL_RIGHT: { 
    hasTwoPans: false,                // Ombrière = 1 seul pan incliné
    hasSlope: true, 
    allowsExtensions: false,
    panARatio: 1,
    panBRatio: 0,
    requiresIntermediatePoles: true,  // Poteaux sur un côté
    polePosition: "right",
  },
  VL_DOUBLE: { 
    hasTwoPans: false,                // Ombrière double = 1 pan avec 2 rangées de poteaux
    hasSlope: true, 
    allowsExtensions: false,
    panARatio: 1,
    panBRatio: 0,
    requiresIntermediatePoles: true,  // 2 rangées de poteaux
    polePosition: "both",
  },
  PL: { 
    hasTwoPans: false,                // Ombrière plate = 1 pan horizontal
    hasSlope: true,                   // Légère pente (10°) pour écoulement
    allowsExtensions: false,
    panARatio: 1,
    panBRatio: 0,
    requiresIntermediatePoles: true,  // Poteaux intermédiaires
    polePosition: "center",
  },
};

// ============================================================================
// SCHEMA ZOD POUR LES PARAMÈTRES DE CONFIGURATION
// ============================================================================

export const buildingParamsSchema = z.object({
  type: z.enum(BUILDING_TYPES),
  width: z.number().min(6).max(50),
  spacing: z.union([
    z.literal(6),
    z.literal(7.5),
    z.enum(["6", "7.5"]).transform((v) => parseFloat(v)),
  ]),
  nbSpans: z.number().int().min(1).max(20),
  heightSabliereLeft: z.number().min(2).max(12),   // Hauteur sablière gauche (m)
  heightSabliereRight: z.number().min(2).max(12),  // Hauteur sablière droite (m)
  heightFaitage: z.number().min(3).max(15),        // Hauteur faîtage (m)
  extensionLeft: z.enum(EXTENSION_TYPES).default("none"),
  extensionRight: z.enum(EXTENSION_TYPES).default("none"),
  extensionLeftWidth: z.number().min(0).max(10).default(0),
  extensionRightWidth: z.number().min(0).max(10).default(0),
  // Couleur de la structure (poteaux, pannes, contreventements)
  structureColor: z.string().default("#1a1a1a"),
});

export type BuildingParams = z.infer<typeof buildingParamsSchema>;

// ============================================================================
// SCHEMA ZOD POUR LES VALEURS DÉRIVÉES (calculées)
// ============================================================================

export const buildingDerivedSchema = z.object({
  length: z.number(),              // nbSpans * spacing
  totalWidth: z.number(),          // width + extensions
  slopeAngle: z.number(),          // Pente de référence (degrés)
  // Position du faîtage (CLEF pour asymétriques)
  faitagePosition: z.number(),     // Distance faîtage depuis bord gauche (m)
  // Largeurs des pans au sol
  panWidthA: z.number(),           // Largeur pan A au sol (m) - droite/grand pour ASYM
  panWidthB: z.number(),           // Largeur pan B au sol (m) - gauche/petit pour ASYM
  // Delta hauteurs (pour vérification)
  heightDeltaPanA: z.number(),     // Δh pan A = faîtage - sablière droite
  heightDeltaPanB: z.number(),     // Δh pan B = faîtage - sablière gauche
  // Rampants calculés avec Pythagore
  rampantPanA: z.number(),         // Longueur rampant pan A (m) = √(largeur² + Δh²)
  rampantPanB: z.number(),         // Longueur rampant pan B (m)
  // Surfaces
  surfacePanA: z.number(),         // Surface du pan A (m²)
  surfacePanB: z.number(),         // Surface du pan B (0 si mono/plat)
  surfaceTotal: z.number(),        // Surface totale toiture
  // Poteaux
  hasIntermediatePoles: z.boolean(), // A des poteaux intermédiaires
  nbIntermediatePoles: z.number(),   // Nombre de poteaux intermédiaires
  polePosition: z.enum(POLE_POSITIONS).nullable(), // Position des poteaux
  poleOffsetFromLeft: z.number().nullable(), // Distance depuis le bord gauche (m)
  poteauPosition: z.number().nullable(), // Position du poteau intermédiaire depuis la gauche (m) - pour ASYM2
  zonePvA: z.boolean(),            // Zone PV disponible sur pan A
  zonePvB: z.boolean(),            // Zone PV disponible sur pan B
  rulesetVersion: z.string(),      // Version du ruleset utilisé
  // Calculs PV par pan
  nbPanelsPanA: z.number(),        // Nombre de panneaux pan A
  nbPanelsPanB: z.number(),        // Nombre de panneaux pan B (0 si mono)
  powerKwcPanA: z.number(),        // Puissance pan A (kWc)
  powerKwcPanB: z.number(),        // Puissance pan B (kWc)
  // Totaux PV
  nbPanels: z.number(),            // Nombre total de panneaux
  powerKwc: z.number(),            // Puissance crête totale (kWc)
});

export type BuildingDerived = z.infer<typeof buildingDerivedSchema>;

// ============================================================================
// SCHEMA COMPLET POUR BUILDING_CONFIG
// ============================================================================

export const buildingConfigSchema = z.object({
  params: buildingParamsSchema,
  derived: buildingDerivedSchema,
});

export type BuildingConfig = z.infer<typeof buildingConfigSchema>;

// ============================================================================
// SCHEMA POUR LA TABLE building_configs
// ============================================================================

export interface BuildingConfigRow {
  id: string;
  project_id: string;
  params: BuildingParams;
  derived: BuildingDerived;
  // Champs de localisation
  centroid_lat: number | null;
  centroid_lon: number | null;
  orientation_deg: number | null;
  azimuth_pan_a_deg: number | null;
  azimuth_pan_b_deg: number | null;
  polygon: GeoJSONPolygon | null;
  /** Cache des données parcellaires (ParcelleInfo sérialisé en JSON) */
  parcelle_data: import("@/lib/types/parcelle").ParcelleInfo | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// TYPES GÉOLOCALISATION
// ============================================================================

/**
 * Polygon GeoJSON pour l'emprise au sol
 */
export interface GeoJSONPolygon {
  type: "Polygon";
  coordinates: [number, number][][]; // [[[lon, lat], ...]]
}

/**
 * Données de localisation du bâtiment
 */
export interface BuildingLocation {
  centroidLat: number;
  centroidLon: number;
  orientationDeg: number;        // 0-360, orientation du faîtage (0=N-S)
  azimuthPanADeg: number;        // Azimut du pan A (perpendiculaire au faîtage)
  azimuthPanBDeg: number | null; // Azimut du pan B (null si monopente)
  polygon: GeoJSONPolygon;       // Emprise au sol
}

/**
 * Calcule les azimuts des pans depuis l'orientation du faîtage
 * 
 * Convention:
 * - orientationDeg = angle du faîtage par rapport au Nord (0° = faîtage N-S)
 * - Pan A = perpendiculaire gauche = orientation + 90°
 * - Pan B = perpendiculaire droite = orientation - 90° (ou +270°)
 * 
 * Exemple: faîtage E-O (90°) → Pan A = 180° (Sud), Pan B = 0° (Nord)
 */
export function calculatePanAzimuths(
  orientationDeg: number,
  hasTwoPans: boolean
): { azimuthPanA: number; azimuthPanB: number | null } {
  // Normaliser l'orientation entre 0 et 360
  const normalized = ((orientationDeg % 360) + 360) % 360;
  
  // Pan A = perpendiculaire "gauche" du faîtage (+ 90°)
  const azimuthPanA = (normalized + 90) % 360;
  
  // Pan B = perpendiculaire "droite" du faîtage (- 90° = + 270°)
  const azimuthPanB = hasTwoPans ? (normalized + 270) % 360 : null;
  
  return { azimuthPanA, azimuthPanB };
}
