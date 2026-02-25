/**
 * Contrôles PLU : vérification hauteurs et distance aux limites de parcelle
 * Utilise @turf/turf pour les calculs géométriques segment-à-segment
 */

import * as turf from "@turf/turf";
import type {
  PluRules,
  PluAnalysis,
  HeightCheckResult,
  DistanceCheckResult,
  ConformiteStatus,
  ZoneConflict,
} from "@/lib/types/plu";
import { DEFAULT_PLU_RULES, computeGlobalStatus } from "@/lib/types/plu";
import type { ZoneUrbaProperties } from "@/lib/types/parcelle";

// ============================================================================
// DISTANCE MINIMALE BÂTIMENT ↔ LIMITE PARCELLE
// ============================================================================

/**
 * Calcule la distance minimale entre le polygon du bâtiment et le polygon de la parcelle.
 * On compare chaque sommet du bâtiment à chaque segment de la parcelle (et vice-versa)
 * pour trouver la distance perpendiculaire minimale aux limites.
 *
 * @param buildingCorners - Les 4 coins du bâtiment en [lat, lng] (Leaflet order)
 * @param parcelleGeometry - MultiPolygon GeoJSON de la parcelle cadastrale
 * @returns Distance minimale en mètres, ou null si calcul impossible
 */
export function computeMinDistanceToBoundary(
  buildingCorners: [number, number][],
  parcelleGeometry: GeoJSON.MultiPolygon | null
): number | null {
  if (!parcelleGeometry || buildingCorners.length < 3) return null;

  try {
    // Convertir les coins bâtiment [lat, lng] → GeoJSON [lng, lat]
    const buildingCoords = buildingCorners.map(
      ([lat, lng]) => [lng, lat] as [number, number]
    );
    // Fermer le polygon
    const firstCoord = buildingCoords[0];
    if (!firstCoord) return null;
    const closedBuilding = [...buildingCoords, firstCoord];

    const buildingPoly = turf.polygon([closedBuilding]);

    // Pour chaque polygon de la parcelle (MultiPolygon → itérer)
    let minDistance = Infinity;

    for (const polygonCoords of parcelleGeometry.coordinates) {
      // polygonCoords = [ring_extérieur, ...rings_intérieurs]
      const outerRing = polygonCoords[0];
      if (!outerRing || outerRing.length < 4) continue;

      // Convertir en LineString pour calculer la distance point-à-ligne
      const boundaryLine = turf.lineString(outerRing as [number, number][]);

      // Pour chaque sommet du bâtiment, calculer la distance à la limite parcelle
      for (const coord of buildingCoords) {
        const pt = turf.point(coord);
        const d = turf.pointToLineDistance(pt, boundaryLine, { units: "meters" });
        if (d < minDistance) minDistance = d;
      }

      // Aussi vérifier les sommets de la parcelle vers les côtés du bâtiment
      const buildingLine = turf.lineString(closedBuilding);
      for (const coord of outerRing) {
        const c = coord as [number, number] | undefined;
        if (!c) continue;
        const pt = turf.point(c);
        const d = turf.pointToLineDistance(pt, buildingLine, { units: "meters" });
        if (d < minDistance) minDistance = d;
      }
    }

    if (!isFinite(minDistance)) return null;

    // Arrondir à 1 décimale
    return Math.round(minDistance * 10) / 10;
  } catch (err) {
    console.warn("[plu-checks] Erreur calcul distance parcelle:", err);
    return null;
  }
}

/**
 * Calcule la distance minimale en tenant compte des parcelles possédées par le client.
 * Si le client possède des parcelles adjacentes, on fusionne toutes les parcelles possédées
 * en un seul polygone et on mesure la distance à la frontière extérieure.
 * Ainsi les limites internes entre parcelles du même propriétaire ne déclenchent pas
 * de non-conformité.
 *
 * @param buildingCorners - Les 4 coins du bâtiment [lat, lng]
 * @param parcelleGeometry - Géométrie de la parcelle principale
 * @param ownedAdjacentGeometries - Géométries des parcelles secondaires possédées par le client
 * @returns Distance minimale en mètres aux limites non-possédées
 */
export function computeMinDistanceWithOwned(
  buildingCorners: [number, number][],
  parcelleGeometry: GeoJSON.MultiPolygon | null,
  ownedAdjacentGeometries: GeoJSON.MultiPolygon[],
): number | null {
  // Pas de parcelles adjacentes possédées → calcul classique
  if (ownedAdjacentGeometries.length === 0) {
    return computeMinDistanceToBoundary(buildingCorners, parcelleGeometry);
  }

  if (!parcelleGeometry || buildingCorners.length < 3) return null;

  try {
    // Convertir toutes les géométries en polygons turf, puis fusionner
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let merged: any = turf.multiPolygon(parcelleGeometry.coordinates);

    for (const adjGeom of ownedAdjacentGeometries) {
      const adjPoly = turf.multiPolygon(adjGeom.coordinates);
      // turf.union fusionne deux polygones — supprime les frontières internes
      const result = turf.union(turf.featureCollection([merged, adjPoly]));
      if (result) merged = result;
    }

    // Extraire la géométrie fusionnée comme MultiPolygon
    const mergedGeom = merged.geometry;
    let mergedMultiPoly: GeoJSON.MultiPolygon;

    if (mergedGeom.type === "Polygon") {
      mergedMultiPoly = {
        type: "MultiPolygon",
        coordinates: [mergedGeom.coordinates],
      };
    } else {
      mergedMultiPoly = mergedGeom as GeoJSON.MultiPolygon;
    }

    // Calculer la distance au contour du polygone fusionné
    return computeMinDistanceToBoundary(buildingCorners, mergedMultiPoly);
  } catch (err) {
    console.warn("[plu-checks] Erreur fusion parcelles possédées:", err);
    // Fallback sur le calcul classique
    return computeMinDistanceToBoundary(buildingCorners, parcelleGeometry);
  }
}

// ============================================================================
// CHECK HAUTEUR
// ============================================================================

/**
 * Vérifie la conformité des hauteurs du bâtiment par rapport aux règles PLU
 */
export function checkHeights(
  heightSabliereM: number,
  heightFaitageM: number,
  rules: PluRules | null
): HeightCheckResult {
  const maxHeight = rules?.maxHeightM ?? null;

  let sabliereStatus: ConformiteStatus;
  let faitageStatus: ConformiteStatus;

  if (maxHeight === null) {
    sabliereStatus = "indisponible";
    faitageStatus = "indisponible";
  } else {
    sabliereStatus = heightSabliereM <= maxHeight ? "conforme" : "non-conforme";
    faitageStatus = heightFaitageM <= maxHeight ? "conforme" : "non-conforme";
  }

  return {
    heightSabliereM,
    heightFaitageM,
    maxHeightM: maxHeight,
    sabliereStatus,
    faitageStatus,
  };
}

// ============================================================================
// CHECK DISTANCE
// ============================================================================

/**
 * Vérifie la conformité de la distance aux limites de parcelle
 */
export function checkDistance(
  distanceMinM: number | null,
  rules: PluRules | null
): DistanceCheckResult {
  const minRequired = rules?.minDistanceBoundaryM ?? null;

  let status: ConformiteStatus;

  if (distanceMinM === null) {
    status = "indisponible";
  } else if (minRequired === null) {
    status = "indisponible";
  } else {
    status = distanceMinM >= minRequired ? "conforme" : "non-conforme";
  }

  return {
    distanceMinM,
    minRequiredM: minRequired,
    status,
  };
}

// ============================================================================
// ANALYSE COMPLÈTE
// ============================================================================

/**
 * Exécute l'analyse PLU complète : hauteurs + distance + conflit zones multi-parcelles
 *
 * @param zoneUrba - Propriétés de la zone urbanisme (peut être null)
 * @param heightSabliereM - Hauteur sablière (m)
 * @param heightFaitageM - Hauteur faîtage (m)
 * @param buildingCorners - Coins du bâtiment [lat, lng] (4 points)
 * @param parcelleGeometry - Géométrie cadastrale MultiPolygon
 * @param parcellesSecondaires - Parcelles secondaires avec leur zone urba (bâtiment à cheval)
 * @param ownedAdjacentGeometries - Géométries des parcelles secondaires possédées par le client
 *   (les frontières internes entre parcelles possédées sont ignorées pour le calcul de distance)
 * @returns Analyse PLU complète
 */
export function runPluAnalysis(
  zoneUrba: ZoneUrbaProperties | null,
  heightSabliereM: number,
  heightFaitageM: number,
  buildingCorners: [number, number][],
  parcelleGeometry: GeoJSON.MultiPolygon | null,
  parcellesSecondaires?: { zoneUrba: ZoneUrbaProperties | null; parcelle: string }[],
  ownedAdjacentGeometries?: GeoJSON.MultiPolygon[],
): PluAnalysis {
  // 1) Déterminer les règles PLU
  const pluAvailable = zoneUrba !== null;
  const zoneType = zoneUrba?.typezone ?? null;
  const zoneLabel = zoneUrba?.libelle ?? null;

  let rules: PluRules | null = null;
  if (zoneType) {
    // Chercher les règles par défaut pour ce type de zone
    rules = DEFAULT_PLU_RULES[zoneType] ?? null;
  }

  // 2) Check hauteurs
  const heightCheck = checkHeights(heightSabliereM, heightFaitageM, rules);

  // 3) Check distance parcelle (en tenant compte des parcelles possédées)
  const distanceMinM = computeMinDistanceWithOwned(
    buildingCorners,
    parcelleGeometry,
    ownedAdjacentGeometries ?? [],
  );
  const distanceCheck = checkDistance(distanceMinM, rules);

  // 4) Statut global
  const globalStatus = computeGlobalStatus(heightCheck, distanceCheck);

  // 5) URL vers le document d'urbanisme sur le GPU
  const partition = zoneUrba?.partition ?? null;
  const gpuDocumentUrl = partition
    ? `https://www.geoportail-urbanisme.gouv.fr/document/#/${partition}`
    : null;

  // 5b) Conflit de zones PLU entre parcelles
  const zoneConflict = detectZoneConflict(zoneUrba, parcellesSecondaires);

  // 6) Résumé
  let summary: string;
  if (!pluAvailable) {
    summary = "PLU indisponible — contrôles limités aux données disponibles";
  } else if (globalStatus === "conforme") {
    summary = "Tous les contrôles PLU sont conformes";
  } else if (globalStatus === "non-conforme") {
    const issues: string[] = [];
    if (heightCheck.faitageStatus === "non-conforme") issues.push("hauteur faîtage");
    if (heightCheck.sabliereStatus === "non-conforme") issues.push("hauteur sablière");
    if (distanceCheck.status === "non-conforme") issues.push("distance limites");
    summary = `Non conforme : ${issues.join(", ")}`;
  } else {
    summary = "Données insuffisantes pour tous les contrôles";
  }

  return {
    pluAvailable,
    zoneType,
    zoneLabel,
    rules,
    heightCheck,
    distanceCheck,
    globalStatus,
    summary,
    gpuDocumentUrl,
    zoneConflict,
  };
}

// ============================================================================
// DÉTECTION CONFLIT ZONES PLU MULTI-PARCELLES
// ============================================================================

/**
 * Détecte si les parcelles (principale + secondaires) ont des zones PLU différentes.
 * Ex: parcelle principale en zone A, parcelle secondaire en zone U → conflit.
 */
function detectZoneConflict(
  primaryZoneUrba: ZoneUrbaProperties | null,
  parcellesSecondaires?: { zoneUrba: ZoneUrbaProperties | null; parcelle: string }[],
): ZoneConflict | null {
  // Pas de parcelles secondaires → pas de conflit possible
  if (!parcellesSecondaires || parcellesSecondaires.length === 0) return null;

  // Construire la liste des zones détectées
  const zones: ZoneConflict["zones"] = [];

  if (primaryZoneUrba) {
    zones.push({
      typezone: primaryZoneUrba.typezone,
      libelle: primaryZoneUrba.libelle,
      parcelle: "principale",
    });
  }

  for (const sec of parcellesSecondaires) {
    if (sec.zoneUrba) {
      zones.push({
        typezone: sec.zoneUrba.typezone,
        libelle: sec.zoneUrba.libelle,
        parcelle: sec.parcelle,
      });
    }
  }

  // Moins de 2 zones connues → on ne peut pas comparer
  if (zones.length < 2) return null;

  // Vérifier si toutes les zones ont le même typezone
  const uniqueTypes = new Set(zones.map(z => z.typezone));
  const hasDifferentZones = uniqueTypes.size > 1;

  return { hasDifferentZones, zones };
}
