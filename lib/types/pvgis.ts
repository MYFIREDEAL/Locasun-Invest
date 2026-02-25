import { z } from "zod";

// ============================================================================
// TYPES PVGIS - API Européenne de calcul solaire
// Documentation: https://re.jrc.ec.europa.eu/pvg_tools/en/
// ============================================================================

/**
 * Paramètres d'entrée pour un appel PVGIS (par pan)
 */
export const pvgisInputSchema = z.object({
  lat: z.number().min(-90).max(90),           // Latitude
  lon: z.number().min(-180).max(180),         // Longitude
  peakpower: z.number().min(0.1).max(10000),  // Puissance crête en kWc
  angle: z.number().min(0).max(90),           // Inclinaison en degrés
  aspect: z.number().min(-180).max(180),      // Azimut PVGIS: 0=Sud, E=-90, O=+90
  loss: z.number().min(0).max(100).default(14), // Pertes système (%)
  outputformat: z.literal("json").default("json"),
  pvtechchoice: z.enum(["crystSi", "CIS", "CdTe"]).default("crystSi"),
});

export type PvgisInput = z.infer<typeof pvgisInputSchema>;

/**
 * Données mensuelles PVGIS
 */
export interface PvgisMonthlyOutput {
  month: number;          // 1-12
  E_m: number;            // Production mensuelle (kWh)
  "H(i)_m": number;       // Irradiation mensuelle sur plan incliné (kWh/m²)
  SD_m: number;           // Écart-type mensuel
}

/**
 * Réponse brute de l'API PVGIS
 */
export interface PvgisRawResponse {
  inputs: {
    location: {
      latitude: number;
      longitude: number;
      elevation: number;
    };
    mounting_system: {
      fixed: {
        slope: { value: number };
        azimuth: { value: number };
      };
    };
    pv_module: {
      technology: string;
      peak_power: number;
      system_loss: number;
    };
  };
  outputs: {
    monthly: {
      fixed: PvgisMonthlyOutput[];
    };
    totals: {
      fixed: {
        E_y: number;        // Production annuelle (kWh/an)
        E_d: number;        // Production journalière moyenne (kWh/jour)
        "H(i)_y": number;   // Irradiation annuelle sur plan incliné (kWh/m²/an)
        SD_y: number;       // Écart-type annuel
      };
    };
  };
  meta: {
    inputs: Record<string, unknown>;
    outputs: Record<string, unknown>;
  };
}

// ============================================================================
// RÉSULTATS PAR PAN
// ============================================================================

/**
 * Résultat PVGIS pour un pan de toiture
 */
export interface PvgisPanResult {
  panId: "A" | "B";                 // Identifiant du pan
  label: string;                     // "Pan A (Sud)" etc.
  inputAzimuthDeg: number;           // Azimut 0=Nord (notre convention)
  pvgisAspect: number;               // Azimut converti PVGIS 0=Sud
  tiltDeg: number;                   // Inclinaison (pente)
  peakPowerKwc: number;              // Puissance crête du pan
  annualKwh: number;                 // Production annuelle (kWh)
  annualKwhPerKwc: number;           // Rendement (kWh/kWc)
  monthlyKwh: number[];              // Production par mois (index 0 = janvier)
  monthlyIrradiation: number[];      // Irradiation par mois (kWh/m²)
}

/**
 * Résultat complet PVGIS pour un projet
 */
export interface PvgisResult {
  projectId: string;
  calculatedAt: string;              // ISO timestamp
  location: {
    lat: number;
    lon: number;
  };
  pans: PvgisPanResult[];
  totals: {
    annualKwh: number;               // Production annuelle totale (kWh)
    peakPowerKwc: number;            // Puissance crête totale (kWc)
    annualKwhPerKwc: number;         // Rendement moyen (kWh/kWc)
    monthlyKwh: number[];            // Production mensuelle agrégée
  };
  // Pour debug/audit
  rawResponses?: Record<string, PvgisRawResponse>;
}

// ============================================================================
// STOCKAGE EN DB
// ============================================================================

/**
 * Row de la table pvgis_results (legacy — sera remplacée par pvgis_cache)
 */
export interface PvgisResultRow {
  id: string;
  project_id: string;
  input_hash: string;                // Hash des inputs pour cache
  inputs: PvgisInputsSnapshot;       // Snapshot des inputs au moment du calcul
  result: PvgisResult;               // Résultat complet
  created_at: string;
  updated_at: string;
}

/**
 * Row de la table pvgis_cache (nouvelle — 1 ligne par pan)
 *
 * PK / UNIQUE : (project_id, pan)
 * params_hash : SHA-256 de params_json → détection stale
 */
export interface PvgisCacheRow {
  id: string;
  project_id: string;
  /** Identifiant du pan ("A" | "B") */
  pan: "A" | "B";
  /** SHA-256 déterministe des params envoyés à PVGIS */
  params_hash: string;
  /** Snapshot JSON des params (pour audit / debug) */
  params_json: PvgisPanParams;
  /** Résultat JSON complet pour ce pan */
  result_json: PvgisPanResult;
  /** Production annuelle (kWh) — colonnes extraites pour requêtes SQL */
  annual_kwh: number;
  /** Rendement spécifique (kWh/kWc) */
  specific_kwh_kwc: number;
  /** Production mensuelle JSON (12 valeurs, index 0 = janvier) */
  monthly_kwh: number[];
  updated_at: string;
}

/**
 * Paramètres canoniques d'un pan pour le calcul PVGIS.
 * Sert à calculer le SHA-256 et est stocké dans params_json.
 */
export interface PvgisPanParams {
  lat: number;
  lon: number;
  azimuthDeg: number;
  tiltDeg: number;
  kwc: number;
  lossPercent: number;
}

/**
 * Snapshot des inputs pour calcul du hash et cache
 */
export interface PvgisInputsSnapshot {
  lat: number;
  lon: number;
  pans: {
    panId: "A" | "B";
    azimuthDeg: number;
    tiltDeg: number;
    kwc: number;
  }[];
  lossPercent: number;
}

// ============================================================================
// CONVERSION AZIMUT
// ============================================================================

/**
 * Convertit un azimut de notre convention (0=Nord) vers PVGIS (0=Sud)
 * 
 * Notre convention: 0° = Nord, 90° = Est, 180° = Sud, 270° = Ouest
 * Convention PVGIS: 0° = Sud, -90° = Est, +90° = Ouest, ±180° = Nord
 * 
 * Formule: aspect_pvgis = 180 - azimuth_nord (puis normaliser entre -180 et +180)
 */
export function azimuthToAspect(azimuthNorthDeg: number): number {
  // Normaliser l'input entre 0 et 360
  const normalized = ((azimuthNorthDeg % 360) + 360) % 360;
  
  // Convertir: PVGIS aspect = (azimuth - 180)
  // Car quand azimuth = 180 (Sud), aspect PVGIS = 0
  let aspect = normalized - 180;
  
  // Normaliser entre -180 et +180
  if (aspect > 180) aspect -= 360;
  if (aspect < -180) aspect += 360;
  
  return Math.round(aspect * 10) / 10; // Arrondir à 0.1°
}

/**
 * Obtient le label directionnel d'un pan
 */
export function getPanLabel(azimuthDeg: number): string {
  const normalized = ((azimuthDeg % 360) + 360) % 360;
  
  if (normalized >= 315 || normalized < 45) return "Nord";
  if (normalized >= 45 && normalized < 135) return "Est";
  if (normalized >= 135 && normalized < 225) return "Sud";
  return "Ouest";
}

// ============================================================================
// CALCUL DU HASH POUR CACHE
// ============================================================================

/**
 * Construit les params canoniques d'un pan pour le hash.
 * Les valeurs sont arrondies pour éviter les faux misses (floats).
 */
export function canonicalizePanParams(p: PvgisPanParams): PvgisPanParams {
  return {
    lat: Math.round(p.lat * 100000) / 100000,
    lon: Math.round(p.lon * 100000) / 100000,
    azimuthDeg: Math.round(p.azimuthDeg),
    tiltDeg: Math.round(p.tiltDeg * 10) / 10,
    kwc: Math.round(p.kwc * 100) / 100,
    lossPercent: Math.round(p.lossPercent),
  };
}

/**
 * Génère un hash SHA-256 déterministe des params d'un pan.
 * Utilisé pour la colonne params_hash de pvgis_cache.
 * 
 * ⚠️ Server-only (utilise Node crypto via lib/utils/hash)
 */
export { computePanParamsHash } from "@/lib/utils/pvgis-hash";

/**
 * @deprecated — Utiliser computePanParamsHash pour le cache per-pan.
 * Conservé temporairement pour la migration.
 * 
 * Génère un hash déterministe de l'ensemble des inputs (tous pans confondus).
 */
export function computeInputHash(inputs: PvgisInputsSnapshot): string {
  // Créer une chaîne déterministe
  const str = JSON.stringify({
    lat: Math.round(inputs.lat * 100000) / 100000,
    lon: Math.round(inputs.lon * 100000) / 100000,
    loss: inputs.lossPercent,
    pans: inputs.pans
      .sort((a, b) => a.panId.localeCompare(b.panId))
      .map(p => ({
        id: p.panId,
        az: Math.round(p.azimuthDeg),
        tilt: Math.round(p.tiltDeg * 10) / 10,
        kwc: Math.round(p.kwc * 100) / 100,
      })),
  });
  
  // Hash simple (pour un vrai hash, utiliser crypto)
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convertir en 32bit integer
  }
  
  return `pvgis_${Math.abs(hash).toString(16)}`;
}
