/**
 * Types pour le module Finance — estimation économique d'un projet hangar PV
 *
 * RÈGLE CLÉ :
 *   - kWc (puissance crête) vient du bâtiment → READONLY en finance
 *   - productible (kWh/kWc) + production annuelle → viennent de PVGIS → READONLY
 *   - Tout le reste (tarifs, coûts, hypothèses, inflations) est éditable
 *
 * Les champs readonly sont passés en props mais JAMAIS stockés dans FinanceState.
 */

import type { BuildingType } from "@/lib/types/building";
import { lookupBuildingCost } from "@/lib/data/building-pricing";

// ============================================================================
// COÛTS DE CONSTRUCTION (€ HT)
// ============================================================================

export interface FinanceCosts {
  /** Pose panneaux + onduleurs + câblage (€ HT) */
  installation: number;
  /** Structure métallique / charpente (€ HT) */
  charpente: number;
  /** Couverture toiture — bac acier, étanchéité (€ HT) */
  couverture: number;
  /** Fondations béton (€ HT) */
  fondations: number;
  /** Raccordement Enedis — TURPE + branchement (€ HT) */
  raccordement: number;
  /** Développement / études (€ HT) */
  developpement: number;
  /** Frais commerciaux (€ HT) */
  fraisCommerciaux: number;
  /** Soulte versée à l'agriculteur (€ HT) */
  soulte: number;
}

// ============================================================================
// OPTIONS ADDITIONNELLES (€ HT, 0 par défaut)
// ============================================================================

export interface FinanceOptions {
  /** Bardage latéral (€ HT) — 0 si non souhaité */
  bardage: number;
  /** Chéneaux / gouttières (€ HT) */
  cheneaux: number;
  /** Batterie de stockage (€ HT) */
  batterie: number;
}

// ============================================================================
// HYPOTHÈSES D'INFLATION ANNUELLE (%)
// ============================================================================

export interface FinanceInflation {
  /** Inflation tarif vente totale (Tb) — %/an — défaut 1% */
  inflTb: number;
  /** Inflation tarif autoconsommation (Acc) — %/an — défaut 2% */
  inflAcc: number;
  /** Inflation maintenance — %/an — défaut 1% */
  inflMaintenance: number;
  /** Inflation assurance — %/an — défaut 2% */
  inflAssurance: number;
  /** Inflation divers / frais généraux — %/an — défaut 2% */
  inflDivers: number;
  /** Inflation IFER — %/an — défaut 1% */
  inflIfer: number;
}

// ============================================================================
// HYPOTHÈSES FISCALES & FIXES
// ============================================================================

export interface FinanceFiscal {
  /** Taux d'imposition IS — défaut 25% */
  taxRatePct: number;
  /** IFER €/kWc — défaut 8.36 — seuil : si kWc ≤ 100 alors IFER = 0 */
  iferEurPerKwc: number;
  /** Durée du business plan (années) — fixé à 20 */
  durationYears: number;
}

// ============================================================================
// FINANCE STATE (persisté en JSONB — éditable)
// ============================================================================

/**
 * État complet de l'onglet finance.
 * Ne contient AUCUNE donnée venue du bâtiment ou de PVGIS.
 * Celles-ci sont passées en props readonly au composant.
 */
export interface FinanceState {
  /** Tarif de vente totale (€/kWh) — S21 OA EDF */
  tarifTb: number;
  /** Tarif autoconsommation (économie réseau évitée) (€/kWh) */
  tarifAcc: number;
  /** Part d'autoconsommation (%) — ex: 30 = 30% */
  partAccPct: number;
  /** Taux d'intérêt emprunt (%/an) */
  interestRatePct: number;
  /** Apport personnel (€ HT) — réduit le capital emprunté */
  downPayment: number;
  /** Coûts de construction */
  costs: FinanceCosts;
  /** Maintenance annuelle (€/kWc/an) — défaut 10 */
  maintenanceEurPerKwc: number;
  /** Options additionnelles */
  options: FinanceOptions;
  /** Hypothèses d'inflation */
  inflation: FinanceInflation;
  /** Hypothèses fiscales */
  fiscal: FinanceFiscal;
}

// ============================================================================
// FINANCE SNAPSHOT (figé à la validation de l'étape)
// ============================================================================

/**
 * Snapshot des KPIs calculés au moment de la validation de l'étape finance.
 * Stocké en DB pour audit / synthèse sans recalcul.
 *
 * Créé uniquement via handleValidate("finance") dans le wizard.
 */
export interface FinanceSnapshot {
  /** Date de validation (ISO) */
  validatedAt: string;

  // ── Contexte (figé pour audit) ──
  /** kWc au moment du calcul (depuis bâtiment) */
  kwc: number;
  /** Productible kWh/kWc (depuis PVGIS) */
  productibleKwhPerKwc: number;
  /** Production annuelle kWh (kwc × productible) */
  productionAnnuelleKwh: number;
  /** Investissement total HT (€) */
  totalCost: number;
  /** Apport personnel (€ HT) */
  downPayment: number;
  /** Capital emprunté = totalCost − downPayment */
  capitalEmprunte: number;

  // ── KPIs principaux (identiques à FinanceKpis) ──
  /** TRI projet (%) — IRR sur flux EBE */
  triProjetPct: number | null;
  /** DSCR moyen sur la durée du BP */
  dscrMoyen: number;
  /** ROI sans autoconsommation (années) — payback 100% Tb */
  roiSansAccYears: number | null;
  /** ROI avec autoconsommation (années) — payback avec partAcc */
  roiAvecAccYears: number | null;

  // ── Année 1 (pour affichage synthèse) ──
  /** CA année 1 (€) */
  revenuAnnee1: number;
  /** Charges année 1 (€) */
  chargesAnnee1: number;
  /** Résultat net année 1 (€) */
  resultatNetAnnee1: number;

  // ── Agrégats 20 ans (pour bloc investisseur) ──
  /** Gain net d'exploitation 20 ans = cumul EBE − investissement total */
  gainNetExploitation20ans: number;

  // ── Séries complètes (pour graphique + annexe bancaire) ──
  /** Business plan 20 ans — une entrée par année */
  series: SnapshotYearRow[];
  /** Séries cumulatives pour graphique gains */
  cumulative: SnapshotCumulativeSeries;
}

/** Ligne BP simplifiée, sérialisable en JSON (pas de types imbriqués complexes) */
export interface SnapshotYearRow {
  year: number;
  caAcc: number;
  caTb: number;
  totalCa: number;
  maintenance: number;
  assurance: number;
  divers: number;
  ifer: number;
  totalCharges: number;
  ebe: number;
  amortissement: number;
  interets: number;
  rai: number;
  is: number;
  resultatNet: number;
  dscr: number;
}

/** Séries cumulatives sérialisables */
export interface SnapshotCumulativeSeries {
  cumulativeCaAvecAcc: number[];
  cumulativeCaSansAcc: number[];
  cumulativeEbe: number[];
  cumulativeDeficit: number[];
  cumulativeIS: number[];
  costLine: number;
}

// ============================================================================
// DONNÉES READONLY (passées en props, jamais dans FinanceState)
// ============================================================================

/**
 * Données issues du bâtiment + PVGIS, passées en lecture seule à l'éditeur finance.
 */
export interface FinanceReadonlyData {
  /** Puissance crête totale (kWc) — depuis BuildingDerived */
  kwc: number;
  /** Productible spécifique (kWh/kWc/an) — depuis PVGIS */
  productibleKwhPerKwc: number;
  /** Production annuelle totale (kWh/an) — depuis PVGIS */
  productionAnnuelleKwh: number;
  /** Infos bâtiment pour lookup grille tarifaire (optionnel) */
  buildingInfo?: { type: BuildingType; width: number; nbSpans: number };
}

// ============================================================================
// DEFAULTS FACTORY
// ============================================================================

export const DEFAULT_FINANCE_COSTS: FinanceCosts = {
  installation: 0,
  charpente: 0,
  couverture: 0,
  fondations: 0,
  raccordement: 0,
  developpement: 0,
  fraisCommerciaux: 0,
  soulte: 0,
};

export const DEFAULT_FINANCE_OPTIONS: FinanceOptions = {
  bardage: 0,
  cheneaux: 0,
  batterie: 0,
};

export const DEFAULT_FINANCE_INFLATION: FinanceInflation = {
  inflTb: 1,
  inflAcc: 2,
  inflMaintenance: 1,
  inflAssurance: 2,
  inflDivers: 2,
  inflIfer: 1,
};

export const DEFAULT_FINANCE_FISCAL: FinanceFiscal = {
  taxRatePct: 25,
  iferEurPerKwc: 8.36,
  durationYears: 20,
};

/**
 * Crée un FinanceState avec les valeurs par défaut.
 * Aucun champ kWc/productible — ils sont readonly et passés en props.
 *
 * Si `kwc` est fourni, les coûts sont pré-remplis selon les barèmes Nelson :
 *   installation = 500 €/kWc, fraisCommerciaux = 50 €/kWc
 *
 * Si `buildingInfo` est fourni (type, width, nbSpans), on cherche le tarif réel
 * dans la grille tarifaire Nelson (fondations + charpente + couverture).
 * Le tarif est réparti : charpente 50%, couverture 25%, fondations 25%.
 *
 * Sinon fallback sur les montants fixes : charpente 30k + couverture 15k + fondations 15k.
 */
export function createDefaultFinanceState(
  kwc?: number,
  buildingInfo?: { type: BuildingType; width: number; nbSpans: number },
): FinanceState {
  const k = kwc ?? 0;

  // Coûts bâtiment : grille réelle ou fallback
  let charpente = 30_000;
  let couverture = 15_000;
  let fondations = 15_000;

  if (buildingInfo) {
    const result = lookupBuildingCost(
      buildingInfo.type,
      buildingInfo.width,
      buildingInfo.nbSpans,
    );
    if (result) {
      // Répartition du tarif global : 50% charpente, 25% couverture, 25% fondations
      charpente = Math.round(result.tarif * 0.5);
      couverture = Math.round(result.tarif * 0.25);
      fondations = result.tarif - charpente - couverture; // le reste pour éviter les erreurs d'arrondi
    }
  }

  return {
    tarifTb: 0.1312,
    tarifAcc: 0.18,
    partAccPct: 0,
    interestRatePct: 3.9,
    downPayment: 0,
    costs: {
      installation: Math.round(500 * k),
      charpente,
      couverture,
      fondations,
      raccordement: 15_000,
      developpement: 5_000,
      fraisCommerciaux: Math.round(50 * k),
      soulte: 0,
    },
    maintenanceEurPerKwc: 10,
    options: { ...DEFAULT_FINANCE_OPTIONS },
    inflation: { ...DEFAULT_FINANCE_INFLATION },
    fiscal: { ...DEFAULT_FINANCE_FISCAL },
  };
}
