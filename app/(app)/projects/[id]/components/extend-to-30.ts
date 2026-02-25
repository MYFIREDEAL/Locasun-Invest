/**
 * extend-to-30.ts — Projection 30 ans à partir d'un snapshot 20 ans
 *
 * Années 21→30 : dette intégralement remboursée.
 *   - amortissement = 0
 *   - intérêts = 0
 *   - dach (dette) = 0
 *   - DSCR = 0 (debtService = 0 → affiché "—" par le composant)
 *
 * CA et charges continuent leur trajectoire d'inflation
 * en extrapolant le taux de croissance moyen observé sur les 20 premières années.
 *
 * Module pur TypeScript, aucun effet de bord.
 */

import type { SnapshotYearRow, FinanceSnapshot } from "@/lib/types/finance";

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Calcule le taux de croissance annuel moyen (CAGR) entre la 1ère et la dernière année.
 * Retourne 0 si les données sont insuffisantes.
 */
function cagr(first: number, last: number, n: number): number {
  if (n <= 1 || first <= 0) return 0;
  return Math.pow(last / first, 1 / (n - 1)) - 1;
}

// ============================================================================
// EXTENDED ROWS
// ============================================================================

/**
 * Génère les lignes 21→30 en extrapolant les tendances du BP 20 ans.
 * Le déficit fiscal reportable continue d'être consommé.
 */
export function computeExtendedRows(
  snapshot: FinanceSnapshot,
): SnapshotYearRow[] {
  const { series } = snapshot;
  if (series.length === 0) return [];

  const N = series.length; // 20
  const first = series[0]!;
  const last = series[N - 1]!;

  // Taux de croissance annuels moyens
  const caGrowth = cagr(first.totalCa, last.totalCa, N);
  const chargesGrowth = cagr(first.totalCharges, last.totalCharges, N);

  // Ratio CA détaillé (pour répartir caAcc / caTb)
  const accRatio = last.totalCa > 0 ? last.caAcc / last.totalCa : 0;

  // Taux d'IS (déduit des données existantes)
  // Chercher une année avec IS > 0 et RAI > 0 pour déduire le taux
  let taxRate = 0.25; // fallback 25%
  for (let i = N - 1; i >= 0; i--) {
    const row = series[i]!;
    if (row.rai > 0 && row.is > 0) {
      taxRate = row.is / row.rai;
      break;
    }
  }

  // Ratio charges détaillé (basé sur dernière année)
  const totalChargesLast = last.totalCharges;
  const maintRatio = totalChargesLast > 0 ? last.maintenance / totalChargesLast : 0.25;
  const assurRatio = totalChargesLast > 0 ? last.assurance / totalChargesLast : 0.25;
  const divRatio = totalChargesLast > 0 ? last.divers / totalChargesLast : 0.25;
  const iferRatio = totalChargesLast > 0 ? last.ifer / totalChargesLast : 0.25;

  // Récupérer le déficit reportable en fin d'année 20
  const deficitArr = snapshot.cumulative.cumulativeDeficit ?? [];
  let deficitReportable = deficitArr[deficitArr.length - 1] ?? 0;

  const extended: SnapshotYearRow[] = [];

  for (let j = 0; j < 10; j++) {
    const i = N + j; // index 0-based global (20..29)
    const year = i + 1; // 21..30

    // Extrapolation CA et charges depuis l'année 1 (index 0)
    const totalCa = first.totalCa * Math.pow(1 + caGrowth, i);
    const caAcc = totalCa * accRatio;
    const caTb = totalCa - caAcc;

    const totalCharges = first.totalCharges * Math.pow(1 + chargesGrowth, i);
    const maintenance = totalCharges * maintRatio;
    const assurance = totalCharges * assurRatio;
    const divers = totalCharges * divRatio;
    const ifer = totalCharges * iferRatio;

    // EBE
    const ebe = totalCa - totalCharges;

    // Financement : dette remboursée
    const amortissement = 0;
    const dach = 0;
    const interets = 0;

    // Résultat
    const rbt = ebe - amortissement; // = ebe
    const rai = rbt - interets; // = ebe

    // IS avec report de déficit
    let is: number;
    if (rai < 0) {
      deficitReportable += Math.abs(rai);
      is = 0;
    } else {
      const taxableBase = Math.max(0, rai - deficitReportable);
      is = taxableBase * taxRate;
      deficitReportable = Math.max(0, deficitReportable - rai);
    }

    const resultatNet = rai - is;

    // DSCR : debtService = 0 → 0 (affiché "—" par le composant)
    const dscr = 0;

    extended.push({
      year,
      caAcc,
      caTb,
      totalCa,
      maintenance,
      assurance,
      divers,
      ifer,
      totalCharges,
      ebe,
      amortissement,
      interets,
      rai,
      is,
      resultatNet,
      dscr,
    });
  }

  return extended;
}

// ============================================================================
// CUMULATIVE EBE 30 ANS
// ============================================================================

/**
 * Calcule le cumul EBE sur 30 ans (20 ans snapshot + 10 ans extension).
 */
export function cumulativeEbe30(
  snapshot: FinanceSnapshot,
  extendedRows: SnapshotYearRow[],
): number {
  const ebeArr = snapshot.cumulative.cumulativeEbe ?? [];
  const cumul20 = ebeArr[ebeArr.length - 1] ?? 0;
  const sumExt = extendedRows.reduce((s, r) => s + r.ebe, 0);
  return cumul20 + sumExt;
}
