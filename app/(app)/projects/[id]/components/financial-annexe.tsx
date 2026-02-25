"use client";

/**
 * FinancialAnnexe — Annexe bancaire : Business Plan 20 ans + 30 ans
 *
 * Deux accordéons collapsibles (fermés par défaut) :
 *   1) BP 20 ans — données du snapshot
 *   2) BP 30 ans — 20 ans snapshot + 10 ans projetés (dette remboursée)
 *
 * Colonnes : Année, CA, Charges, EBE, Intérêts, RAI, IS, Résultat Net, DSCR
 * Labels sticky à gauche, format fr-FR, DSCR coloré.
 *
 * Lecture seule — données venant de FinanceSnapshot.series + extend-to-30.
 */

import { useState, useMemo } from "react";
import type { FinanceSnapshot, SnapshotYearRow } from "@/lib/types/finance";
import { computeExtendedRows } from "./extend-to-30";

// ============================================================================
// HELPERS
// ============================================================================

function fmt(n: number): string {
  return n.toLocaleString("fr-FR", { maximumFractionDigits: 0 });
}

function fmtDscr(n: number): string {
  return n.toFixed(2);
}

// ============================================================================
// PROPS
// ============================================================================

interface FinancialAnnexeProps {
  snapshot: FinanceSnapshot;
}

// ============================================================================
// COLUMN DEFINITION (30-ans aware: DSCR → "—" si debtService = 0)
// ============================================================================

interface ColDef {
  key: string;
  label: string;
  shortLabel: string;
  getValue: (row: SnapshotYearRow) => string;
  getColor?: (row: SnapshotYearRow) => string;
  align?: "left" | "right";
}

/**
 * Builds column definitions.
 * @param debtFreeYears - Set of years where debt service = 0 (DSCR shown as "—")
 */
function buildColumns(debtFreeYears: Set<number>): ColDef[] {
  return [
    {
      key: "year",
      label: "Année",
      shortLabel: "An",
      getValue: (r) => String(r.year),
      align: "left",
    },
    {
      key: "totalCa",
      label: "Chiffre d\u2019affaires",
      shortLabel: "CA",
      getValue: (r) => fmt(r.totalCa),
    },
    {
      key: "totalCharges",
      label: "Charges",
      shortLabel: "Charges",
      getValue: (r) => fmt(r.totalCharges),
    },
    {
      key: "ebe",
      label: "EBE",
      shortLabel: "EBE",
      getValue: (r) => fmt(r.ebe),
      getColor: (r) => (r.ebe >= 0 ? "" : "text-red-600"),
    },
    {
      key: "interets",
      label: "Intérêts",
      shortLabel: "Int.",
      getValue: (r) => fmt(r.interets),
    },
    {
      key: "rai",
      label: "RAI",
      shortLabel: "RAI",
      getValue: (r) => fmt(r.rai),
      getColor: (r) => (r.rai >= 0 ? "" : "text-red-600"),
    },
    {
      key: "is",
      label: "IS",
      shortLabel: "IS",
      getValue: (r) => fmt(r.is),
    },
    {
      key: "resultatNet",
      label: "Résultat net",
      shortLabel: "RN",
      getValue: (r) => fmt(r.resultatNet),
      getColor: (r) =>
        r.resultatNet >= 0 ? "text-green-700 font-semibold" : "text-red-600 font-semibold",
    },
    {
      key: "dscr",
      label: "DSCR",
      shortLabel: "DSCR",
      getValue: (r) => (debtFreeYears.has(r.year) ? "—" : fmtDscr(r.dscr)),
      getColor: (r) =>
        debtFreeYears.has(r.year)
          ? "text-gray-400"
          : r.dscr >= 1.3
            ? "text-green-700 font-semibold"
            : r.dscr >= 1.0
              ? "text-amber-600 font-semibold"
              : "text-red-600 font-semibold",
    },
  ];
}

// ============================================================================
// TOTALS ROW
// ============================================================================

function computeTotals(
  series: SnapshotYearRow[],
  debtFreeYears: Set<number>,
): Record<string, string> {
  const sumCa = series.reduce((s, r) => s + r.totalCa, 0);
  const sumCharges = series.reduce((s, r) => s + r.totalCharges, 0);
  const sumEbe = series.reduce((s, r) => s + r.ebe, 0);
  const sumInt = series.reduce((s, r) => s + r.interets, 0);
  const sumRai = series.reduce((s, r) => s + r.rai, 0);
  const sumIs = series.reduce((s, r) => s + r.is, 0);
  const sumRn = series.reduce((s, r) => s + r.resultatNet, 0);
  // DSCR moyen uniquement sur les années avec dette
  const withDebt = series.filter((r) => !debtFreeYears.has(r.year));
  const avgDscr =
    withDebt.length > 0
      ? withDebt.reduce((s, r) => s + r.dscr, 0) / withDebt.length
      : 0;

  return {
    year: "Total",
    totalCa: fmt(sumCa),
    totalCharges: fmt(sumCharges),
    ebe: fmt(sumEbe),
    interets: fmt(sumInt),
    rai: fmt(sumRai),
    is: fmt(sumIs),
    resultatNet: fmt(sumRn),
    dscr: withDebt.length > 0 ? fmtDscr(avgDscr) : "—",
  };
}

// ============================================================================
// GENERIC BP TABLE (shared between 20 ans & 30 ans)
// ============================================================================

function BpTable({
  series,
  columns,
  totals,
  highlightFromYear,
}: {
  series: SnapshotYearRow[];
  columns: ColDef[];
  totals: Record<string, string>;
  highlightFromYear?: number;
}) {
  return (
    <div className="overflow-x-auto border-t border-gray-100">
      <table className="w-full text-xs tabular-nums">
        <thead>
          <tr className="bg-gray-50">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-3 py-2 font-semibold text-gray-600 whitespace-nowrap ${
                  col.key === "year" ? "sticky left-0 bg-gray-50 z-10 text-left" : "text-right"
                }`}
              >
                <span className="hidden md:inline">{col.label}</span>
                <span className="md:hidden">{col.shortLabel}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {series.map((row) => {
            const isExtended = highlightFromYear !== undefined && row.year >= highlightFromYear;
            return (
              <tr
                key={row.year}
                className={`border-t border-gray-50 ${
                  isExtended ? "bg-emerald-50/40 hover:bg-emerald-50/60" : "hover:bg-blue-50/30"
                }`}
              >
                {columns.map((col) => {
                  const colorClass = col.getColor ? col.getColor(row) : "";
                  return (
                    <td
                      key={col.key}
                      className={`px-3 py-1.5 whitespace-nowrap ${colorClass} ${
                        col.key === "year"
                          ? `sticky left-0 z-10 font-medium text-gray-900 text-left ${isExtended ? "bg-emerald-50/40" : "bg-white"}`
                          : "text-right text-gray-700"
                      }`}
                    >
                      {col.getValue(row)}
                    </td>
                  );
                })}
              </tr>
            );
          })}
          {/* Totals row */}
          <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold">
            {columns.map((col) => (
              <td
                key={col.key}
                className={`px-3 py-2 whitespace-nowrap ${
                  col.key === "year"
                    ? "sticky left-0 bg-gray-50 z-10 text-left text-gray-900"
                    : "text-right text-gray-900"
                } ${col.key === "resultatNet" ? "text-green-700" : ""} ${col.key === "dscr" ? "text-blue-700" : ""}`}
              >
                {totals[col.key] ?? ""}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ============================================================================
// ACCORDION WRAPPER
// ============================================================================

function Accordion({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-6 py-4 text-left hover:bg-gray-50 transition-colors"
        type="button"
      >
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          {title}
        </h3>
        <svg
          className={`h-5 w-5 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && children}
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function FinancialAnnexe({ snapshot }: FinancialAnnexeProps) {
  const [open20, setOpen20] = useState(false);
  const [open30, setOpen30] = useState(false);
  const { series, cumulative } = snapshot;

  // ── 20 ans ──
  const debtFreeYears20 = new Set<number>();
  const columns20 = useMemo(() => buildColumns(debtFreeYears20), []);
  const totals20 = useMemo(() => computeTotals(series, debtFreeYears20), [series]);

  // ── Badge dynamique : état fiscal courant (dernière année du BP 20 ans) ──
  const deficitArr = cumulative.cumulativeDeficit ?? [];
  const lastDeficit = deficitArr[deficitArr.length - 1] ?? 0;
  const lastIS = series[series.length - 1]?.is ?? 0;
  const fiscalBadge: { label: string; color: string } =
    lastDeficit > 0
      ? { label: "Report de déficit en cours", color: "bg-amber-100 text-amber-800" }
      : lastIS > 0
        ? { label: "Phase imposable", color: "bg-green-100 text-green-800" }
        : { label: "Pas d\u2019IS", color: "bg-gray-100 text-gray-600" };

  // ── 30 ans ──
  const extendedRows = useMemo(() => computeExtendedRows(snapshot), [snapshot]);
  const series30 = useMemo(() => [...series, ...extendedRows], [series, extendedRows]);
  const debtFreeYears30 = useMemo(() => {
    const set = new Set<number>();
    for (const r of extendedRows) set.add(r.year);
    return set;
  }, [extendedRows]);
  const columns30 = useMemo(() => buildColumns(debtFreeYears30), [debtFreeYears30]);
  const totals30 = useMemo(() => computeTotals(series30, debtFreeYears30), [series30, debtFreeYears30]);

  return (
    <div className="space-y-3">
      {/* ═══════════════ Accordéon 20 ans ═══════════════ */}
      <Accordion
        title={`\uD83C\uDFE6 Annexe bancaire — Business Plan ${series.length} ans`}
        open={open20}
        onToggle={() => setOpen20(!open20)}
      >
        {/* Encadré fiscal */}
        <div className="mx-6 mt-4 mb-3 rounded-md border border-blue-200 bg-blue-50/60 px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold text-blue-900 flex items-center gap-1.5">
              🧾 Traitement fiscal du projet
            </h4>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${fiscalBadge.color}`}
            >
              {fiscalBadge.label}
            </span>
          </div>
          <ul className="text-xs text-blue-800 space-y-0.5 list-disc list-inside">
            <li>Les premières années peuvent générer un déficit fiscal.</li>
            <li>Ce déficit est reporté sur les années suivantes.</li>
            <li>Aucun impôt n&apos;est payé tant que le cumul fiscal n&apos;est pas redevenu positif.</li>
            <li>L&apos;impôt est différé, pas supprimé.</li>
          </ul>
        </div>
        <BpTable series={series} columns={columns20} totals={totals20} />
      </Accordion>

      {/* ═══════════════ Accordéon 30 ans ═══════════════ */}
      <Accordion
        title={`\uD83C\uDFE6 Annexe bancaire — Business Plan 30 ans`}
        open={open30}
        onToggle={() => setOpen30(!open30)}
      >
        {/* Bandeau explicatif */}
        <div className="mx-6 mt-4 mb-3 rounded-md border border-emerald-200 bg-emerald-50/60 px-4 py-3">
          <p className="text-xs text-emerald-800">
            <strong>À partir de l&apos;année 21, la dette est remboursée : exploitation pure.</strong>{" "}
            Les intérêts et l&apos;amortissement sont à zéro. Le DSCR n&apos;est plus applicable (affiché « — »).
          </p>
        </div>
        <BpTable
          series={series30}
          columns={columns30}
          totals={totals30}
          highlightFromYear={series.length + 1}
        />
      </Accordion>
    </div>
  );
}
