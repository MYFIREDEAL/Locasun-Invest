import type { 
  BuildingParams, 
  BuildingDerived, 
  BuildingType,
  BuildingConfig,
} from "@/lib/types/building";
import { 
  TYPE_CONSTRAINTS, 
  SLOPE_BY_TYPE, 
  SABLIERE_BY_TYPE,
  WIDTHS_BY_TYPE,
  PANEL_SPECS,
} from "@/lib/types/building";
import { getVariant } from "@/lib/types/building-variants";

// ============================================================================
// CALCULS DE BASE
// ============================================================================

/**
 * Calcule la longueur du bâtiment (nb travées × espacement)
 */
export function calculateLength(params: BuildingParams): number {
  return params.nbSpans * params.spacing;
}

/**
 * Calcule la largeur totale incluant les extensions
 */
export function calculateTotalWidth(params: BuildingParams): number {
  return params.width + params.extensionLeftWidth + params.extensionRightWidth;
}

// ============================================================================
// CALCULS DE PENTE ET RAMPANT
// Formules géométriques exactes utilisant Pythagore
// ============================================================================

/**
 * Retourne l'angle de pente en degrés (fixe par type dans la config)
 * Note: Pour les calculs de surface, on utilise les vraies hauteurs via Pythagore
 */
export function calculateSlopeAngle(params: BuildingParams): number {
  return SLOPE_BY_TYPE[params.type];
}

/**
 * Calcule la position du faîtage depuis le bord gauche (en mètres)
 * C'est LA donnée clé pour les bâtiments asymétriques.
 * 
 * - SYM: faîtage au centre (largeur / 2)
 * - ASYM1/ASYM2: faîtage décalé vers la gauche (petit pan à gauche)
 * - MONO/VL_*: pas de faîtage classique (monotoit)
 */
export function calculateFaitagePosition(params: BuildingParams): number {
  // SYM: faîtage au centre
  if (params.type === "SYM") {
    return params.width / 2;
  }
  
  // MONO, VL_LEFT, VL_RIGHT, VL_DOUBLE, PL: monotoit, "faîtage" = bord haut
  if (params.type === "MONO" || params.type.startsWith("VL_") || params.type === "PL") {
    // Pour MONO: le côté gauche est le haut (sablière haute)
    // Le "faîtage" conceptuel est à la position 0 (bord gauche)
    return 0;
  }
  
  // ASYM2: utilise faitagePositionFromLeft, sinon zoneLeft, sinon calcul géométrique
  if (params.type === "ASYM2") {
    const variant = getVariant(params.type, params.width);
    if (variant?.faitagePositionFromLeft !== undefined) {
      return variant.faitagePositionFromLeft;
    }
    if (variant?.zoneLeft !== undefined) {
      return variant.zoneLeft;
    }
    // Fallback: calculer géométriquement comme ASYM1
    const pente = SLOPE_BY_TYPE[params.type];
    const tanPente = Math.tan((pente * Math.PI) / 180);
    const deltaHLeft = params.heightFaitage - params.heightSabliereLeft;
    return Math.abs(deltaHLeft) / tanPente;
  }
  
  // ASYM1: utilise d'abord faitagePositionFromLeft de la variante si disponible
  if (params.type === "ASYM1") {
    const variant = getVariant(params.type, params.width);
    if (variant?.faitagePositionFromLeft !== undefined) {
      return variant.faitagePositionFromLeft;
    }
    
    // Sinon calculer depuis les hauteurs
    const pente = SLOPE_BY_TYPE[params.type];
    const tanPente = Math.tan((pente * Math.PI) / 180);
    // Petit pan gauche: Δh = faîtage - sablière haute (gauche)
    const deltaHLeft = params.heightFaitage - params.heightSabliereLeft;
    const porteeGauche = Math.abs(deltaHLeft) / tanPente;
    return porteeGauche;
  }
  
  // Fallback: centre
  return params.width / 2;
}

/**
 * Calcule la position du poteau intermédiaire depuis le bord gauche (en mètres)
 * Pour ASYM2, le poteau peut être à une position différente du faîtage
 */
export function calculatePoteauPosition(params: BuildingParams): number | null {
  // Seuls ASYM2 et PL ont des poteaux intermédiaires
  if (params.type !== "ASYM2" && params.type !== "PL") {
    return null;
  }
  
  const variant = getVariant(params.type, params.width);
  
  // Utiliser poteauPositionFromLeft si défini
  if (variant?.poteauPositionFromLeft !== undefined) {
    return variant.poteauPositionFromLeft;
  }
  
  // Fallback: utiliser zoneLeft ou faitagePosition
  if (variant?.zoneLeft !== undefined) {
    return variant.zoneLeft;
  }
  
  // Dernier fallback: position du faîtage
  return calculateFaitagePosition(params);
}

/**
 * Calcule la largeur du pan A (DROITE = côté sablière BASSE pour ASYM) au sol
 * Pan A = grand pan pour les asymétriques (côté Sud, plus de panneaux PV)
 */
export function calculatePanWidthA(params: BuildingParams): number {
  // SYM: demi-largeur (les 2 pans sont identiques)
  if (params.type === "SYM") {
    return params.width / 2;
  }
  
  // MONO: toute la largeur (1 seul pan)
  if (params.type === "MONO") {
    return params.width;
  }
  
  // VL_* et PL: toute la largeur (monotoit)
  if (params.type.startsWith("VL_") || params.type === "PL") {
    return params.width;
  }
  
  // ASYM1 et ASYM2: pan A = largeur - position faîtage
  // Le faîtage est décalé à gauche, donc pan A (droite) est le plus grand
  const faitagePos = calculateFaitagePosition(params);
  return params.width - faitagePos;
}

/**
 * Calcule la largeur du pan B (GAUCHE = côté sablière HAUTE pour ASYM) au sol
 * Pan B = petit pan pour les asymétriques
 */
export function calculatePanWidthB(params: BuildingParams): number {
  const constraints = TYPE_CONSTRAINTS[params.type];
  
  if (!constraints.hasTwoPans) {
    return 0;
  }
  
  // SYM: demi-largeur
  if (params.type === "SYM") {
    return params.width / 2;
  }
  
  // ASYM1 et ASYM2: pan B = position faîtage
  const faitagePos = calculateFaitagePosition(params);
  return faitagePos;
}

/**
 * Calcule le delta de hauteur (Δh) pour le pan A
 * Δh = faîtage - sablière du pan
 */
export function calculateHeightDeltaPanA(params: BuildingParams): number {
  // SYM: les 2 sablières sont égales
  if (params.type === "SYM") {
    return params.heightFaitage - params.heightSabliereRight;
  }
  
  // MONO: du haut (gauche) vers le bas (droite)
  // Δh = sablière haute - sablière basse
  if (params.type === "MONO") {
    return params.heightSabliereLeft - params.heightSabliereRight;
  }
  
  // ASYM1/ASYM2: pan A est à droite (sablière basse = heightSabliereRight)
  // Δh = faîtage - sablière droite (basse)
  if (params.type === "ASYM1" || params.type === "ASYM2") {
    return params.heightFaitage - params.heightSabliereRight;
  }
  
  // VL_* et PL: du haut vers le bas
  return Math.abs(params.heightSabliereLeft - params.heightSabliereRight);
}

/**
 * Calcule le delta de hauteur (Δh) pour le pan B
 */
export function calculateHeightDeltaPanB(params: BuildingParams): number {
  const constraints = TYPE_CONSTRAINTS[params.type];
  
  if (!constraints.hasTwoPans) {
    return 0;
  }
  
  // SYM: même Δh que pan A
  if (params.type === "SYM") {
    return params.heightFaitage - params.heightSabliereLeft;
  }
  
  // ASYM1/ASYM2: pan B est à gauche (sablière haute = heightSabliereLeft)
  // Δh = faîtage - sablière gauche (haute) → petit Δh = petit rampant
  return params.heightFaitage - params.heightSabliereLeft;
}

/**
 * Calcule le delta de hauteur global (pour compatibilité)
 */
export function calculateHeightDeltaFromSlope(params: BuildingParams): number {
  return calculateHeightDeltaPanA(params);
}

/**
 * Calcule la longueur du rampant du pan A avec Pythagore
 * rampant = √(largeurPan² + Δh²)
 * 
 * C'est la formule EXACTE pour la surface de toiture inclinée.
 */
export function calculateRampantPanA(params: BuildingParams): number {
  const panWidth = calculatePanWidthA(params);
  const deltaH = calculateHeightDeltaPanA(params);
  
  // Pythagore: rampant = √(base² + hauteur²)
  return Math.sqrt(panWidth * panWidth + deltaH * deltaH);
}

/**
 * Calcule la longueur du rampant du pan B avec Pythagore
 * rampant = √(largeurPan² + Δh²)
 */
export function calculateRampantPanB(params: BuildingParams): number {
  const constraints = TYPE_CONSTRAINTS[params.type];
  
  if (!constraints.hasTwoPans) {
    return 0;
  }
  
  const panWidth = calculatePanWidthB(params);
  const deltaH = calculateHeightDeltaPanB(params);
  
  // Pythagore: rampant = √(base² + hauteur²)
  return Math.sqrt(panWidth * panWidth + deltaH * deltaH);
}

// ============================================================================
// CALCULS DE SURFACE
// ============================================================================

/**
 * Calcule la surface du pan A
 * Surface = longueur × rampant
 */
export function calculateSurfacePanA(params: BuildingParams): number {
  const length = calculateLength(params);
  const rampant = calculateRampantPanA(params);
  return length * rampant;
}

/**
 * Calcule la surface du pan B
 */
export function calculateSurfacePanB(params: BuildingParams): number {
  const constraints = TYPE_CONSTRAINTS[params.type];
  
  if (!constraints.hasTwoPans) {
    return 0;
  }
  
  const length = calculateLength(params);
  const rampant = calculateRampantPanB(params);
  return length * rampant;
}

/**
 * Calcule la surface totale de toiture
 */
export function calculateSurfaceTotal(params: BuildingParams): number {
  return calculateSurfacePanA(params) + calculateSurfacePanB(params);
}

// ============================================================================
// POTEAUX INTERMÉDIAIRES
// ============================================================================

/**
 * Détermine si le type de bâtiment nécessite des poteaux intermédiaires
 */
export function hasIntermediatePoles(params: BuildingParams): boolean {
  const constraints = TYPE_CONSTRAINTS[params.type];
  
  // Les types avec poteaux intermédiaires obligatoires
  if (constraints.requiresIntermediatePoles) {
    return true;
  }
  
  // Optionnel selon la largeur (> 20m généralement)
  if (constraints.optionalIntermediatePoles && params.width > 20) {
    return true;
  }
  
  return false;
}

/**
 * Calcule le nombre de poteaux intermédiaires
 * Généralement 1 poteau intermédiaire par travée si requis
 */
export function calculateIntermediatePoles(params: BuildingParams): number {
  if (!hasIntermediatePoles(params)) {
    return 0;
  }
  
  // 1 rangée de poteaux intermédiaires = nbSpans + 1 poteaux
  return params.nbSpans + 1;
}

/**
 * Calcule la position du poteau intermédiaire depuis le bord gauche (en mètres)
 * Pour ASYM2 et autres types avec poteau central: au milieu
 * Pour VL_LEFT: à gauche (25% de la largeur)
 * Pour VL_RIGHT: à droite (75% de la largeur)
 * Pour VL_DOUBLE: deux positions (retourne la première)
 */
export function calculatePoleOffset(params: BuildingParams): number | null {
  if (!hasIntermediatePoles(params)) {
    return null;
  }
  
  // Pour ASYM2 et PL, utiliser la position configurée dans les variants
  if (params.type === "ASYM2" || params.type === "PL") {
    const poteauPos = calculatePoteauPosition(params);
    if (poteauPos !== null) {
      return poteauPos;
    }
  }
  
  const constraints = TYPE_CONSTRAINTS[params.type];
  
  switch (constraints.polePosition) {
    case "center":
      // Poteau au milieu de la largeur
      return params.width / 2;
    case "left":
      // Vélum gauche: poteau à ~25% depuis la gauche
      return params.width * 0.25;
    case "right":
      // Vélum droit: poteau à ~75% depuis la gauche  
      return params.width * 0.75;
    case "both":
      // Double vélum: retourne la position du premier poteau (gauche)
      return params.width * 0.25;
    case "offset_left":
      // Sous le faîtage décalé à gauche
      return params.width * (constraints.panARatio ?? 0.25);
    case "offset_right":
      // Sous le faîtage décalé à droite
      return params.width * (constraints.panARatio ?? 0.75);
    default:
      return params.width / 2;
  }
}

/**
 * Pour VL_DOUBLE, retourne les deux positions de poteaux
 */
export function calculatePoleOffsets(params: BuildingParams): number[] {
  if (!hasIntermediatePoles(params)) {
    return [];
  }
  
  const constraints = TYPE_CONSTRAINTS[params.type];
  
  if (constraints.polePosition === "both") {
    // Double vélum: deux rangées de poteaux
    return [params.width * 0.25, params.width * 0.75];
  }
  
  const offset = calculatePoleOffset(params);
  return offset !== null ? [offset] : [];
}

/**
 * Calcule les largeurs des zones séparées par le poteau
 * Retourne [zone1, zone2] ou [totalWidth] si pas de poteau
 */
export function calculateZoneWidths(params: BuildingParams): number[] {
  if (!hasIntermediatePoles(params)) {
    return [params.width];
  }
  
  const offset = calculatePoleOffset(params);
  if (offset === null) {
    return [params.width];
  }
  
  const constraints = TYPE_CONSTRAINTS[params.type];
  
  if (constraints.polePosition === "both") {
    // Double vélum: 3 zones
    const offsets = calculatePoleOffsets(params);
    if (offsets.length === 2) {
      return [offsets[0] ?? 0, (offsets[1] ?? 0) - (offsets[0] ?? 0), params.width - (offsets[1] ?? 0)];
    }
  }
  
  // 2 zones
  return [offset, params.width - offset];
}

// ============================================================================
// CALCULS PANNEAUX SOLAIRES
// Voir lib/geometry/calepinage.ts pour le calcul détaillé avec grille
// ============================================================================

// Les fonctions simplifiées sont conservées pour compatibilité
// mais le calcul précis utilise calculatePvSummary de calepinage.ts

// ============================================================================
// ZONES PV
// ============================================================================

/**
 * Détermine si le pan A (gauche) est une zone PV valide
 * TOUS les pans avec pente valide peuvent avoir du PV
 */
export function isZonePvA(params: BuildingParams): boolean {
  const slope = calculateSlopeAngle(params);
  
  // Plat: les panneaux sont inclinables, donc valide
  if (params.type === "PL") {
    return true;
  }
  
  // Tous les types: PV si pente entre 5° et 35°
  return slope >= 5 && slope <= 35;
}

/**
 * Détermine si le pan B (droite) est une zone PV valide
 * TOUS les pans avec pente valide peuvent avoir du PV
 */
export function isZonePvB(params: BuildingParams): boolean {
  const constraints = TYPE_CONSTRAINTS[params.type];
  const slope = calculateSlopeAngle(params);
  
  // Pas de pan B pour les types mono-pan
  if (!constraints.hasTwoPans) {
    return false;
  }
  
  // Plat: les panneaux sont inclinables, donc valide
  if (params.type === "PL") {
    return true;
  }
  
  // Tous les types avec 2 pans: PV si pente entre 5° et 35°
  return slope >= 5 && slope <= 35;
}

// ============================================================================
// FONCTION PRINCIPALE
// ============================================================================

// Import dynamique pour éviter la dépendance circulaire
// Le calcul PV détaillé est dans calepinage.ts
import { calculatePvSummary } from "./calepinage";

/**
 * Calcule toutes les valeurs dérivées à partir des paramètres
 * Utilise Pythagore pour les rampants (formule exacte)
 */
export function calculateDerived(
  params: BuildingParams, 
  rulesetVersion: string
): BuildingDerived {
  const constraints = TYPE_CONSTRAINTS[params.type];
  const hasPoles = hasIntermediatePoles(params);
  const poleOffset = calculatePoleOffset(params);
  
  // Calculs géométriques
  const faitagePosition = calculateFaitagePosition(params);
  const panWidthA = calculatePanWidthA(params);
  const panWidthB = calculatePanWidthB(params);
  const heightDeltaPanA = calculateHeightDeltaPanA(params);
  const heightDeltaPanB = calculateHeightDeltaPanB(params);
  
  // Calcul PV avec calepinage précis
  const pvSummary = calculatePvSummary(params);
  
  return {
    length: round2(calculateLength(params)),
    totalWidth: round2(calculateTotalWidth(params)),
    slopeAngle: round2(calculateSlopeAngle(params)),
    // Position du faîtage (clef pour asymétriques)
    faitagePosition: round2(faitagePosition),
    // Largeurs des pans au sol
    panWidthA: round2(panWidthA),
    panWidthB: round2(panWidthB),
    // Delta hauteurs
    heightDeltaPanA: round2(heightDeltaPanA),
    heightDeltaPanB: round2(heightDeltaPanB),
    // Rampants (Pythagore)
    rampantPanA: round2(calculateRampantPanA(params)),
    rampantPanB: round2(calculateRampantPanB(params)),
    // Surfaces
    surfacePanA: round2(calculateSurfacePanA(params)),
    surfacePanB: round2(calculateSurfacePanB(params)),
    surfaceTotal: round2(calculateSurfaceTotal(params)),
    // Poteaux
    hasIntermediatePoles: hasPoles,
    nbIntermediatePoles: calculateIntermediatePoles(params),
    polePosition: hasPoles ? (constraints.polePosition ?? null) : null,
    poleOffsetFromLeft: poleOffset !== null ? round2(poleOffset) : null,
    poteauPosition: hasPoles ? calculatePoteauPosition(params) : null,
    // Zones PV
    zonePvA: isZonePvA(params),
    zonePvB: isZonePvB(params),
    rulesetVersion,
    // Calculs PV par pan (via calepinage précis)
    nbPanelsPanA: pvSummary.nbPanelsPanA,
    nbPanelsPanB: pvSummary.nbPanelsPanB,
    powerKwcPanA: pvSummary.powerKwcPanA,
    powerKwcPanB: pvSummary.powerKwcPanB,
    // Totaux PV
    nbPanels: pvSummary.nbPanels,
    powerKwc: pvSummary.powerKwc,
  };
}

/**
 * Arrondi à 2 décimales
 */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Crée une configuration complète à partir des paramètres
 */
export function createBuildingConfig(
  params: BuildingParams,
  rulesetVersion: string
): BuildingConfig {
  return {
    params,
    derived: calculateDerived(params, rulesetVersion),
  };
}

// ============================================================================
// VALEURS PAR DÉFAUT
// ============================================================================

/**
 * Retourne les paramètres par défaut pour un type de bâtiment
 * Utilise les variantes pour obtenir les hauteurs exactes
 */
export function getDefaultParamsForType(type: BuildingType): BuildingParams {
  const widths = WIDTHS_BY_TYPE[type];
  const defaultWidth = widths[0] ?? 15;
  
  // Chercher la variante pour ce type + largeur
  const variant = getVariant(type, defaultWidth);
  
  if (variant) {
    // Utiliser les hauteurs de la variante
    return {
      type,
      width: defaultWidth,
      spacing: 6,
      nbSpans: 4,
      heightSabliereLeft: variant.heightSabliereLeft,
      heightSabliereRight: variant.heightSabliereRight,
      heightFaitage: variant.heightFaitage,
      extensionLeft: "none",
      extensionRight: "none",
      extensionLeftWidth: 0,
      extensionRightWidth: 0,
      structureColor: "#1a1a1a",
    };
  }
  
  // Fallback si pas de variante
  const sabliere = SABLIERE_BY_TYPE[type] ?? 4;
  const slope = SLOPE_BY_TYPE[type];
  const slopeRad = (slope * Math.PI) / 180;
  const heightDelta = (defaultWidth / 2) * Math.tan(slopeRad);
  const faitage = sabliere + heightDelta;
  
  return {
    type,
    width: defaultWidth,
    spacing: 6,
    nbSpans: 4,
    heightSabliereLeft: sabliere,
    heightSabliereRight: sabliere,
    heightFaitage: Math.round(faitage * 10) / 10,
    extensionLeft: "none",
    extensionRight: "none",
    extensionLeftWidth: 0,
    extensionRightWidth: 0,
    structureColor: "#1a1a1a",
  };
}

/**
 * Réinitialise les paramètres lors d'un changement de type
 * Conserve certaines valeurs si compatible
 */
export function resetParamsForTypeChange(
  currentParams: BuildingParams,
  newType: BuildingType
): BuildingParams {
  const newConstraints = TYPE_CONSTRAINTS[newType];
  const newWidths = WIDTHS_BY_TYPE[newType];
  
  // Si la largeur actuelle n'est pas valide pour le nouveau type, prendre la première
  const validWidth = newWidths.includes(currentParams.width as never) 
    ? currentParams.width 
    : (newWidths[0] ?? 15);
  
  // Chercher la variante pour ce type + largeur
  const variant = getVariant(newType, validWidth);
  
  if (variant) {
    return {
      ...currentParams,
      type: newType,
      width: validWidth,
      heightSabliereLeft: variant.heightSabliereLeft,
      heightSabliereRight: variant.heightSabliereRight,
      heightFaitage: variant.heightFaitage,
      // Reset extensions si non autorisées
      extensionLeft: newConstraints.allowsExtensions ? currentParams.extensionLeft : "none",
      extensionRight: newConstraints.allowsExtensions ? currentParams.extensionRight : "none",
      extensionLeftWidth: newConstraints.allowsExtensions ? currentParams.extensionLeftWidth : 0,
      extensionRightWidth: newConstraints.allowsExtensions ? currentParams.extensionRightWidth : 0,
    };
  }
  
  // Fallback si pas de variante
  const newSabliere = SABLIERE_BY_TYPE[newType] ?? 4;
  const newSlope = SLOPE_BY_TYPE[newType];
  const slopeRad = (newSlope * Math.PI) / 180;
  const heightDelta = (validWidth / 2) * Math.tan(slopeRad);
  const newFaitage = newSabliere + heightDelta;
  
  return {
    ...currentParams,
    type: newType,
    width: validWidth,
    heightSabliereLeft: newSabliere,
    heightSabliereRight: newSabliere,
    heightFaitage: Math.round(newFaitage * 10) / 10,
    // Reset extensions si non autorisées
    extensionLeft: newConstraints.allowsExtensions ? currentParams.extensionLeft : "none",
    extensionRight: newConstraints.allowsExtensions ? currentParams.extensionRight : "none",
    extensionLeftWidth: newConstraints.allowsExtensions ? currentParams.extensionLeftWidth : 0,
    extensionRightWidth: newConstraints.allowsExtensions ? currentParams.extensionRightWidth : 0,
  };
}

/**
 * Met à jour les hauteurs quand on change la largeur
 * Charge les nouvelles hauteurs depuis la variante correspondante
 */
export function updateParamsForWidthChange(
  currentParams: BuildingParams,
  newWidth: number
): BuildingParams {
  // Chercher la variante pour ce type + nouvelle largeur
  const variant = getVariant(currentParams.type, newWidth);
  
  if (variant) {
    return {
      ...currentParams,
      width: newWidth,
      heightSabliereLeft: variant.heightSabliereLeft,
      heightSabliereRight: variant.heightSabliereRight,
      heightFaitage: variant.heightFaitage,
    };
  }
  
  // Fallback: garder les hauteurs actuelles
  return {
    ...currentParams,
    width: newWidth,
  };
}
