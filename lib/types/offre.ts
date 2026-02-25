/**
 * Types pour le module Offres — Présentation commerciale d'un projet
 *
 * L'offre est générée à partir du FinanceSnapshot (figé lors de la validation Finance).
 * Plusieurs templates possibles : Agri/Particulier, Développeur, etc.
 */

// ============================================================================
// OFFRE AGRI — Données pour le template agriculteur/particulier
// ============================================================================

/** Ligne du tableau "besoin trésorerie" (années à trésorerie négative) */
export interface TresorerieDeficitRow {
  /** Numéro de l'année (1, 2, 3…) */
  year: number;
  /** Montant à sortir de sa poche cette année (positif) */
  deficit: number;
  /** Réserve restante après cette année */
  resteReserve: number;
}

/**
 * Données structurées pour le template Offre Agri.
 * Produites par `mapSnapshotToOffreAgri()` à partir d'un FinanceSnapshot.
 * Aucun recalcul complexe — juste de la mise en forme.
 */
export interface OffreAgriData {
  // ── Header metrics ──
  /** Investissement total HT (€) */
  capitalInvesti: number;
  /** Gain net exploitation 20 ans (€) — cumulEBE20 − totalCost */
  gainNet20ans: number;
  /** Multiplicateur 20 ans — cumulEBE20 / totalCost */
  multiplicateur20: number;
  /** Gain net exploitation 30 ans (€) */
  gainNet30ans: number;
  /** Multiplicateur 30 ans */
  multiplicateur30: number;

  // ── KPIs ──
  /** TRI projet (%) ou null */
  triProjetPct: number | null;
  /** DSCR moyen */
  dscrMoyen: number;
  /** ROI sans autoconsommation (années) ou null */
  roiSansAccYears: number | null;
  /** ROI avec autoconsommation (années) ou null */
  roiAvecAccYears: number | null;

  // ── Trésorerie An 1 ──
  /** CA année 1 (€) */
  caAnnee1: number;
  /** Charges d'exploitation année 1 (€) */
  chargesAnnee1: number;
  /** EBE année 1 (€) */
  ebeAnnee1: number;
  /** Annuité crédit année 1 = amortissement + intérêts (€) */
  annuiteAnnee1: number;
  /** Trésorerie nette année 1 = EBE − annuité (€) */
  tresoNetteAnnee1: number;
  /** Année où la trésorerie nette devient positive (1-indexed) ou null */
  anneeEquilibre: number | null;

  // ── Besoin trésorerie ──
  /** Montant total de réserve à prévoir (€, arrondi aux 100€ supérieurs) */
  reserveTotal: number;
  /** Nombre d'années de déficit trésorerie */
  nbAnneesDeficit: number;
  /** Détail par année de déficit */
  deficits: TresorerieDeficitRow[];

  // ── Contexte ──
  /** Apport personnel (€) */
  downPayment: number;
  /** Puissance installée (kWc) */
  kwc: number;
  /** Production annuelle (kWh/an) */
  productionAnnuelleKwh: number;
  /** Date de validation du snapshot (ISO) */
  validatedAt: string;
}
