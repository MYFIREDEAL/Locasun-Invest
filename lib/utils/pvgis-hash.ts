/**
 * Hash PVGIS — Server-only
 * Utilise Node `crypto` (ne peut pas être importé côté client).
 */

import { sha256 } from "@/lib/utils/hash";
import { canonicalizePanParams, type PvgisPanParams } from "@/lib/types/pvgis";

/**
 * Génère un hash SHA-256 déterministe pour les params d'un pan PVGIS.
 * Utilisé comme clé de cache dans pvgis_cache.params_hash.
 */
export function computePanParamsHash(params: PvgisPanParams): string {
  const canonical = canonicalizePanParams(params);
  return sha256(canonical);
}
