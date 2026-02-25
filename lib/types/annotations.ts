/**
 * Types pour le module d'annotations cartographiques.
 * Points (icônes techniques), lignes (câbles), et ancre bâtiment.
 */

// ============================================================================
// CONSTANTES
// ============================================================================

export const ANNOTATION_TYPES = ["point", "line", "anchor"] as const;
export type AnnotationType = (typeof ANNOTATION_TYPES)[number];

export const POINT_SUBTYPES = [
  "transfo",
  "pdl",
  "photo",
  "incendie",
  "eau",
  "eaux_pluviales",
  "maison",
  "batiment_existant",
  "acces",
  "proprio",
  "voisin",
] as const;
export type PointSubtype = (typeof POINT_SUBTYPES)[number];

export const LINE_SUBTYPES = ["cable"] as const;
export type LineSubtype = (typeof LINE_SUBTYPES)[number];

export const ANCHOR_SUBTYPES = ["batiment"] as const;
export type AnchorSubtype = (typeof ANCHOR_SUBTYPES)[number];

export type AnnotationSubtype = PointSubtype | LineSubtype | AnchorSubtype;

// ============================================================================
// PALETTE ICONS
// ============================================================================

export interface PaletteItem {
  subtype: PointSubtype;
  emoji: string;
  label: string;
}

export const PALETTE_ITEMS: PaletteItem[] = [
  { subtype: "transfo", emoji: "⚡", label: "Transfo" },
  { subtype: "pdl", emoji: "🔌", label: "PDL" },
  { subtype: "photo", emoji: "📷", label: "Photo" },
  { subtype: "incendie", emoji: "🚒", label: "Incendie" },
  { subtype: "eau", emoji: "💧", label: "Bâche eau" },
  { subtype: "eaux_pluviales", emoji: "🌧", label: "Évac. EP" },
  { subtype: "maison", emoji: "🏠", label: "Maison" },
  { subtype: "batiment_existant", emoji: "🏭", label: "Bâtiment" },
  { subtype: "acces", emoji: "🛣", label: "Accès" },
  { subtype: "proprio", emoji: "🔑", label: "Proprio" },
  { subtype: "voisin", emoji: "🏠", label: "Voisin" },
];

/** Emoji lookup for all subtypes (including anchor/line) */
export const SUBTYPE_EMOJI: Record<AnnotationSubtype, string> = {
  transfo: "⚡",
  pdl: "🔌",
  photo: "📷",
  incendie: "🚒",
  eau: "💧",
  eaux_pluviales: "🌧",
  maison: "🏠",
  batiment_existant: "🏭",
  acces: "🛣",
  proprio: "🔑",
  voisin: "🏠",
  batiment: "🏗",
  cable: "🔗",
};

/** Label lookup for all subtypes */
export const SUBTYPE_LABEL: Record<AnnotationSubtype, string> = {
  transfo: "Transfo",
  pdl: "PDL",
  photo: "Photo",
  incendie: "Incendie",
  eau: "Bâche eau",
  eaux_pluviales: "Évac. EP",
  maison: "Maison",
  batiment_existant: "Bâtiment",
  acces: "Accès",
  proprio: "Proprio",
  voisin: "Voisin",
  batiment: "Bâtiment",
  cable: "Câble",
};

// ============================================================================
// GEOMETRY
// ============================================================================

/** GeoJSON Point */
export interface GeoJSONPoint {
  type: "Point";
  coordinates: [number, number]; // [lng, lat]
}

/** GeoJSON LineString */
export interface GeoJSONLineString {
  type: "LineString";
  coordinates: [number, number][]; // [[lng, lat], ...]
}

export type AnnotationGeometry = GeoJSONPoint | GeoJSONLineString;

// ============================================================================
// ANNOTATION ROW (DB)
// ============================================================================

export interface MapAnnotationRow {
  id: string;
  project_id: string;
  type: AnnotationType;
  subtype: AnnotationSubtype;
  geometry: AnnotationGeometry;
  linked_start_id: string | null;
  linked_end_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

// ============================================================================
// INPUTS
// ============================================================================

export interface CreatePointInput {
  projectId: string;
  subtype: PointSubtype;
  lat: number;
  lng: number;
  metadata?: Record<string, unknown>;
}

export interface CreateLineInput {
  projectId: string;
  coordinates: [number, number][]; // [[lng, lat], ...]
  linkedStartId: string | null;
  linkedEndId: string | null;
  metadata?: Record<string, unknown>;
}

export interface CreateAnchorInput {
  projectId: string;
  lat: number;
  lng: number;
}

export interface UpdatePointPositionInput {
  id: string;
  lat: number;
  lng: number;
}

export interface UpdateLineGeometryInput {
  id: string;
  coordinates: [number, number][]; // [[lng, lat], ...]
}

export interface UpdateAnnotationMetadataInput {
  id: string;
  metadata: Record<string, unknown>;
}

// ============================================================================
// ANNOTATION TOOL MODE
// ============================================================================

export type AnnotationToolMode =
  | { type: "idle" }
  | { type: "place"; subtype: PointSubtype }
  | { type: "draw-line"; startId: string; vertices: [number, number][] }; // vertices: [lat, lng]

// ============================================================================
// DISTANCE UTILS
// ============================================================================

/**
 * Calculate distance in metres between two lat/lng points (haversine).
 */
export function haversineDistanceAnnotation(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Calculate total length of a polyline in metres.
 * Coordinates are [lng, lat] (GeoJSON order).
 */
export function polylineLengthMetres(coords: [number, number][]): number {
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    const prev = coords[i - 1]!;
    const curr = coords[i]!;
    total += haversineDistanceAnnotation(prev[1], prev[0], curr[1], curr[0]);
  }
  return total;
}

/**
 * Format distance for display.
 */
export function formatAnnotationDistance(metres: number): string {
  if (metres < 1000) {
    return `${Math.round(metres)} m`;
  }
  return `${(metres / 1000).toFixed(2)} km`;
}
