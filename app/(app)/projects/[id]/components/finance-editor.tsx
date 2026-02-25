"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { MutableRefObject } from "react";
import type { FinanceState, FinanceReadonlyData } from "@/lib/types/finance";
import { createDefaultFinanceState } from "@/lib/types/finance";
import { saveFinanceState } from "@/lib/actions/finance";
import {
  computeFinanceModel,
  type FinanceModelResult,
  type YearRow,
} from "@/lib/geometry/finance-model";

/* ─── Types ─── */

export type SaveRef = MutableRefObject<(() => Promise<boolean>) | null>;

interface FinanceEditorProps {
  projectId: string;
  initialState: FinanceState;
  readonly: FinanceReadonlyData;
  saveRef: SaveRef;
}

/* ─── Formatage fr-FR ─── */

const fmtEur = (v: number) =>
  Math.round(v).toLocaleString("fr-FR") + " €";
const fmtEurCompact = (v: number) =>
  Math.round(v).toLocaleString("fr-FR");
const fmtKwh = (v: number) =>
  Math.round(v).toLocaleString("fr-FR") + " kWh";
const fmtPct = (v: number | null) =>
  v !== null ? v.toFixed(2) + " %" : "—";
const fmtYears = (v: number | null) =>
  v !== null ? v.toFixed(1) + " ans" : "—";
const fmtDscr = (v: number) => v.toFixed(2);

/* ═══════════════════════════════════════════════════════════════════
 * FinanceEditor — Reproduit l'écran Nelson "Simulateur de Gain Producteur"
 *
 * Sections : Header, Paramètres, Coûts, KPIs, Graphique, Business Plan
 * Recalcul live via useMemo + computeFinanceModel
 * ═══════════════════════════════════════════════════════════════════ */

export function FinanceEditor({
  projectId,
  initialState,
  readonly: ro,
  saveRef,
}: FinanceEditorProps) {
  const [state, setState] = useState<FinanceState>(initialState);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  // ── helpers pour mettre à jour les champs imbriqués ──

  function setField<K extends keyof FinanceState>(key: K, value: FinanceState[K]) {
    setState((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }

  function setCost<K extends keyof FinanceState["costs"]>(key: K, value: number) {
    setState((prev) => ({ ...prev, costs: { ...prev.costs, [key]: value } }));
    setDirty(true);
  }

  function setOption<K extends keyof FinanceState["options"]>(key: K, value: number) {
    setState((prev) => ({ ...prev, options: { ...prev.options, [key]: value } }));
    setDirty(true);
  }

  function setInflation<K extends keyof FinanceState["inflation"]>(key: K, value: number) {
    setState((prev) => ({ ...prev, inflation: { ...prev.inflation, [key]: value } }));
    setDirty(true);
  }

  function setFiscal<K extends keyof FinanceState["fiscal"]>(key: K, value: number) {
    setState((prev) => ({ ...prev, fiscal: { ...prev.fiscal, [key]: value } }));
    setDirty(true);
  }

  // ── Recalcul live ──

  const model: FinanceModelResult = useMemo(
    () => computeFinanceModel(ro.kwc, ro.productibleKwhPerKwc, state),
    [ro.kwc, ro.productibleKwhPerKwc, state],
  );

  // ── Reset defaults Nelson ──

  function handleResetDefaults() {
    setState(createDefaultFinanceState(ro.kwc, ro.buildingInfo));
    setDirty(true);
  }

  // ── Sauvegarder (vers Supabase — state seulement, snapshot créé à la validation) ──

  const handleSave = useCallback(async (): Promise<boolean> => {
    setSaving(true);
    try {
      const res = await saveFinanceState(projectId, state);
      if (!res.success) return false;
      setDirty(false);
      return true;
    } finally {
      setSaving(false);
    }
  }, [projectId, state]);

  // ── Expose save via ref ──

  useEffect(() => {
    saveRef.current = handleSave;
    return () => {
      saveRef.current = null;
    };
  }, [handleSave, saveRef]);

  // ── Render ──

  return (
    <div className="space-y-6">
      {/* ━━━ HEADER ━━━ */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">
            ☀️ Simulateur de Gain Producteur
          </h2>
          <p className="mt-0.5 text-sm text-gray-500">
            Estimation financière sur {state.fiscal.durationYears} ans — {ro.kwc.toFixed(1)} kWc
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleResetDefaults}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            ↺ Reset defaults
          </button>
          <button
            onClick={() => void handleSave()}
            disabled={saving || !dirty}
            className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Sauvegarde…" : "💾 Sauvegarder"}
          </button>
          <button
            disabled
            className="rounded-md border border-gray-300 bg-gray-100 px-4 py-1.5 text-sm font-medium text-gray-400 cursor-not-allowed"
            title="Bientôt disponible"
          >
            📄 Générer PDF
          </button>
        </div>
      </div>

      {/* dirty banner */}
      {dirty && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700">
          ⚠️ Modifications non sauvegardées
        </div>
      )}

      {/* ━━━ SECTION 1 — PARAMÈTRES ━━━ */}
      <Section title="📊 Paramètres du projet">
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-4">
          {/* Readonly */}
          <ReadonlyField
            label="Puissance crête"
            value={`${ro.kwc.toFixed(2)} kWc`}
            locked
            tooltip="Issu du bâtiment"
          />
          <ReadonlyField
            label="Productible"
            value={`${ro.productibleKwhPerKwc.toFixed(0)} kWh/kWc/an`}
            locked
            tooltip="Issu PVGIS"
          />
          <ReadonlyField
            label="Production annuelle"
            value={fmtKwh(model.productionAnnualKwh)}
            locked
          />

          {/* Editable */}
          <NumberInput
            label="Tarif vente totale (€/kWh)"
            value={state.tarifTb}
            onChange={(v) => setField("tarifTb", v)}
            step={0.001}
            min={0}
          />
          <NumberInput
            label="Tarif autoconso (€/kWh)"
            value={state.tarifAcc}
            onChange={(v) => setField("tarifAcc", v)}
            step={0.001}
            min={0}
          />
          <div className="col-span-2 sm:col-span-1 lg:col-span-2">
            <SliderInput
              label="Part d'autoconsommation"
              value={state.partAccPct}
              onChange={(v) => setField("partAccPct", v)}
              min={0}
              max={100}
              unit="%"
            />
          </div>
        </div>
      </Section>

      {/* ━━━ SECTION 2 — COÛTS DU PROJET ━━━ */}
      <Section title="🏗️ Coûts du projet (€ HT)">
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-4">
          <NumberInput label="Installation PV" value={state.costs.installation} onChange={(v) => setCost("installation", v)} step={500} min={0} />
          <NumberInput label="Charpente" value={state.costs.charpente} onChange={(v) => setCost("charpente", v)} step={500} min={0} />
          <NumberInput label="Couverture" value={state.costs.couverture} onChange={(v) => setCost("couverture", v)} step={500} min={0} />
          <NumberInput label="Fondations" value={state.costs.fondations} onChange={(v) => setCost("fondations", v)} step={500} min={0} />
          <NumberInput label="Raccordement" value={state.costs.raccordement} onChange={(v) => setCost("raccordement", v)} step={500} min={0} />
          <NumberInput label="Développement" value={state.costs.developpement} onChange={(v) => setCost("developpement", v)} step={500} min={0} />
          <NumberInput label="Frais commerciaux" value={state.costs.fraisCommerciaux} onChange={(v) => setCost("fraisCommerciaux", v)} step={500} min={0} />
          <NumberInput label="Soulte" value={state.costs.soulte} onChange={(v) => setCost("soulte", v)} step={500} min={0} />
        </div>

        {/* Maintenance */}
        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-4">
          <NumberInput
            label="Maintenance (€/kWc/an)"
            value={state.maintenanceEurPerKwc}
            onChange={(v) => setField("maintenanceEurPerKwc", v)}
            step={0.5}
            min={0}
          />
        </div>

        {/* Options */}
        <h4 className="mt-5 mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
          Options additionnelles
        </h4>
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
          <NumberInput label="Bardage" value={state.options.bardage} onChange={(v) => setOption("bardage", v)} step={500} min={0} />
          <NumberInput label="Chéneaux &amp; Descente" value={state.options.cheneaux} onChange={(v) => setOption("cheneaux", v)} step={500} min={0} />
          <NumberInput label="Batterie" value={state.options.batterie} onChange={(v) => setOption("batterie", v)} step={500} min={0} />
        </div>

        {/* Total */}
        <div className="mt-4 flex items-center justify-between rounded-lg bg-gray-900 px-5 py-3 text-white">
          <span className="text-sm font-medium">Coût Total du Projet</span>
          <span className="text-lg font-bold">{fmtEur(model.totalCost)}</span>
        </div>
      </Section>

      {/* ━━━ SECTION 3 — Financement & Fiscal (collapsible) ━━━ */}
      <AdvancedSection title="⚙️ Paramètres avancés (financement, inflation, fiscal)">
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-4">
          <NumberInput label="Taux emprunt (%)" value={state.interestRatePct} onChange={(v) => setField("interestRatePct", v)} step={0.1} min={0} max={20} />
          <NumberInput label="Apport (€)" value={state.downPayment ?? 0} onChange={(v) => setField("downPayment", v)} step={1000} min={0} />
          <NumberInput label="Taux IS (%)" value={state.fiscal.taxRatePct} onChange={(v) => setFiscal("taxRatePct", v)} step={0.5} min={0} max={50} />
          <NumberInput label="IFER (€/kWc)" value={state.fiscal.iferEurPerKwc} onChange={(v) => setFiscal("iferEurPerKwc", v)} step={0.01} min={0} />
          <ReadonlyField
            label={`IFER annuel${ro.kwc <= 100 ? " (exonéré ≤100 kWc)" : ""}`}
            value={fmtEur(ro.kwc <= 100 ? 0 : ro.kwc * state.fiscal.iferEurPerKwc)}
          />
          <ReadonlyField
            label="Capital emprunté"
            value={fmtEur(model.capitalEmprunte)}
          />
        </div>

        <h4 className="mt-5 mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
          Hypothèses d&apos;inflation (%/an)
        </h4>
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
          <NumberInput label="Infl. Tarif Tb" value={state.inflation.inflTb} onChange={(v) => setInflation("inflTb", v)} step={0.1} min={0} max={10} />
          <NumberInput label="Infl. Tarif Acc" value={state.inflation.inflAcc} onChange={(v) => setInflation("inflAcc", v)} step={0.1} min={0} max={10} />
          <NumberInput label="Infl. Maintenance" value={state.inflation.inflMaintenance} onChange={(v) => setInflation("inflMaintenance", v)} step={0.1} min={0} max={10} />
          <NumberInput label="Infl. Assurance" value={state.inflation.inflAssurance} onChange={(v) => setInflation("inflAssurance", v)} step={0.1} min={0} max={10} />
          <NumberInput label="Infl. Divers" value={state.inflation.inflDivers} onChange={(v) => setInflation("inflDivers", v)} step={0.1} min={0} max={10} />
          <NumberInput label="Infl. IFER" value={state.inflation.inflIfer} onChange={(v) => setInflation("inflIfer", v)} step={0.1} min={0} max={10} />
        </div>
      </AdvancedSection>

      {/* ━━━ SECTION 4 — KPIs RENTABILITÉ ━━━ */}
      <Section title="📈 Rentabilité">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard
            label="TRI Projet"
            value={fmtPct(model.kpis.triProjetPct)}
            color={kpiColor(model.kpis.triProjetPct, 5, 10)}
          />
          <KpiCard
            label="DSCR Moyen"
            value={fmtDscr(model.kpis.dscrMoyen)}
            color={kpiColor(model.kpis.dscrMoyen, 1.0, 1.3)}
          />
          <KpiCard
            label="ROI sans ACC"
            value={fmtYears(model.kpis.roiSansAccYears)}
            color={kpiColorInv(model.kpis.roiSansAccYears, 15, 8)}
          />
          <KpiCard
            label="ROI avec ACC"
            value={fmtYears(model.kpis.roiAvecAccYears)}
            color={kpiColorInv(model.kpis.roiAvecAccYears, 15, 8)}
          />
        </div>
      </Section>

      {/* ━━━ SECTION 5 — GRAPHIQUE GAINS CUMULÉS ━━━ */}
      <Section title="📊 Gains cumulés (sur 20 ans)">
        <CumulativeChart model={model} />
      </Section>

      {/* ━━━ SECTION 6 — BUSINESS PLAN 20 ANS ━━━ */}
      <Section title="📋 Business Plan (20 ans)">
        <BusinessPlanTable model={model} />
      </Section>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
 * KPI COLOR HELPERS
 * ═══════════════════════════════════════════════════════════════════ */

/** Higher is better: red < low < yellow < high < green */
function kpiColor(v: number | null, low: number, high: number): "red" | "yellow" | "green" {
  if (v === null) return "red";
  if (v >= high) return "green";
  if (v >= low) return "yellow";
  return "red";
}

/** Lower is better (years): green < low < yellow < high < red */
function kpiColorInv(v: number | null, high: number, low: number): "red" | "yellow" | "green" {
  if (v === null) return "red";
  if (v <= low) return "green";
  if (v <= high) return "yellow";
  return "red";
}

/* ═══════════════════════════════════════════════════════════════════
 * CUMULATIVE CHART (pure SVG — no external lib)
 * ═══════════════════════════════════════════════════════════════════ */

function CumulativeChart({ model }: { model: FinanceModelResult }) {
  const { cumulative, series } = model;
  const N = series.length;
  if (N === 0) return null;

  const W = 720;
  const H = 320;
  const PAD = { top: 20, right: 20, bottom: 40, left: 70 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  // Max Y
  const allVals = [
    ...cumulative.cumulativeCaAvecAcc,
    ...cumulative.cumulativeCaSansAcc,
    cumulative.costLine,
  ];
  const maxY = Math.max(...allVals) * 1.1;

  const xScale = (i: number) => PAD.left + (i / (N - 1)) * plotW;
  const yScale = (v: number) => PAD.top + plotH - (v / maxY) * plotH;

  function polyline(data: number[]): string {
    return data.map((v, i) => `${xScale(i).toFixed(1)},${yScale(v).toFixed(1)}`).join(" ");
  }

  // Y axis ticks
  const yTicks = 5;
  const yTickValues = Array.from({ length: yTicks + 1 }, (_, i) => (maxY / yTicks) * i);

  // X axis ticks (every 5 years)
  const xTickYears = [1, 5, 10, 15, 20];

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-3xl" preserveAspectRatio="xMidYMid meet">
        {/* Grid */}
        {yTickValues.map((v, idx) => (
          <line
            key={idx}
            x1={PAD.left}
            y1={yScale(v)}
            x2={W - PAD.right}
            y2={yScale(v)}
            stroke="#e5e7eb"
            strokeWidth={0.5}
          />
        ))}

        {/* Cost line (horizontal dashed red) */}
        <line
          x1={PAD.left}
          y1={yScale(cumulative.costLine)}
          x2={W - PAD.right}
          y2={yScale(cumulative.costLine)}
          stroke="#ef4444"
          strokeWidth={1.5}
          strokeDasharray="6 3"
        />
        <text
          x={W - PAD.right - 2}
          y={yScale(cumulative.costLine) - 4}
          textAnchor="end"
          className="text-[9px] fill-red-500 font-medium"
        >
          Coût projet ({fmtEurCompact(cumulative.costLine)} €)
        </text>

        {/* Cumulative TB only (blue) */}
        <polyline
          points={polyline(cumulative.cumulativeCaSansAcc)}
          fill="none"
          stroke="#3b82f6"
          strokeWidth={2}
        />

        {/* Cumulative TB + ACC (green) */}
        <polyline
          points={polyline(cumulative.cumulativeCaAvecAcc)}
          fill="none"
          stroke="#10b981"
          strokeWidth={2}
        />

        {/* Y axis labels */}
        {yTickValues.map((v, idx) => (
          <text
            key={idx}
            x={PAD.left - 6}
            y={yScale(v) + 3}
            textAnchor="end"
            className="text-[9px] fill-gray-500"
          >
            {(v / 1000).toFixed(0)}k
          </text>
        ))}

        {/* X axis labels */}
        {xTickYears.map((yr) => {
          const idx = yr - 1;
          if (idx >= N) return null;
          return (
            <text
              key={yr}
              x={xScale(idx)}
              y={H - PAD.bottom + 16}
              textAnchor="middle"
              className="text-[9px] fill-gray-500"
            >
              An {yr}
            </text>
          );
        })}

        {/* Dots at endpoints */}
        <circle cx={xScale(N - 1)} cy={yScale(cumulative.cumulativeCaSansAcc[N - 1]!)} r={3} fill="#3b82f6" />
        <circle cx={xScale(N - 1)} cy={yScale(cumulative.cumulativeCaAvecAcc[N - 1]!)} r={3} fill="#10b981" />
      </svg>

      {/* Legend */}
      <div className="mt-2 flex flex-wrap items-center gap-5 text-xs text-gray-600">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-5 rounded" style={{ background: "#ef4444", borderTop: "2px dashed #ef4444" }} />
          Coût projet
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-5 rounded bg-blue-500" />
          Cumul CA (100% Tb)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-5 rounded bg-emerald-500" />
          Cumul CA (Tb + ACC)
        </span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
 * BUSINESS PLAN TABLE (20 lignes)
 * ═══════════════════════════════════════════════════════════════════ */

function BusinessPlanTable({ model }: { model: FinanceModelResult }) {
  const { series } = model;
  if (series.length === 0) return null;

  const cellCls = "px-2 py-1 text-right text-xs tabular-nums";
  const headerCls =
    "px-2 py-1.5 text-right text-[10px] font-semibold text-gray-600 whitespace-nowrap";
  const rowLabelCls =
    "px-2 py-1 text-left text-xs font-medium text-gray-700 whitespace-nowrap";
  const subTotalCls = "font-semibold text-gray-900";
  const negCls = "text-red-600";

  function v(n: number): string {
    return Math.round(n).toLocaleString("fr-FR");
  }

  function rowColor(n: number): string {
    return n < 0 ? negCls : "";
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-max w-full border-collapse text-xs">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="px-2 py-1.5 text-left text-[10px] font-semibold text-gray-600 sticky left-0 bg-gray-50 z-10 min-w-[140px]">
              Année
            </th>
            {series.map((r) => (
              <th key={r.year} className={headerCls}>
                {r.year}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {/* ── REVENUS ── */}
          <BpSectionHeader label="REVENUS" cols={series.length} />
          <BpRow label="Vente ACC" series={series} accessor={(r) => r.caAcc} cls={cellCls} labelCls={rowLabelCls} v={v} />
          <BpRow label="Vente Surplus (TB)" series={series} accessor={(r) => r.caTb} cls={cellCls} labelCls={rowLabelCls} v={v} />
          <BpRow label="Total CA" series={series} accessor={(r) => r.totalCa} cls={`${cellCls} ${subTotalCls}`} labelCls={`${rowLabelCls} ${subTotalCls}`} v={v} highlight />

          {/* ── CHARGES ── */}
          <BpSectionHeader label="CHARGES" cols={series.length} />
          <BpRow label="Maintenance" series={series} accessor={(r) => r.charges.maintenance} cls={cellCls} labelCls={rowLabelCls} v={v} />
          <BpRow label="Assurance" series={series} accessor={(r) => r.charges.assurance} cls={cellCls} labelCls={rowLabelCls} v={v} />
          <BpRow label="IFER" series={series} accessor={(r) => r.charges.ifer} cls={cellCls} labelCls={rowLabelCls} v={v} />
          <BpRow label="Divers" series={series} accessor={(r) => r.charges.divers} cls={cellCls} labelCls={rowLabelCls} v={v} />
          <BpRow label="Total Charges" series={series} accessor={(r) => r.charges.totalCharges} cls={`${cellCls} ${subTotalCls}`} labelCls={`${rowLabelCls} ${subTotalCls}`} v={v} highlight />

          {/* ── EXPLOITATION ── */}
          <BpSectionHeader label="EXPLOITATION" cols={series.length} />
          <BpRow label="EBE" series={series} accessor={(r) => r.ebe} cls={`${cellCls} ${subTotalCls}`} labelCls={`${rowLabelCls} ${subTotalCls}`} v={v} colorFn={rowColor} highlight />
          <BpRow label="Amortissement" series={series} accessor={(r) => r.amortissement} cls={cellCls} labelCls={rowLabelCls} v={v} />
          <BpRow label="RBT" series={series} accessor={(r) => r.rbt} cls={cellCls} labelCls={rowLabelCls} v={v} colorFn={rowColor} />

          {/* ── FINANCEMENT ── */}
          <BpSectionHeader label="FINANCEMENT" cols={series.length} />
          <BpRow label="Intérêts" series={series} accessor={(r) => r.interets} cls={cellCls} labelCls={rowLabelCls} v={v} />
          <BpRow label="RAI" series={series} accessor={(r) => r.rai} cls={cellCls} labelCls={rowLabelCls} v={v} colorFn={rowColor} />
          <BpRow label="IS" series={series} accessor={(r) => r.is} cls={cellCls} labelCls={rowLabelCls} v={v} />
          <BpRow label="Résultat Net" series={series} accessor={(r) => r.resultatNet} cls={`${cellCls} ${subTotalCls}`} labelCls={`${rowLabelCls} ${subTotalCls}`} v={v} colorFn={rowColor} highlight />

          {/* ── DETTE ── */}
          <BpSectionHeader label="DETTE" cols={series.length} />
          <BpRow label="DACH (reste dû)" series={series} accessor={(r) => r.dach} cls={cellCls} labelCls={rowLabelCls} v={v} />
          <BpRow
            label="DSCR"
            series={series}
            accessor={(r) => r.dscr}
            cls={`${cellCls} font-medium`}
            labelCls={rowLabelCls}
            v={(n) => n.toFixed(2)}
            colorFn={(n) =>
              n < 1 ? negCls : n < 1.2 ? "text-amber-600" : "text-emerald-600"
            }
          />
        </tbody>
      </table>
    </div>
  );
}

/* ─── BP sub-components ─── */

function BpSectionHeader({ label, cols }: { label: string; cols: number }) {
  return (
    <tr className="bg-gray-100 border-y border-gray-200">
      <td
        colSpan={cols + 1}
        className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-500"
      >
        {label}
      </td>
    </tr>
  );
}

function BpRow({
  label,
  series,
  accessor,
  cls,
  labelCls,
  v,
  colorFn,
  highlight,
}: {
  label: string;
  series: YearRow[];
  accessor: (r: YearRow) => number;
  cls: string;
  labelCls: string;
  v: (n: number) => string;
  colorFn?: (n: number) => string;
  highlight?: boolean;
}) {
  return (
    <tr className={highlight ? "bg-blue-50/40" : "hover:bg-gray-50"}>
      <td
        className={`${labelCls} sticky left-0 z-10 ${highlight ? "bg-blue-50/40" : "bg-white"}`}
      >
        {label}
      </td>
      {series.map((r) => {
        const val = accessor(r);
        const extraColor = colorFn ? colorFn(val) : "";
        return (
          <td key={r.year} className={`${cls} ${extraColor}`}>
            {v(val)}
          </td>
        );
      })}
    </tr>
  );
}

/* ═══════════════════════════════════════════════════════════════════
 * SHARED UI COMPONENTS
 * ═══════════════════════════════════════════════════════════════════ */

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-bold text-gray-800">{title}</h3>
      {children}
    </div>
  );
}

function AdvancedSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-5 py-3 text-left"
      >
        <h3 className="text-sm font-bold text-gray-800">{title}</h3>
        <span className="text-xs text-gray-400">
          {open ? "▲ Masquer" : "▼ Afficher"}
        </span>
      </button>
      {open && (
        <div className="border-t border-gray-100 px-5 pb-5 pt-3">{children}</div>
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: "red" | "yellow" | "green";
}) {
  const borderColor = {
    red: "border-red-300 bg-red-50",
    yellow: "border-amber-300 bg-amber-50",
    green: "border-emerald-300 bg-emerald-50",
  }[color];
  const textColor = {
    red: "text-red-700",
    yellow: "text-amber-700",
    green: "text-emerald-700",
  }[color];

  return (
    <div className={`rounded-lg border-2 p-4 text-center ${borderColor}`}>
      <div className="text-xs font-medium text-gray-600">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${textColor}`}>{value}</div>
    </div>
  );
}

function NumberInput({
  label,
  value,
  onChange,
  step = 1,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-600">
        {label}
      </span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        step={step}
        min={min}
        max={max}
        className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
      />
    </label>
  );
}

function SliderInput({
  label,
  value,
  onChange,
  min,
  max,
  unit,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  unit: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center justify-between text-xs font-medium text-gray-600">
        <span>{label}</span>
        <span className="text-sm font-bold text-gray-900">
          {value}
          {unit}
        </span>
      </span>
      <input
        type="range"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value) || 0)}
        min={min}
        max={max}
        step={1}
        className="w-full accent-blue-600"
      />
      <div className="mt-0.5 flex justify-between text-[10px] text-gray-400">
        <span>
          {min}
          {unit}
        </span>
        <span>
          {max}
          {unit}
        </span>
      </div>
    </label>
  );
}

function ReadonlyField({
  label,
  value,
  locked,
  tooltip,
}: {
  label: string;
  value: string;
  locked?: boolean;
  tooltip?: string;
}) {
  return (
    <div className="block">
      <span className="mb-1 flex items-center gap-1 text-xs font-medium text-gray-600">
        {label}
        {locked && (
          <span className="cursor-help" title={tooltip}>
            🔒
          </span>
        )}
      </span>
      <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm font-semibold text-gray-700">
        {value}
      </div>
    </div>
  );
}
