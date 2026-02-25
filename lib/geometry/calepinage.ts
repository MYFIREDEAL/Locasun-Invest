import type { BuildingParams, BuildingType } from "@/lib/types/building";
import { PANEL_SPECS, PANEL_RATIO_BY_TYPE } from "@/lib/types/building";
import type { 
  PanelModel, 
  CalepinageParams, 
  CalepinageResult, 
  ZoneCalepinageResult,
  PanelOrientation,
} from "@/lib/types/panels";
import { getDefaultPanel, DEFAULT_CALEPINAGE } from "@/lib/types/panels";
import { 
  calculateSurfacePanA, 
  calculateSurfacePanB, 
  calculateLength,
  calculateRampantPanA,
  calculateRampantPanB,
  isZonePvA,
  isZonePvB,
} from "./building-calculations";

// ============================================================================
// CALCUL DE CALEPINAGE AVEC VRAIE GRILLE
// Marges, gaps, orientation portrait/paysage
// ============================================================================

/**
 * Calcule le nombre de panneaux dans une direction
 * @param disponible - Espace disponible (m)
 * @param taillePanneau - Taille du panneau dans cette direction (m)
 * @param gap - Espacement entre panneaux (m)
 */
function calculatePanelsInDirection(
  disponible: number,
  taillePanneau: number,
  gap: number
): number {
  if (disponible <= 0 || taillePanneau <= 0) return 0;
  
  // Premier panneau: taillePanneau
  // Panneaux suivants: gap + taillePanneau
  // Donc: taillePanneau + (n-1) * (gap + taillePanneau) ≤ disponible
  // n ≤ (disponible + gap) / (taillePanneau + gap)
  
  const n = Math.floor((disponible + gap) / (taillePanneau + gap));
  return Math.max(0, n);
}

/**
 * Calcule le calepinage en grille pour une zone PV
 * Utilise les vraies dimensions avec marges et gaps
 */
export function calculateZoneCalepinageGrid(
  zoneName: string,
  rampant: number,        // Longueur du rampant (m) - hauteur de la zone
  zoneLength: number,     // Longueur du bâtiment (m) - largeur de la zone
  panel: PanelModel,
  params: CalepinageParams
): ZoneCalepinageResult {
  // Surface exacte du rampant (pour PVGIS)
  const surfaceZone = rampant * zoneLength;
  
  if (surfaceZone === 0 || rampant === 0 || zoneLength === 0) {
    return {
      zoneName,
      surfaceZone_m2: 0,
      surfaceUtile_m2: 0,
      nbPanelsX: 0,
      nbPanelsY: 0,
      nbPanels: 0,
      kwc: 0,
      orientationUsed: params.orientation === "auto" ? "portrait" : params.orientation,
    };
  }
  
  // Dimensions disponibles après marges
  const rampantUtile = rampant - 2 * params.margin_m;
  const longueurUtile = zoneLength - 2 * params.margin_m;
  const surfaceUtile = Math.max(0, rampantUtile * longueurUtile);
  
  if (rampantUtile <= 0 || longueurUtile <= 0) {
    return {
      zoneName,
      surfaceZone_m2: Math.round(surfaceZone * 100) / 100,
      surfaceUtile_m2: 0,
      nbPanelsX: 0,
      nbPanelsY: 0,
      nbPanels: 0,
      kwc: 0,
      orientationUsed: params.orientation === "auto" ? "portrait" : params.orientation,
    };
  }
  
  // Dimensions du panneau
  const panelLength = panel.length_m;  // ~2.278m
  const panelWidth = panel.width_m;    // ~1.134m
  
  // Calculer les deux orientations possibles
  // Portrait: longueur du panneau dans le sens du rampant
  const portraitY = calculatePanelsInDirection(rampantUtile, panelLength, params.gap_m);
  const portraitX = calculatePanelsInDirection(longueurUtile, panelWidth, params.gap_m);
  const portraitTotal = portraitX * portraitY;
  
  // Paysage: largeur du panneau dans le sens du rampant
  const landscapeY = calculatePanelsInDirection(rampantUtile, panelWidth, params.gap_m);
  const landscapeX = calculatePanelsInDirection(longueurUtile, panelLength, params.gap_m);
  const landscapeTotal = landscapeX * landscapeY;
  
  // Choisir l'orientation
  let nbPanelsX: number;
  let nbPanelsY: number;
  let orientationUsed: PanelOrientation;
  
  if (params.orientation === "portrait") {
    nbPanelsX = portraitX;
    nbPanelsY = portraitY;
    orientationUsed = "portrait";
  } else if (params.orientation === "landscape") {
    nbPanelsX = landscapeX;
    nbPanelsY = landscapeY;
    orientationUsed = "landscape";
  } else {
    // Auto: choisir celui qui donne le plus de panneaux
    if (portraitTotal >= landscapeTotal) {
      nbPanelsX = portraitX;
      nbPanelsY = portraitY;
      orientationUsed = "portrait";
    } else {
      nbPanelsX = landscapeX;
      nbPanelsY = landscapeY;
      orientationUsed = "landscape";
    }
  }
  
  const nbPanels = nbPanelsX * nbPanelsY;
  const kwc = (nbPanels * panel.power_w) / 1000;
  
  return {
    zoneName,
    surfaceZone_m2: Math.round(surfaceZone * 100) / 100,
    surfaceUtile_m2: Math.round(surfaceUtile * 100) / 100,
    nbPanelsX,
    nbPanelsY,
    nbPanels,
    kwc: Math.round(kwc * 100) / 100,
    orientationUsed,
  };
}

/**
 * Calcule le calepinage complet pour un bâtiment
 * Utilise la vraie grille avec marges et gaps
 */
export function calculateCalepinage(
  params: BuildingParams,
  panel: PanelModel = getDefaultPanel(),
  calepinageParams: CalepinageParams = DEFAULT_CALEPINAGE
): CalepinageResult {
  const length = calculateLength(params);
  const zones: ZoneCalepinageResult[] = [];
  
  // Pan A
  if (isZonePvA(params)) {
    const rampantA = calculateRampantPanA(params);
    const zoneA = calculateZoneCalepinageGrid("panA", rampantA, length, panel, calepinageParams);
    zones.push(zoneA);
  }
  
  // Pan B
  if (isZonePvB(params)) {
    const rampantB = calculateRampantPanB(params);
    const zoneB = calculateZoneCalepinageGrid("panB", rampantB, length, panel, calepinageParams);
    zones.push(zoneB);
  }
  
  const panelsTotal = zones.reduce((sum, z) => sum + z.nbPanels, 0);
  const kwcTotal = zones.reduce((sum, z) => sum + z.kwc, 0);
  
  return {
    panel,
    params: calepinageParams,
    zones,
    panelsTotal,
    kwcTotal: Math.round(kwcTotal * 100) / 100,
  };
}

/**
 * Raccourci pour obtenir les valeurs simplifiées pour BuildingDerived
 */
export function calculatePvSummary(
  buildingParams: BuildingParams,
  panel: PanelModel = getDefaultPanel(),
  calepinageParams: CalepinageParams = DEFAULT_CALEPINAGE
): {
  nbPanelsPanA: number;
  nbPanelsPanB: number;
  powerKwcPanA: number;
  powerKwcPanB: number;
  nbPanels: number;
  powerKwc: number;
} {
  const result = calculateCalepinage(buildingParams, panel, calepinageParams);
  
  const panA = result.zones.find((z) => z.zoneName === "panA");
  const panB = result.zones.find((z) => z.zoneName === "panB");
  
  return {
    nbPanelsPanA: panA?.nbPanels ?? 0,
    nbPanelsPanB: panB?.nbPanels ?? 0,
    powerKwcPanA: panA?.kwc ?? 0,
    powerKwcPanB: panB?.kwc ?? 0,
    nbPanels: result.panelsTotal,
    powerKwc: result.kwcTotal,
  };
}
