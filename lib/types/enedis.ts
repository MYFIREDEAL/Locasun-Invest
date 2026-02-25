/**
 * Types pour le module cartographique réseau Enedis
 * Postes HTA/BT, lignes BT, lignes HTA avec géométrie complète
 */

// ============================================================================
// TYPES RÉSEAU
// ============================================================================

export type NetworkElementType = "poste" | "ligne_bt" | "ligne_hta";
export type LineInstallationType = "aerien" | "enterre" | "inconnu";

/** Un poste de transformation HTA/BT */
export interface EnedisPoste {
  id: string;
  type: "poste";
  /** Nom ou identifiant du poste */
  name: string;
  /** Type détaillé (ex: "Poste HTA/BT", "Poste source", etc.) */
  subtype: string;
  /** Coordonnées [lon, lat] */
  coordinates: [number, number];
  /** Distance au centroïde du bâtiment (m), calculée côté client */
  distanceM?: number;
  /** Données brutes supplémentaires */
  raw?: Record<string, unknown>;
}

/** Une ligne de réseau (BT ou HTA) */
export interface EnedisLigne {
  id: string;
  type: "ligne_bt" | "ligne_hta";
  /** Type d'installation: aérien ou enterré */
  installation: LineInstallationType;
  /** Géométrie LineString [[lon, lat], ...] */
  coordinates: [number, number][];
  /** Données brutes supplémentaires */
  raw?: Record<string, unknown>;
}

export type EnedisElement = EnedisPoste | EnedisLigne;

// ============================================================================
// API REQUEST / RESPONSE
// ============================================================================

export interface EnedisNetworkRequest {
  lat: number;
  lon: number;
  /** Rayon de recherche en mètres (défaut: 2000) */
  radius?: number;
}

export interface EnedisNetworkResponse {
  success: true;
  data: {
    postes: EnedisPoste[];
    lignesBt: EnedisLigne[];
    lignesHta: EnedisLigne[];
    bbox: [number, number, number, number]; // [minLon, minLat, maxLon, maxLat]
    timestamp: string;
  };
}

export interface EnedisNetworkError {
  success: false;
  error: string;
  /** true si l'erreur vient de l'indisponibilité de l'API Enedis */
  isUpstreamError?: boolean;
}

export type EnedisNetworkResult = EnedisNetworkResponse | EnedisNetworkError;

// ============================================================================
// CONTEXTE ENEDIS (stocké en base)
// ============================================================================

export interface EnedisNearestPoste {
  id: string;
  name: string;
  subtype: string;
  coordinates: [number, number];
  distanceM: number;
}

export interface EnedisContext {
  /** Poste le plus proche */
  nearestPoste: EnedisNearestPoste | null;
  /** Distance au poste le plus proche (m) */
  distanceM: number | null;
  /** Résumé du réseau chargé */
  summary: {
    postesCount: number;
    lignesBtCount: number;
    lignesHtaCount: number;
    radiusM: number;
  };
  /** Horodatage de la requête */
  timestamp: string;
}

// ============================================================================
// UI STATE
// ============================================================================

export interface EnedisLayerVisibility {
  postes: boolean;
  lignesBt: boolean;
  lignesHta: boolean;
}

export const DEFAULT_ENEDIS_VISIBILITY: EnedisLayerVisibility = {
  postes: true,
  lignesBt: true,
  lignesHta: true,
};

export const DEFAULT_ENEDIS_RADIUS = 2000; // mètres

// ============================================================================
// COULEURS ET STYLES
// ============================================================================

export const ENEDIS_COLORS = {
  poste: "#dc2626",        // rouge
  btAerien: "#16a34a",     // vert plein
  btEnterre: "#16a34a",    // vert pointillé
  htaAerien: "#2563eb",    // bleu plein
  htaEnterre: "#2563eb",   // bleu pointillé
} as const;

export const ENEDIS_DASH_PATTERNS = {
  aerien: undefined,              // trait plein
  enterre: "8, 6" as const,      // pointillé
} as const;
