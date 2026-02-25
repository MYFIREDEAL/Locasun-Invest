"use client";

/**
 * InvestorSummaryBlock — Bloc Rentabilité Premium pour la Synthèse
 *
 * Contenu :
 *   1) Bandeau capital : investissement, gain net 20 ans, multiplicateur
 *   2) 4 cartes KPI (TRI, DSCR, ROI sans/avec ACC)
 *   3) Cash-flow année 1 + badge
 *   4) Graphique cumulatif SVG (courbe TB, courbe TB+ACC, ligne coût, break-even)
 *
 * Lecture seule — aucun recalcul, tout vient du FinanceSnapshot.
 */

import type { FinanceSnapshot } from "@/lib/types/finance";
import { computeExtendedRows, cumulativeEbe30 } from "./extend-to-30";

// ============================================================================
// HELPERS
// ============================================================================

function fmt(n: number): string {
  return n.toLocaleString("fr-FR", { maximumFractionDigits: 0 });
}

function fmtK(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(2)} M€`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(0)} k€`;
  return `${fmt(n)} €`;
}

function fmtCurrency(n: number): string {
  return n.toLocaleString("fr-FR", { maximumFractionDigits: 0 }) + " €";
}

// ============================================================================
// PROPS
// ============================================================================

interface InvestorSummaryBlockProps {
  snapshot: FinanceSnapshot;
}

// ============================================================================
// KPI CARD
// ============================================================================

type KpiColor = "green" | "amber" | "red";

const KPI_STYLES: Record<KpiColor, string> = {
  green: "bg-green-50 border-green-200 text-green-800",
  amber: "bg-amber-50 border-amber-200 text-amber-800",
  red: "bg-red-50 border-red-200 text-red-800",
};

function KpiCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: KpiColor }) {
  return (
    <div className={`rounded-xl border p-4 text-center ${KPI_STYLES[color]}`}>
      <div className="text-2xl font-extrabold tabular-nums leading-tight">{value}</div>
      <div className="text-xs font-medium mt-1 opacity-80">{label}</div>
      {sub && <div className="text-[10px] mt-0.5 opacity-60">{sub}</div>}
    </div>
  );
}

// ============================================================================
// SVG CUMULATIVE CHART
// ============================================================================

const CHART_W = 700;
const CHART_H = 260;
const PAD = { top: 20, right: 20, bottom: 30, left: 60 };
const INNER_W = CHART_W - PAD.left - PAD.right;
const INNER_H = CHART_H - PAD.top - PAD.bottom;

function CumulativeChart({ snapshot }: { snapshot: FinanceSnapshot }) {
  const { cumulative, totalCost } = snapshot;
  const N = cumulative.cumulativeCaAvecAcc.length;
  if (N === 0) return null;

  // Compute y range
  const allValues = [
    ...cumulative.cumulativeCaAvecAcc,
    ...cumulative.cumulativeCaSansAcc,
    totalCost,
  ];
  const yMax = Math.max(...allValues) * 1.1;
  const yMin = 0;

  // Scale helpers
  const xScale = (year: number) => PAD.left + ((year - 1) / (N - 1)) * INNER_W;
  const yScale = (v: number) => PAD.top + INNER_H - ((v - yMin) / (yMax - yMin)) * INNER_H;

  // Build polyline points
  const pointsAvecAcc = cumulative.cumulativeCaAvecAcc
    .map((v, i) => `${xScale(i + 1).toFixed(1)},${yScale(v).toFixed(1)}`)
    .join(" ");
  const pointsSansAcc = cumulative.cumulativeCaSansAcc
    .map((v, i) => `${xScale(i + 1).toFixed(1)},${yScale(v).toFixed(1)}`)
    .join(" ");

  // Cost line Y
  const costY = yScale(totalCost);

  // Break-even marker (avec ACC) — interpolation exacte sur la courbe
  let breakEvenX: number | null = null;
  if (snapshot.roiAvecAccYears !== null && snapshot.roiAvecAccYears <= N) {
    // Trouver les deux points annuels qui encadrent le croisement
    const data = cumulative.cumulativeCaAvecAcc;
    let crossIdx = -1;
    for (let i = 0; i < data.length; i++) {
      if (data[i]! >= totalCost) { crossIdx = i; break; }
    }
    if (crossIdx >= 0) {
      if (crossIdx === 0) {
        // Croisement dès l'année 1 — interpoler entre 0 et data[0]
        const fraction = totalCost / data[0]!;
        // année fractionnaire 1-indexed = fraction * 1 = fraction
        breakEvenX = xScale(fraction);
      } else {
        const prev = data[crossIdx - 1]!;
        const curr = data[crossIdx]!;
        const fraction = (totalCost - prev) / (curr - prev);
        // crossIdx=6 → entre année 6 (idx 5) et année 7 (idx 6)
        // année 1-indexed = (crossIdx) + fraction  (crossIdx car prev = data[crossIdx-1] = année crossIdx)
        const yearFrac = crossIdx + fraction; // 1-indexed: année crossIdx + fraction
        breakEvenX = xScale(yearFrac);
      }
    }
  }

  // Y-axis tick values (5 ticks)
  const yTicks: number[] = [];
  const yStep = yMax / 5;
  for (let i = 0; i <= 5; i++) yTicks.push(yStep * i);

  // X-axis labels (every 5 years)
  const xLabels = [1, 5, 10, 15, 20].filter((y) => y <= N);

  return (
    <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      {/* Grid */}
      {yTicks.map((v) => (
        <line
          key={v}
          x1={PAD.left}
          x2={CHART_W - PAD.right}
          y1={yScale(v)}
          y2={yScale(v)}
          stroke="#e5e7eb"
          strokeWidth={0.5}
        />
      ))}

      {/* Y-axis labels */}
      {yTicks.map((v) => (
        <text
          key={`lbl-${v}`}
          x={PAD.left - 6}
          y={yScale(v) + 3}
          textAnchor="end"
          fontSize={9}
          fill="#9ca3af"
        >
          {fmtK(v)}
        </text>
      ))}

      {/* X-axis labels */}
      {xLabels.map((yr) => (
        <text
          key={`x-${yr}`}
          x={xScale(yr)}
          y={CHART_H - 6}
          textAnchor="middle"
          fontSize={9}
          fill="#9ca3af"
        >
          An {yr}
        </text>
      ))}

      {/* Cost line (red dashed) */}
      <line
        x1={PAD.left}
        x2={CHART_W - PAD.right}
        y1={costY}
        y2={costY}
        stroke="#ef4444"
        strokeWidth={1.5}
        strokeDasharray="6,4"
      />
      <text x={CHART_W - PAD.right + 2} y={costY - 4} fontSize={8} fill="#ef4444" textAnchor="start">
        Investissement
      </text>

      {/* Cumul sans ACC (blue, lighter) */}
      <polyline
        points={pointsSansAcc}
        fill="none"
        stroke="#93c5fd"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Cumul avec ACC (green, bold) */}
      <polyline
        points={pointsAvecAcc}
        fill="none"
        stroke="#22c55e"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Break-even marker */}
      {breakEvenX !== null && (
        <>
          <line
            x1={breakEvenX}
            x2={breakEvenX}
            y1={costY}
            y2={CHART_H - PAD.bottom}
            stroke="#22c55e"
            strokeWidth={1}
            strokeDasharray="3,3"
          />
          <circle cx={breakEvenX} cy={costY} r={4} fill="#22c55e" stroke="white" strokeWidth={1.5} />
          <rect
            x={breakEvenX - 32}
            y={costY - 22}
            width={64}
            height={16}
            rx={4}
            fill="#22c55e"
          />
          <text
            x={breakEvenX}
            y={costY - 11}
            textAnchor="middle"
            fontSize={9}
            fill="white"
            fontWeight="bold"
          >
            {snapshot.roiAvecAccYears !== null ? `${snapshot.roiAvecAccYears.toFixed(1)} ans` : ""}
          </text>
        </>
      )}

      {/* Legend */}
      <circle cx={PAD.left + 10} cy={PAD.top + 6} r={4} fill="#22c55e" />
      <text x={PAD.left + 18} y={PAD.top + 10} fontSize={8} fill="#6b7280">Cumul TB + ACC</text>
      <circle cx={PAD.left + 110} cy={PAD.top + 6} r={4} fill="#93c5fd" />
      <text x={PAD.left + 118} y={PAD.top + 10} fontSize={8} fill="#6b7280">Cumul TB seul</text>
    </svg>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function InvestorSummaryBlock({ snapshot }: InvestorSummaryBlockProps) {
  // ── 20 ans ──
  const ebeArr = snapshot.cumulative.cumulativeEbe ?? [];
  const cumulEbe20 = ebeArr[ebeArr.length - 1] ?? 0;
  const gain20 = cumulEbe20 - snapshot.totalCost;
  const mult20 = snapshot.totalCost > 0
    ? (cumulEbe20 / snapshot.totalCost).toFixed(1)
    : "—";

  // ── 30 ans (calculé à l'affichage, pas dans le snapshot) ──
  const extendedRows = computeExtendedRows(snapshot);
  const cumulEbe30Val = cumulativeEbe30(snapshot, extendedRows);
  const gain30 = cumulEbe30Val - snapshot.totalCost;
  const mult30 = snapshot.totalCost > 0
    ? (cumulEbe30Val / snapshot.totalCost).toFixed(1)
    : "—";

  const triColor: KpiColor =
    snapshot.triProjetPct !== null && snapshot.triProjetPct >= 6 ? "green"
    : snapshot.triProjetPct !== null && snapshot.triProjetPct >= 3 ? "amber"
    : "red";

  const dscrColor: KpiColor =
    snapshot.dscrMoyen >= 1.3 ? "green"
    : snapshot.dscrMoyen >= 1.0 ? "amber"
    : "red";

  const roiSansColor: KpiColor =
    snapshot.roiSansAccYears !== null && snapshot.roiSansAccYears <= 7 ? "green"
    : snapshot.roiSansAccYears !== null && snapshot.roiSansAccYears <= 12 ? "amber"
    : "red";

  const roiAvecColor: KpiColor =
    snapshot.roiAvecAccYears !== null && snapshot.roiAvecAccYears <= 7 ? "green"
    : snapshot.roiAvecAccYears !== null && snapshot.roiAvecAccYears <= 12 ? "amber"
    : "red";

  return (
    <div className="space-y-6">
      {/* ── 1. Bandeau Capital : 3 colonnes ── */}
      <div className="rounded-xl bg-gradient-to-r from-slate-900 to-slate-700 p-6 text-white">
        <div className="grid grid-cols-3 gap-6 text-center">
          {/* COL 1 — Capital investi */}
          <div>
            <div className="text-xs uppercase tracking-wider text-slate-400 mb-1">Capital investi</div>
            <div className="text-2xl font-extrabold tabular-nums">{fmtK(snapshot.totalCost)}</div>
            {(snapshot.downPayment ?? 0) > 0 && (
              <div className="text-[10px] text-slate-400 mt-0.5">
                Apport {fmtK(snapshot.downPayment!)} · Emprunté {fmtK(snapshot.capitalEmprunte ?? snapshot.totalCost)}
              </div>
            )}
          </div>
          {/* COL 2 — 20 ans */}
          <div>
            <div className="text-xs uppercase tracking-wider text-slate-400 mb-1">Gain net exploitation 20 ans</div>
            <div className={`text-2xl font-extrabold tabular-nums ${gain20 >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {gain20 >= 0 ? "+" : ""}{fmtK(gain20)}
            </div>
            <div className="text-sm font-bold text-slate-300 mt-0.5">×{mult20}</div>
          </div>
          {/* COL 3 — 30 ans */}
          <div>
            <div className="text-xs uppercase tracking-wider text-slate-400 mb-1">Gain net exploitation 30 ans</div>
            <div className={`text-2xl font-extrabold tabular-nums ${gain30 >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {gain30 >= 0 ? "+" : ""}{fmtK(gain30)}
            </div>
            <div className="text-sm font-bold text-slate-300 mt-0.5">×{mult30}</div>
          </div>
        </div>
      </div>

      {/* ── 2. KPIs ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label="TRI Projet"
          value={snapshot.triProjetPct !== null ? `${snapshot.triProjetPct.toFixed(2)} %` : "—"}
          sub="Taux de rendement interne"
          color={triColor}
        />
        <KpiCard
          label="DSCR Moyen"
          value={snapshot.dscrMoyen.toFixed(2)}
          sub="Couverture de la dette"
          color={dscrColor}
        />
        <KpiCard
          label="ROI sans ACC"
          value={snapshot.roiSansAccYears !== null ? `${snapshot.roiSansAccYears.toFixed(1)} ans` : "—"}
          sub="Vente totale uniquement"
          color={roiSansColor}
        />
        <KpiCard
          label="ROI avec ACC"
          value={snapshot.roiAvecAccYears !== null ? `${snapshot.roiAvecAccYears.toFixed(1)} ans` : "—"}
          sub="Autoconsommation incluse"
          color={roiAvecColor}
        />
      </div>

      {/* ── 3. Trésorerie année 1 — Bloc explicatif ── */}
      {(() => {
        const y1 = snapshot.series[0];
        if (!y1) return null;

        const ebe = y1.ebe;
        const annuite = y1.amortissement + y1.interets; // remboursement année 1
        const tresoNette = ebe - annuite; // flux de trésorerie réel année 1
        const tresoPositive = tresoNette >= 0;
        const creditDuration = snapshot.series.length; // durée du crédit (20 ans)

        // Trouver l'année où la trésorerie nette (EBE − annuité) devient positive
        // Les intérêts baissent chaque année (dette restante diminue), donc ça s'améliore
        let anneeEquilibre: number | null = null;
        for (const row of snapshot.series) {
          const annuiteRow = row.amortissement + row.interets;
          if (row.ebe >= annuiteRow) {
            anneeEquilibre = row.year;
            break;
          }
        }

        return (
          <div className="rounded-lg border border-gray-200 bg-white px-5 py-4 space-y-3">
            {/* Titre + badge */}
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-gray-800">💰 Trésorerie année 1 — Comment lire ces chiffres ?</h4>
              {tresoPositive ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-800">
                  ✅ Autofinancé dès l&apos;année 1
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                  ⚠️ Trésorerie négative en année 1
                </span>
              )}
            </div>

            {/* Décomposition visuelle */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Chiffre d&apos;affaires (CA)</span>
                <span className="font-medium text-gray-800 tabular-nums">{fmtCurrency(y1.totalCa)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Charges d&apos;exploitation</span>
                <span className="font-medium text-gray-800 tabular-nums">− {fmtCurrency(y1.totalCharges)}</span>
              </div>
              <div className="flex justify-between border-t border-dashed border-gray-200 pt-1">
                <span className="font-semibold text-gray-700">= EBE (trésorerie brute)</span>
                <span className={`font-bold tabular-nums ${ebe >= 0 ? "text-green-700" : "text-red-600"}`}>{fmtCurrency(ebe)}</span>
              </div>
              <div className="flex justify-between border-t border-dashed border-gray-200 pt-1">
                <span className="text-gray-500">Remboursement crédit (annuité)</span>
                <span className="font-medium text-gray-800 tabular-nums">− {fmtCurrency(annuite)}</span>
              </div>
              <div className="col-span-2 flex justify-between border-t border-gray-300 pt-1.5 mt-1">
                <span className="font-semibold text-gray-700">= Trésorerie nette année 1</span>
                <span className={`text-base font-extrabold tabular-nums ${tresoPositive ? "text-green-700" : "text-red-600"}`}>
                  {fmtCurrency(tresoNette)}
                </span>
              </div>
            </div>

            {/* Explication pédagogique */}
            <div className="rounded-md bg-blue-50/60 border border-blue-200 px-3 py-2.5 text-xs text-blue-900 space-y-1.5">
              {tresoPositive ? (
                <p>
                  <strong>Bonne nouvelle :</strong> vos revenus solaires couvrent <em>toutes</em> vos charges
                  ET le remboursement du crédit dès la première année. Vous n&apos;avez aucun argent à sortir de votre poche.
                </p>
              ) : (
                <>
                  <p>
                    <strong>Le résultat net comptable ({fmtCurrency(y1.resultatNet)}) est négatif, mais ce n&apos;est pas une perte réelle.</strong>{" "}
                    Votre hangar génère <strong>{fmtCurrency(ebe)}/an</strong> de trésorerie brute (EBE).
                    C&apos;est de l&apos;argent qui rentre réellement sur votre compte.
                  </p>
                  <p>
                    Le chiffre négatif vient du <strong>remboursement du crédit sur {creditDuration} ans</strong> :
                    l&apos;annuité (capital + intérêts) est de <strong>{fmtCurrency(annuite)}</strong> en année 1,
                    dont <strong>{fmtCurrency(y1.interets)}</strong> d&apos;intérêts.
                    Les intérêts diminuent chaque année à mesure que la dette se rembourse.
                  </p>
                  {anneeEquilibre !== null && (
                    <p>
                      💡 <strong>Dès l&apos;année {anneeEquilibre}</strong>, la trésorerie nette devient positive :
                      le hangar se paie entièrement tout seul, sans argent à sortir de votre poche.
                      {anneeEquilibre <= 5 && " C'est rapide !"}
                    </p>
                  )}
                  {anneeEquilibre === null && (
                    <p>
                      💡 Sur la durée du crédit ({creditDuration} ans), l&apos;annuité reste supérieure à l&apos;EBE.
                      Envisagez un allongement du crédit ou un apport initial pour réduire l&apos;annuité.
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── 3b. Réserve de trésorerie — "Combien garder de côté ?" ── */}
      {(() => {
        const apport = snapshot.downPayment ?? 0;
        const hasApport = apport > 0;

        // Déficits du BP actuel (tel quel, pas de simulation)
        const deficits: { year: number; deficit: number }[] = [];
        let totalReserve = 0;

        for (const row of snapshot.series) {
          const annuite = row.amortissement + row.interets;
          const tresoNette = row.ebe - annuite;
          if (tresoNette < 0) {
            deficits.push({ year: row.year, deficit: Math.abs(tresoNette) });
            totalReserve += Math.abs(tresoNette);
          } else {
            break;
          }
        }

        if (deficits.length === 0) return null;

        const nbAnnees = deficits.length;
        const reserve = Math.ceil(totalReserve / 100) * 100;

        return (
          <div className="rounded-xl border-2 border-emerald-300 bg-gradient-to-br from-emerald-50 to-white px-5 py-4 space-y-3">
            {/* Titre + badge */}
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-gray-800">
                🏦 Combien prévoir de côté ?
              </h4>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-sm font-bold text-emerald-800">
                {fmtCurrency(reserve)}
              </span>
            </div>

            {/* Explicatif */}
            <div className="text-sm text-gray-700 space-y-2">
              <p>
                Les <strong>{nbAnnees} première{nbAnnees > 1 ? "s" : ""} année{nbAnnees > 1 ? "s" : ""}</strong>,
                le remboursement du crédit est légèrement supérieur aux revenus du hangar.
                Le manque total sur cette période est de <strong>{fmtCurrency(reserve)}</strong>.
              </p>
              {hasApport && apport > reserve ? (
                <p>
                  Vous disposez d&apos;un apport de <strong>{fmtCurrency(apport)}</strong>.
                  Nous vous recommandons de n&apos;injecter que <strong>{fmtCurrency(apport - reserve)}</strong> dans
                  le crédit et de conserver <strong>{fmtCurrency(reserve)}</strong> en trésorerie
                  pour couvrir ces premières années.
                  À partir de l&apos;année {nbAnnees + 1}, le hangar s&apos;autofinance
                  et vous n&apos;avez plus rien à débourser.
                </p>
              ) : hasApport ? (
                <p>
                  Votre apport de <strong>{fmtCurrency(apport)}</strong> est déjà mobilisé dans le crédit.
                  Prévoyez <strong>{fmtCurrency(reserve)}</strong> de trésorerie supplémentaire
                  (sur un livret par exemple) pour couvrir ce manque.
                  À partir de l&apos;année {nbAnnees + 1}, le hangar s&apos;autofinance intégralement.
                </p>
              ) : (
                <p>
                  Conservez <strong>{fmtCurrency(reserve)}</strong> de trésorerie disponible
                  (sur un livret par exemple) pour couvrir ce manque.
                  À partir de l&apos;année {nbAnnees + 1}, le hangar s&apos;autofinance
                  et vous n&apos;avez plus rien à débourser.
                </p>
              )}
            </div>

            {/* Tableau année par année */}
            <div className="rounded-md bg-white border border-gray-200 overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 text-gray-500">
                    <th className="px-3 py-1.5 text-left font-medium">Année</th>
                    <th className="px-3 py-1.5 text-right font-medium">À sortir de votre poche</th>
                    <th className="px-3 py-1.5 text-right font-medium">Reste en réserve</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    let remaining = reserve;
                    return deficits.map((d) => {
                      remaining -= d.deficit;
                      return (
                        <tr key={d.year} className="border-t border-gray-100">
                          <td className="px-3 py-1.5 font-medium text-gray-700">An {d.year}</td>
                          <td className="px-3 py-1.5 text-right font-medium text-red-600 tabular-nums">
                            {fmtCurrency(d.deficit)}
                          </td>
                          <td className="px-3 py-1.5 text-right font-medium text-emerald-700 tabular-nums">
                            {fmtCurrency(Math.round(remaining))}
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>

          </div>
        );
      })()}

      {/* ── 4. Graphique cumulatif ── */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">📈 Gains cumulés vs Investissement</h3>
        <CumulativeChart snapshot={snapshot} />
      </div>

      {/* ── Métadonnées ── */}
      <div className="flex items-center justify-between text-[10px] text-gray-400">
        <span>
          {snapshot.kwc.toFixed(1)} kWc · {fmt(snapshot.productionAnnuelleKwh)} kWh/an · {snapshot.productibleKwhPerKwc} kWh/kWc
        </span>
        <span>
          Validé le {new Date(snapshot.validatedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
    </div>
  );
}
