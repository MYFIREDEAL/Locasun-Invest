/**
 * Service Enedis - Server-only
 * Interroge les datasets Enedis Open Data via l'API Data-Fair (Koumoul)
 * sur opendata.enedis.fr pour récupérer postes HTA/BT, lignes BT et HTA.
 *
 * Datasets (slugs sur opendata.enedis.fr):
 * - Postes HTA/BT: "poste-electrique"
 * - Lignes BT aérien: "reseau-bt"
 * - Lignes BT souterrain: "reseau-souterrain-bt"
 * - Lignes HTA aérien: "reseau-hta"
 * - Lignes HTA souterrain: "reseau-souterrain-hta"
 *
 * API: GET /data-fair/api/v1/datasets/{slug}/lines?bbox=minLon,minLat,maxLon,maxLat&size=N
 * Le champ "geometry" est un GeoJSON stringifié (Point ou LineString).
 */

import type {
  EnedisPoste,
  EnedisLigne,
  LineInstallationType,
} from "@/lib/types/enedis";

// ============================================================================
// CONFIGURATION
// ============================================================================

/** Base URL de l'API Data-Fair Enedis */
const ENEDIS_BASE_URL = "https://opendata.enedis.fr/data-fair/api/v1";

/** Timeout des requêtes HTTP (ms) */
const REQUEST_TIMEOUT_MS = 15000;

/** Nombre max de résultats par requête */
const MAX_RESULTS = 100;

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Calcule la BBOX autour d'un point (lat, lon) pour un rayon donné en mètres.
 * Retourne [minLon, minLat, maxLon, maxLat]
 */
export function computeBbox(
  lat: number,
  lon: number,
  radiusM: number
): [number, number, number, number] {
  const dLat = radiusM / 111320;
  const dLon = radiusM / (111320 * Math.cos(lat * Math.PI / 180));
  return [
    lon - dLon, // minLon
    lat - dLat, // minLat
    lon + dLon, // maxLon
    lat + dLat, // maxLat
  ];
}

/**
 * Effectue une requête vers l'API Data-Fair Enedis avec BBOX et gestion du timeout.
 */
async function fetchEnedisApi(
  datasetSlug: string,
  bbox: [number, number, number, number],
  size: number = MAX_RESULTS
): Promise<Record<string, unknown>[]> {
  const bboxStr = bbox.join(",");
  const url = `${ENEDIS_BASE_URL}/datasets/${datasetSlug}/lines?bbox=${bboxStr}&size=${size}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
      redirect: "follow",
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`Enedis API ${datasetSlug}: HTTP ${response.status} — ${text.slice(0, 200)}`);
    }

    const data = (await response.json()) as { total?: number; results?: Record<string, unknown>[] };
    return data.results ?? [];
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Parse un champ "geometry" GeoJSON stringifié et retourne les coordonnées.
 */
function parseGeometry(raw: unknown): { type: string; coordinates: unknown } | null {
  if (!raw) return null;
  try {
    const geo = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (geo && geo.type && geo.coordinates) return geo;
    return null;
  } catch {
    return null;
  }
}

// ============================================================================
// POSTES HTA/BT
// ============================================================================

/**
 * Récupère les postes de distribution publique (HTA/BT) autour d'un point.
 * Dataset: "poste-electrique"
 * Géométrie: Point dans le champ "geometry" (stringifié)
 */
export async function fetchPostes(
  bbox: [number, number, number, number]
): Promise<EnedisPoste[]> {
  try {
    const results = await fetchEnedisApi("poste-electrique", bbox, MAX_RESULTS);

    return results.map((r, i) => {
      const geo = parseGeometry(r.geometry);
      let coords: [number, number] = [0, 0];
      if (geo?.type === "Point") {
        const c = geo.coordinates as [number, number];
        coords = [c[0], c[1]]; // [lon, lat]
      }

      // Construire un nom lisible à partir des champs disponibles
      const name = (r.nom_commune as string) || `Poste ${i + 1}`;
      const subtype = "Poste HTA/BT";

      return {
        id: (r._id as string) || `poste-${i}`,
        type: "poste" as const,
        name,
        subtype,
        coordinates: coords,
        raw: r,
      };
    });
  } catch (err) {
    console.error("[Enedis] Erreur fetch postes:", err);
    return [];
  }
}

// ============================================================================
// LIGNES (générique)
// ============================================================================

/**
 * Récupère des lignes (BT ou HTA, aérien ou souterrain) à partir d'un dataset.
 * La géométrie est un LineString dans le champ "geometry".
 */
async function fetchLignes(
  datasetSlug: string,
  bbox: [number, number, number, number],
  type: "ligne_bt" | "ligne_hta",
  installation: LineInstallationType,
  prefix: string
): Promise<EnedisLigne[]> {
  try {
    const results = await fetchEnedisApi(datasetSlug, bbox, MAX_RESULTS);

    return results.map((r, i) => {
      const geo = parseGeometry(r.geometry);
      let coordinates: [number, number][] = [];
      if (geo?.type === "LineString") {
        coordinates = geo.coordinates as [number, number][];
      } else if (geo?.type === "MultiLineString") {
        // Aplatir les multi-lignes en une seule liste de segments
        const multi = geo.coordinates as [number, number][][];
        coordinates = multi.flat();
      }

      return {
        id: (r._id as string) || `${prefix}-${i}`,
        type,
        installation,
        coordinates,
        raw: r,
      };
    });
  } catch (err) {
    console.error(`[Enedis] Erreur fetch ${prefix}:`, err);
    return [];
  }
}

// ============================================================================
// AGRÉGATEUR PRINCIPAL
// ============================================================================

export interface EnedisNetworkData {
  postes: EnedisPoste[];
  lignesBt: EnedisLigne[];
  lignesHta: EnedisLigne[];
  bbox: [number, number, number, number];
  timestamp: string;
  errors: string[];
}

/**
 * Récupère l'ensemble du réseau Enedis autour d'un point.
 * Exécute toutes les requêtes en parallèle pour de meilleures performances.
 */
export async function fetchEnedisNetwork(
  lat: number,
  lon: number,
  radiusM: number
): Promise<EnedisNetworkData> {
  const bbox = computeBbox(lat, lon, radiusM);
  const errors: string[] = [];

  // Lancer toutes les requêtes en parallèle
  const [
    postesResult,
    btAerienResult,
    btEnterreResult,
    htaAerienResult,
    htaEnterreResult,
  ] = await Promise.allSettled([
    fetchPostes(bbox),
    fetchLignes("reseau-bt", bbox, "ligne_bt", "aerien", "bt-aerien"),
    fetchLignes("reseau-souterrain-bt", bbox, "ligne_bt", "enterre", "bt-enterre"),
    fetchLignes("reseau-hta", bbox, "ligne_hta", "aerien", "hta-aerien"),
    fetchLignes("reseau-souterrain-hta", bbox, "ligne_hta", "enterre", "hta-enterre"),
  ]);

  const extract = <T>(result: PromiseSettledResult<T[]>, label: string): T[] => {
    if (result.status === "fulfilled") return result.value;
    errors.push(`${label}: ${result.reason}`);
    return [];
  };

  const postes = extract(postesResult, "Postes");
  const btAerien = extract(btAerienResult, "Lignes BT aérien");
  const btEnterre = extract(btEnterreResult, "Lignes BT enterré");
  const htaAerien = extract(htaAerienResult, "Lignes HTA aérien");
  const htaEnterre = extract(htaEnterreResult, "Lignes HTA enterré");

  return {
    postes,
    lignesBt: [...btAerien, ...btEnterre],
    lignesHta: [...htaAerien, ...htaEnterre],
    bbox,
    timestamp: new Date().toISOString(),
    errors,
  };
}
