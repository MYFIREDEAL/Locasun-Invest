/**
 * offre-agri-mapper.ts — Convertit un FinanceSnapshot en OffreAgriData
 *
 * Module pur TypeScript, sans React, testable unitairement.
 * Utilise extend-to-30 pour les calculs 30 ans.
 *
 * Aucun recalcul financier — juste de l'extraction + mise en forme
 * des données déjà présentes dans le snapshot.
 */

import type { FinanceSnapshot } from "@/lib/types/finance";
import type { OffreAgriData, TresorerieDeficitRow } from "@/lib/types/offre";
import { computeExtendedRows, cumulativeEbe30 } from "@/app/(app)/projects/[id]/components/extend-to-30";

// ============================================================================
// MAPPER
// ============================================================================

/**
 * Transforme un FinanceSnapshot en données pour le template Offre Agri.
 *
 * @param snapshot — Le snapshot figé depuis la validation Finance.
 * @returns OffreAgriData prêt pour le rendu du template.
 */
export function mapSnapshotToOffreAgri(snapshot: FinanceSnapshot): OffreAgriData {
  // ── 20 ans ──
  const ebeArr = snapshot.cumulative.cumulativeEbe ?? [];
  const cumulEbe20 = ebeArr[ebeArr.length - 1] ?? 0;
  const gainNet20ans = cumulEbe20 - snapshot.totalCost;
  const multiplicateur20 = snapshot.totalCost > 0
    ? cumulEbe20 / snapshot.totalCost
    : 0;

  // ── 30 ans ──
  const extendedRows = computeExtendedRows(snapshot);
  const cumulEbe30Val = cumulativeEbe30(snapshot, extendedRows);
  const gainNet30ans = cumulEbe30Val - snapshot.totalCost;
  const multiplicateur30 = snapshot.totalCost > 0
    ? cumulEbe30Val / snapshot.totalCost
    : 0;

  // ── Trésorerie année 1 ──
  const y1 = snapshot.series[0];
  const caAnnee1 = y1?.totalCa ?? 0;
  const chargesAnnee1 = y1?.totalCharges ?? 0;
  const ebeAnnee1 = y1?.ebe ?? 0;
  const annuiteAnnee1 = y1 ? y1.amortissement + y1.interets : 0;
  const tresoNetteAnnee1 = ebeAnnee1 - annuiteAnnee1;

  // ── Année d'équilibre ──
  let anneeEquilibre: number | null = null;
  for (const row of snapshot.series) {
    const annuiteRow = row.amortissement + row.interets;
    if (row.ebe >= annuiteRow) {
      anneeEquilibre = row.year;
      break;
    }
  }

  // ── Déficits trésorerie (années où EBE < annuité) ──
  const rawDeficits: { year: number; deficit: number }[] = [];
  let totalReserve = 0;

  for (const row of snapshot.series) {
    const annuite = row.amortissement + row.interets;
    const tresoNette = row.ebe - annuite;
    if (tresoNette < 0) {
      const deficit = Math.abs(tresoNette);
      rawDeficits.push({ year: row.year, deficit });
      totalReserve += deficit;
    } else {
      break; // Les déficits sont consécutifs en début de BP
    }
  }

  const reserve = Math.ceil(totalReserve / 100) * 100;

  // Construire les lignes avec "reste en réserve"
  let remaining = reserve;
  const deficits: TresorerieDeficitRow[] = rawDeficits.map((d) => {
    remaining -= d.deficit;
    return {
      year: d.year,
      deficit: d.deficit,
      resteReserve: Math.round(remaining),
    };
  });

  return {
    // Header metrics
    capitalInvesti: snapshot.totalCost,
    gainNet20ans,
    multiplicateur20,
    gainNet30ans,
    multiplicateur30,

    // KPIs
    triProjetPct: snapshot.triProjetPct,
    dscrMoyen: snapshot.dscrMoyen,
    roiSansAccYears: snapshot.roiSansAccYears,
    roiAvecAccYears: snapshot.roiAvecAccYears,

    // Trésorerie An 1
    caAnnee1,
    chargesAnnee1,
    ebeAnnee1,
    annuiteAnnee1,
    tresoNetteAnnee1,
    anneeEquilibre,

    // Besoin trésorerie
    reserveTotal: reserve,
    nbAnneesDeficit: rawDeficits.length,
    deficits,

    // Contexte
    downPayment: snapshot.downPayment ?? 0,
    kwc: snapshot.kwc,
    productionAnnuelleKwh: snapshot.productionAnnuelleKwh,
    validatedAt: snapshot.validatedAt,
  };
}
