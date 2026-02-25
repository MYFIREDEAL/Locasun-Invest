/**
 * Utilitaires de géométrie pour le module Enedis
 * Calcul de distances, identification du poste le plus proche, etc.
 */

const EARTH_RADIUS_M = 6371000;
const DEG_TO_RAD = Math.PI / 180;

/**
 * Calcule la distance à vol d'oiseau (Haversine) entre deux points en mètres.
 * @param lat1 Latitude point 1
 * @param lon1 Longitude point 1
 * @param lat2 Latitude point 2
 * @param lon2 Longitude point 2
 * @returns Distance en mètres
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLat = (lat2 - lat1) * DEG_TO_RAD;
  const dLon = (lon2 - lon1) * DEG_TO_RAD;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * DEG_TO_RAD) *
      Math.cos(lat2 * DEG_TO_RAD) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_M * c;
}

/**
 * Formate une distance en mètres pour l'affichage.
 * Ex: 1234 -> "1 234 m" ou 1.23 km si > 1000
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(2)} km`;
}
