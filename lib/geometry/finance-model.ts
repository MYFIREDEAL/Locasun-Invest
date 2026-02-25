/**
 * finance-model.ts — Moteur de calcul financier déterministe
 *
 * Module pur TypeScript, sans React, testable unitairement.
 *
 * Entrées :
 *   - kwc              (from bâtiment, readonly)
 *   - productibleKwhPerKwc (from PVGIS, readonly)
 *   - FinanceState      (inputs éditables)
 *
 * Sortie : FinanceModelResult
 *   - productionAnnualKwh, totalCost
 *   - KPIs : triProjetPct, dscrMoyen, roiSansAccYears, roiAvecAccYears
 *   - Séries 20 ans (caAcc, caTb, totalCa, charges, ebe, amortissement, etc.)
 *   - Séries graphiques gains cumulés
 *
 * Les formules reproduisent EXACTEMENT les sorties Nelson.
 */

import type { FinanceState } from "@/lib/types/finance";

// ============================================================================
// OUTPUT TYPES
// ============================================================================

/** Charges d'une année donnée */
export interface YearCharges {
  maintenance: number;
  assurance: number;
  divers: number;
  ifer: number;
  totalCharges: number;
}

/** Ligne du business plan (1 par année, 0-indexed) */
export interface YearRow {
  year: number;               // 1..20
  // Revenus
  caAcc: number;              // CA autoconsommation
  caTb: number;               // CA vente totale (surplus)
  totalCa: number;            // CA total
  // Charges
  charges: YearCharges;
  // Exploitation
  ebe: number;                // Excédent Brut d'Exploitation
  // Financement
  amortissement: number;      // Amortissement linéaire constant
  dach: number;               // Reste dû (dette) début d'année
  interets: number;           // Intérêts sur dette restante
  // Résultat
  rbt: number;                // Résultat avant intérêts = EBE - amortissement
  rai: number;                // Résultat avant IS = rbt - interets
  is: number;                 // Impôt sur les sociétés
  resultatNet: number;        // Résultat net = rai - is
  // DSCR
  dscr: number;               // Debt Service Coverage Ratio
}

/** Séries pour graphique "Gains cumulés" */
export interface CumulativeSeries {
  /** Cumul CA avec partAcc (revenus réels) — par année */
  cumulativeCaAvecAcc: number[];
  /** Cumul CA sans autoconsommation (100% vente totale) — par année */
  cumulativeCaSansAcc: number[];
  /** Cumul EBE (CA − charges d'exploitation) — par année */
  cumulativeEbe: number[];
  /** Déficit fiscal reportable restant en fin d'année — par année */
  cumulativeDeficit: number[];
  /** IS payé cumulé — par année */
  cumulativeIS: number[];
  /** Ligne horizontale = totalCost (pour intersection = payback) */
  costLine: number;
}

/** KPIs agrégés */
export interface FinanceKpis {
  /** TRI projet (%) — IRR sur flux EBE */
  triProjetPct: number | null;
  /** DSCR moyen sur 20 ans */
  dscrMoyen: number;
  /** ROI sans autoconsommation (années) — payback 100% Tb */
  roiSansAccYears: number | null;
  /** ROI avec autoconsommation (années) — payback avec partAcc */
  roiAvecAccYears: number | null;
}

/** Résultat complet du modèle */
export interface FinanceModelResult {
  productionAnnualKwh: number;
  totalCost: number;
  /** Apport personnel (€) */
  downPayment: number;
  /** Capital emprunté = totalCost − downPayment */
  capitalEmprunte: number;
  kpis: FinanceKpis;
  series: YearRow[];
  cumulative: CumulativeSeries;
}

// ============================================================================
// CONSTANTES CHARGES (€/kWc/an de base)
// ============================================================================

/** Assurance — base €/kWc/an (indexée inflAssurance) */
const ASSURANCE_EUR_PER_KWC = 11.5;

/** Divers / frais généraux — base €/kWc/an (indexée inflDivers) */
const DIVERS_EUR_PER_KWC = 12.0;

// ============================================================================
// IRR (Internal Rate of Return) — Newton-Raphson
// ============================================================================

/**
 * Calcul du TRI par Newton-Raphson.
 * cashflows[0] = investissement initial (négatif), cashflows[1..N] = flux annuels.
 * Retourne le taux en % (ex: 9.98) ou null si pas de convergence.
 */
function computeIRR(cashflows: number[], maxIter = 200, tol = 1e-8): number | null {
  // Vérifications de base
  if (cashflows.length < 2) return null;
  if (cashflows[0]! >= 0) return null;

  let rate = 0.10; // guess initial 10%

  for (let iter = 0; iter < maxIter; iter++) {
    let npv = 0;
    let dnpv = 0; // dérivée

    for (let t = 0; t < cashflows.length; t++) {
      const cf = cashflows[t]!;
      const discount = Math.pow(1 + rate, t);
      npv += cf / discount;
      if (t > 0) {
        dnpv -= (t * cf) / Math.pow(1 + rate, t + 1);
      }
    }

    if (Math.abs(dnpv) < 1e-14) {
      // Dérivée quasi-nulle → essayer un autre guess
      rate += 0.01;
      continue;
    }

    const newRate = rate - npv / dnpv;

    if (Math.abs(newRate - rate) < tol) {
      return newRate * 100; // en %
    }

    rate = newRate;

    // Garder le taux dans des bornes raisonnables
    if (rate < -0.99) rate = -0.5;
    if (rate > 10) rate = 5;
  }

  return null; // pas de convergence
}

// ============================================================================
// PAYBACK (années avec interpolation linéaire)
// ============================================================================

/**
 * Calcule le délai de retour (payback) en années avec interpolation.
 * cumulativeCa[i] = cumul des CA de l'année 1 à l'année i+1.
 * Retourne le nombre d'années (décimal) ou null si jamais atteint.
 */
function computePayback(totalCost: number, cumulativeCa: number[]): number | null {
  // cumulativeCa[i] = cumul CA des années 1..i+1
  // Le payback est exprimé en "années d'exploitation" 0-indexed :
  //   année 0 = première année de production.
  for (let i = 0; i < cumulativeCa.length; i++) {
    if (cumulativeCa[i]! >= totalCost) {
      if (i === 0) {
        // Seuil atteint durant la première année
        const fraction = totalCost / cumulativeCa[0]!;
        return fraction; // e.g. 0.8 = 80% de la 1ère année
      }
      const prev = cumulativeCa[i - 1]!;
      const curr = cumulativeCa[i]!;
      const delta = curr - prev;
      if (delta <= 0) return i;
      // Interpolation linéaire dans l'année i+1
      const fraction = (totalCost - prev) / delta;
      return (i - 1) + fraction;
    }
  }
  return null; // jamais rentabilisé sur la durée
}

// ============================================================================
// TOTAL COST
// ============================================================================

function computeTotalCost(state: FinanceState): number {
  const c = state.costs;
  const o = state.options;
  return (
    c.installation +
    c.charpente +
    c.couverture +
    c.fondations +
    c.raccordement +
    c.developpement +
    c.fraisCommerciaux +
    c.soulte +
    o.bardage +
    o.cheneaux +
    o.batterie
  );
}

// ============================================================================
// MAIN MODEL
// ============================================================================

export function computeFinanceModel(
  kwc: number,
  productibleKwhPerKwc: number,
  state: FinanceState,
): FinanceModelResult {
  const N = state.fiscal.durationYears; // 20

  // ── 1. Production ──
  const productionAnnualKwh = kwc * productibleKwhPerKwc;

  // ── 2. Répartition énergie ──
  const accKwh = productionAnnualKwh * (state.partAccPct / 100);
  const tbKwh = productionAnnualKwh - accKwh;

  // ── Pour ROI sans acc : 100% vente totale ──
  const tbKwhSansAcc = productionAnnualKwh;

  // ── 6. Coût total ──
  const totalCost = computeTotalCost(state);

  // ── Apport → capital emprunté ──
  const downPayment = Math.min(state.downPayment ?? 0, totalCost); // sécurité : pas plus que le total
  const capitalEmprunte = totalCost - downPayment;

  // ── Amortissement linéaire constant (sur le capital emprunté) ──
  const amortissement = capitalEmprunte / N;

  // ── Inflations (en décimal) ──
  const inflTb = state.inflation.inflTb / 100;
  const inflAcc = state.inflation.inflAcc / 100;
  const inflMaint = state.inflation.inflMaintenance / 100;
  const inflAssur = state.inflation.inflAssurance / 100;
  const inflDiv = state.inflation.inflDivers / 100;
  const inflIfer = state.inflation.inflIfer / 100;
  const interestRate = state.interestRatePct / 100;
  const taxRate = state.fiscal.taxRatePct / 100;

  // ── IFER : 0 si kWc ≤ 100 ──
  const iferBase = kwc <= 100 ? 0 : kwc * state.fiscal.iferEurPerKwc;

  // ── Séries ──
  const series: YearRow[] = [];
  const ebeSeries: number[] = []; // pour IRR
  const cumulCaAvecAcc: number[] = [];
  const cumulCaSansAcc: number[] = [];
  const cumulEbe: number[] = [];
  const cumulDeficit: number[] = [];
  const cumulIS: number[] = [];

  let sumCaAvecAcc = 0;
  let sumCaSansAcc = 0;
  let sumEbe = 0;
  let sumIS = 0;
  let sumDscr = 0;
  let deficitReportable = 0; // Report de déficit fiscal

  for (let i = 0; i < N; i++) {
    const year = i + 1;

    // ── 3. CA annuel (année i, i=0..19) ──
    const caAcc = accKwh * state.tarifAcc * Math.pow(1 + inflAcc, i);
    const caTb = tbKwh * state.tarifTb * Math.pow(1 + inflTb, i);
    const totalCa = caAcc + caTb;

    // CA sans autoconsommation (pour ROI sans acc)
    const caTbSansAcc = tbKwhSansAcc * state.tarifTb * Math.pow(1 + inflTb, i);

    // ── 4. Charges ──
    const maintenance = kwc * state.maintenanceEurPerKwc * Math.pow(1 + inflMaint, i);
    const assurance = kwc * ASSURANCE_EUR_PER_KWC * Math.pow(1 + inflAssur, i);
    const divers = kwc * DIVERS_EUR_PER_KWC * Math.pow(1 + inflDiv, i);
    const ifer = iferBase * Math.pow(1 + inflIfer, i);
    const totalCharges = maintenance + assurance + divers + ifer;

    // ── 5. EBE ──
    const ebe = totalCa - totalCharges;

    // ── 8. Financement ──
    const dach = capitalEmprunte - amortissement * i; // reste dû début d'année (sur capital emprunté)
    const interets = dach * interestRate;

    // ── 9. Résultat BP (avec report de déficit fiscal) ──
    const rbt = ebe - amortissement;
    const rai = rbt - interets;

    let is: number;
    if (rai < 0) {
      // Année déficitaire → IS = 0, on accumule le déficit
      deficitReportable += Math.abs(rai);
      is = 0;
    } else {
      // Année bénéficiaire → on impute le déficit reportable
      const taxableBase = Math.max(0, rai - deficitReportable);
      is = taxableBase * taxRate;
      deficitReportable = Math.max(0, deficitReportable - rai);
    }

    const resultatNet = rai - is;

    // ── 10. DSCR ──
    const debtService = amortissement + interets;
    const dscr = debtService > 0 ? ebe / debtService : 0;
    sumDscr += dscr;

    // ── Cumuls pour ROI ──
    sumCaAvecAcc += totalCa;
    sumCaSansAcc += caTbSansAcc;
    sumEbe += ebe;
    cumulCaAvecAcc.push(sumCaAvecAcc);
    cumulCaSansAcc.push(sumCaSansAcc);
    cumulEbe.push(sumEbe);
    sumIS += is;
    cumulDeficit.push(deficitReportable);
    cumulIS.push(sumIS);

    ebeSeries.push(ebe);

    series.push({
      year,
      caAcc,
      caTb,
      totalCa,
      charges: { maintenance, assurance, divers, ifer, totalCharges },
      ebe,
      amortissement,
      dach,
      interets,
      rbt,
      rai,
      is,
      resultatNet,
      dscr,
    });
  }

  // ── 7. TRI Projet = IRR([-totalCost, EBE_1, ..., EBE_20]) ──
  const irrCashflows = [-totalCost, ...ebeSeries];
  const triProjetPct = computeIRR(irrCashflows);

  // ── 10. DSCR moyen ──
  const dscrMoyen = N > 0 ? sumDscr / N : 0;

  // ── 11. ROI (payback) ──
  const roiAvecAccYears = computePayback(totalCost, cumulCaAvecAcc);
  const roiSansAccYears = computePayback(totalCost, cumulCaSansAcc);

  return {
    productionAnnualKwh,
    totalCost,
    downPayment,
    capitalEmprunte,
    kpis: {
      triProjetPct: triProjetPct !== null ? Math.round(triProjetPct * 100) / 100 : null,
      dscrMoyen: Math.round(dscrMoyen * 100) / 100,
      roiSansAccYears: roiSansAccYears !== null ? Math.round(roiSansAccYears * 10) / 10 : null,
      roiAvecAccYears: roiAvecAccYears !== null ? Math.round(roiAvecAccYears * 10) / 10 : null,
    },
    series,
    cumulative: {
      cumulativeCaAvecAcc: cumulCaAvecAcc,
      cumulativeCaSansAcc: cumulCaSansAcc,
      cumulativeEbe: cumulEbe,
      cumulativeDeficit: cumulDeficit,
      cumulativeIS: cumulIS,
      costLine: totalCost,
    },
  };
}
