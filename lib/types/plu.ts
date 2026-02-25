/**
 * Types pour le contrôle PLU (Plan Local d'Urbanisme)
 * Vérification automatique de conformité : hauteurs, distance limites parcelle
 */

// ============================================================================
// STATUT DE CONFORMITÉ
// ============================================================================

/** Statut d'un contrôle individuel */
export type ConformiteStatus = "conforme" | "non-conforme" | "indisponible";

/** Couleur et icône associées */
export const CONFORMITE_DISPLAY: Record<ConformiteStatus, { icon: string; color: string; label: string }> = {
  "conforme": { icon: "✅", color: "text-green-600", label: "Conforme" },
  "non-conforme": { icon: "🔴", color: "text-red-600", label: "Non conforme" },
  "indisponible": { icon: "⚪", color: "text-gray-400", label: "Indisponible" },
};

// ============================================================================
// RÈGLES PLU (extraites ou par défaut)
// ============================================================================

/** Règles PLU applicables à la zone */
export interface PluRules {
  /** Hauteur maximum autorisée (mètres). null = pas de règle définie */
  maxHeightM: number | null;
  /** Distance minimum aux limites de parcelle (mètres). null = pas de règle définie */
  minDistanceBoundaryM: number | null;
  /** Source des règles ("gpu" = API GPU, "default" = règles par défaut zone, "manual" = saisi) */
  source: "gpu" | "default" | "manual";
}

/**
 * Règles par défaut par type de zone PLU
 * Ces valeurs sont indicatives et basées sur les pratiques courantes.
 * La hauteur max et le recul minimal varient selon le PLU local.
 */
export const DEFAULT_PLU_RULES: Record<string, PluRules> = {
  // Zone agricole : hauteur souvent 12m, recul 5m
  A: { maxHeightM: 12, minDistanceBoundaryM: 5, source: "default" },
  // Zone naturelle : hauteur 9m, recul 10m (plus stricte)
  N: { maxHeightM: 9, minDistanceBoundaryM: 10, source: "default" },
  Nh: { maxHeightM: 9, minDistanceBoundaryM: 5, source: "default" },
  // Zone urbaine : variable, on met des valeurs courantes
  U: { maxHeightM: 15, minDistanceBoundaryM: 3, source: "default" },
  // Zone à urbaniser
  AU: { maxHeightM: 12, minDistanceBoundaryM: 5, source: "default" },
  AUc: { maxHeightM: 12, minDistanceBoundaryM: 5, source: "default" },
  AUs: { maxHeightM: 9, minDistanceBoundaryM: 5, source: "default" },
};

// ============================================================================
// RÉSULTATS DES CONTRÔLES
// ============================================================================

/** Résultat du contrôle de hauteur */
export interface HeightCheckResult {
  /** Hauteur sablière du bâtiment (m) */
  heightSabliereM: number;
  /** Hauteur faîtage du bâtiment (m) */
  heightFaitageM: number;
  /** Hauteur max autorisée (m), null si non définie */
  maxHeightM: number | null;
  /** Statut conformité sablière */
  sabliereStatus: ConformiteStatus;
  /** Statut conformité faîtage */
  faitageStatus: ConformiteStatus;
}

/** Résultat du contrôle de distance aux limites */
export interface DistanceCheckResult {
  /** Distance minimale bâtiment ↔ limite parcelle (m) */
  distanceMinM: number | null;
  /** Distance minimum requise (m), null si non définie */
  minRequiredM: number | null;
  /** Statut conformité */
  status: ConformiteStatus;
}

/** Analyse PLU complète */
export interface PluAnalysis {
  /** Statut global PLU */
  pluAvailable: boolean;
  /** Type de zone PLU (ex: "A", "N", "U") */
  zoneType: string | null;
  /** Libellé de la zone */
  zoneLabel: string | null;
  /** Règles appliquées */
  rules: PluRules | null;
  /** Contrôle des hauteurs */
  heightCheck: HeightCheckResult | null;
  /** Contrôle de distance aux limites */
  distanceCheck: DistanceCheckResult;
  /** Statut global : conforme si tout est OK, non-conforme si au moins un non-conforme */
  globalStatus: ConformiteStatus;
  /** Message résumé */
  summary: string;
  /** URL vers le document d'urbanisme sur le Géoportail (pour vérification manuelle) */
  gpuDocumentUrl: string | null;
  /** Conflit de zones PLU entre parcelles (bâtiment à cheval) */
  zoneConflict: ZoneConflict | null;
}

/** Conflit de zones PLU entre parcelles */
export interface ZoneConflict {
  /** true si les parcelles ont des zones différentes */
  hasDifferentZones: boolean;
  /** Liste des zones uniques détectées : [{ type, label, parcelle }] */
  zones: { typezone: string; libelle: string; parcelle: string }[];
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Détermine le statut global à partir des contrôles individuels
 */
export function computeGlobalStatus(
  heightCheck: HeightCheckResult | null,
  distanceCheck: DistanceCheckResult
): ConformiteStatus {
  const statuses: ConformiteStatus[] = [];

  if (heightCheck) {
    statuses.push(heightCheck.sabliereStatus, heightCheck.faitageStatus);
  }
  statuses.push(distanceCheck.status);

  // Si au moins un non-conforme → global non-conforme
  if (statuses.includes("non-conforme")) return "non-conforme";
  // Si tous indisponibles → indisponible
  if (statuses.every((s) => s === "indisponible")) return "indisponible";
  // Si au moins un conforme et aucun non-conforme → conforme
  if (statuses.includes("conforme")) return "conforme";

  return "indisponible";
}
