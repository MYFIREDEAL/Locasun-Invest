/**
 * Utilitaires de géométrie pour la carte 2D
 * Calcul de polygon, rotation, azimuts
 */

import type { GeoJSONPolygon, BuildingConfig } from "@/lib/types/building";
import { TYPE_CONSTRAINTS } from "@/lib/types/building";

// Constantes
const EARTH_RADIUS_M = 6371000;
const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

/**
 * Convertit des mètres en degrés de latitude
 */
export function metersToLatDeg(meters: number): number {
  return (meters / EARTH_RADIUS_M) * RAD_TO_DEG;
}

/**
 * Convertit des mètres en degrés de longitude à une latitude donnée
 */
export function metersToLonDeg(meters: number, latDeg: number): number {
  const latRad = latDeg * DEG_TO_RAD;
  return (meters / (EARTH_RADIUS_M * Math.cos(latRad))) * RAD_TO_DEG;
}

/**
 * Calcule un point à une distance et un angle donnés depuis un point central
 */
export function offsetPoint(
  centerLat: number,
  centerLon: number,
  distanceM: number,
  bearingDeg: number
): [number, number] {
  const bearingRad = bearingDeg * DEG_TO_RAD;
  
  const dLat = distanceM * Math.cos(bearingRad);
  const dLon = distanceM * Math.sin(bearingRad);
  
  const lat = centerLat + metersToLatDeg(dLat);
  const lon = centerLon + metersToLonDeg(dLon, centerLat);
  
  return [lon, lat]; // GeoJSON = [lon, lat]
}

/**
 * Génère le polygon de l'emprise au sol du bâtiment
 * 
 * @param centerLat - Latitude du centre
 * @param centerLon - Longitude du centre
 * @param width - Largeur du bâtiment (m)
 * @param length - Longueur du bâtiment (m)
 * @param orientationDeg - Orientation du faîtage (0° = N-S)
 * @returns Polygon GeoJSON avec les 4 coins
 */
export function generateBuildingPolygon(
  centerLat: number,
  centerLon: number,
  width: number,
  length: number,
  orientationDeg: number
): GeoJSONPolygon {
  // Les 4 coins sont à distance du centre
  // Le faîtage est parallèle à l'axe "longueur"
  // Orientation = angle du faîtage par rapport au Nord
  
  const halfWidth = width / 2;
  const halfLength = length / 2;
  
  // Angles des 4 coins (perpendiculaires au faîtage)
  // Coin 1: avant-gauche
  // Coin 2: avant-droit
  // Coin 3: arrière-droit
  // Coin 4: arrière-gauche
  
  // Distance du centre aux coins
  const diag = Math.sqrt(halfWidth * halfWidth + halfLength * halfLength);
  const angleOffset = Math.atan2(halfWidth, halfLength) * RAD_TO_DEG;
  
  const corners: [number, number][] = [
    offsetPoint(centerLat, centerLon, diag, orientationDeg - angleOffset),      // Avant-gauche
    offsetPoint(centerLat, centerLon, diag, orientationDeg + angleOffset),      // Avant-droit
    offsetPoint(centerLat, centerLon, diag, orientationDeg + 180 - angleOffset), // Arrière-droit
    offsetPoint(centerLat, centerLon, diag, orientationDeg + 180 + angleOffset), // Arrière-gauche
  ];
  
  // Fermer le polygon (copie du premier point)
  const closedCorners: [number, number][] = [...corners, corners[0]!];
  
  return {
    type: "Polygon",
    coordinates: [closedCorners],
  };
}

/**
 * Génère les 2 demi-polygons pour Pan A et Pan B
 * Le faîtage coupe le bâtiment au milieu dans le sens de la longueur
 * 
 * @returns [panAPolygon, panBPolygon] ou [panAPolygon, null] si monopente
 */
export function generatePanPolygons(
  centerLat: number,
  centerLon: number,
  width: number,
  length: number,
  orientationDeg: number,
  hasTwoPans: boolean,
  faitagePosition?: number // Distance du faîtage depuis le bord gauche (pour ASYM)
): { panA: GeoJSONPolygon; panB: GeoJSONPolygon | null; faitage: [number, number][] } {
  const halfLength = length / 2;
  
  // Position du faîtage (par défaut au milieu)
  const faitageFromLeft = faitagePosition ?? width / 2;
  const faitageFromRight = width - faitageFromLeft;
  
  // Points du faîtage (ligne centrale)
  const faitageStart = offsetPoint(centerLat, centerLon, halfLength, orientationDeg);
  const faitageEnd = offsetPoint(centerLat, centerLon, halfLength, orientationDeg + 180);
  
  // Décalage du centre vers le faîtage
  const centerToFaitageOffset = faitageFromLeft - width / 2;
  const faitageCenterLat = centerLat + metersToLatDeg(centerToFaitageOffset * Math.sin((orientationDeg + 90) * DEG_TO_RAD));
  const faitageCenterLon = centerLon + metersToLonDeg(centerToFaitageOffset * Math.cos((orientationDeg + 90) * DEG_TO_RAD), centerLat);
  
  // Points du faîtage ajustés
  const faitageP1 = offsetPoint(faitageCenterLat, faitageCenterLon, halfLength, orientationDeg);
  const faitageP2 = offsetPoint(faitageCenterLat, faitageCenterLon, halfLength, orientationDeg + 180);
  
  // Pan A = côté droit (quand on regarde vers le Nord = orientationDeg)
  // Bords à faitageFromRight du faîtage
  const panACenterOffset = (faitageFromLeft + width) / 2 - width / 2;
  const panABorderLat = centerLat + metersToLatDeg(faitageFromRight * Math.sin((orientationDeg + 90) * DEG_TO_RAD) / 2 + centerToFaitageOffset * Math.sin((orientationDeg + 90) * DEG_TO_RAD));
  
  // Simplification: générer les 4 coins de chaque pan
  const panACorners: [number, number][] = [
    faitageP1, // Faîtage avant
    offsetPoint(centerLat, centerLon, Math.sqrt((halfLength) ** 2 + (width / 2) ** 2), 
      orientationDeg + Math.atan2(width / 2, halfLength) * RAD_TO_DEG), // Coin avant-droit
    offsetPoint(centerLat, centerLon, Math.sqrt((halfLength) ** 2 + (width / 2) ** 2), 
      orientationDeg + 180 - Math.atan2(width / 2, halfLength) * RAD_TO_DEG), // Coin arrière-droit
    faitageP2, // Faîtage arrière
    faitageP1, // Fermer
  ];
  
  if (!hasTwoPans) {
    const panAPolygon: [number, number][] = [...panACorners.slice(0, -1), panACorners[0]!];
    return {
      panA: { type: "Polygon", coordinates: [panAPolygon] },
      panB: null,
      faitage: [faitageP1, faitageP2],
    };
  }
  
  // Pan B = côté gauche
  const panBCorners: [number, number][] = [
    faitageP1, // Faîtage avant
    offsetPoint(centerLat, centerLon, Math.sqrt((halfLength) ** 2 + (width / 2) ** 2), 
      orientationDeg - Math.atan2(width / 2, halfLength) * RAD_TO_DEG), // Coin avant-gauche
    offsetPoint(centerLat, centerLon, Math.sqrt((halfLength) ** 2 + (width / 2) ** 2), 
      orientationDeg + 180 + Math.atan2(width / 2, halfLength) * RAD_TO_DEG), // Coin arrière-gauche
    faitageP2, // Faîtage arrière
    faitageP1, // Fermer
  ];
  
  return {
    panA: { type: "Polygon", coordinates: [panACorners] },
    panB: { type: "Polygon", coordinates: [panBCorners] },
    faitage: [faitageP1, faitageP2],
  };
}

/**
 * Calcule l'azimut d'un pan à partir de l'orientation du faîtage
 * Convention: azimut = direction vers laquelle le pan "regarde" (perpendiculaire au faîtage)
 */
export function calculateAzimuth(orientationDeg: number, isPanA: boolean): number {
  // Pan A regarde vers la droite du faîtage (+90°)
  // Pan B regarde vers la gauche du faîtage (-90°)
  const offset = isPanA ? 90 : -90;
  return ((orientationDeg + offset) % 360 + 360) % 360;
}

/**
 * Formate un azimut avec la direction cardinale
 */
export function formatAzimuth(azimuthDeg: number): string {
  const directions = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];
  const index = Math.round(azimuthDeg / 45) % 8;
  return `${azimuthDeg.toFixed(1)}° (${directions[index]})`;
}

/**
 * Retourne le label de direction pour un pan
 */
export function getPanDirectionLabel(azimuthDeg: number): string {
  // Simplification en 4 directions
  if (azimuthDeg >= 315 || azimuthDeg < 45) return "Nord";
  if (azimuthDeg >= 45 && azimuthDeg < 135) return "Est";
  if (azimuthDeg >= 135 && azimuthDeg < 225) return "Sud";
  return "Ouest";
}
