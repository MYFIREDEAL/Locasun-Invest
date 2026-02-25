"use client";

/**
 * PvgisPanel — Bloc "Productible PVGIS" affiché dans l'étape Carte
 *
 * États possibles :
 *   idle      → aucun résultat, bouton "Calculer"
 *   loading   → calcul en cours (spinner)
 *   done      → résultat affiché + bouton "Recalculer"
 *   error     → message d'erreur + bouton "Réessayer"
 */

import { useCallback, useState } from "react";
import type { PvgisResult } from "@/lib/types/pvgis";
import { calculateProjectPvgis } from "@/lib/actions/pvgis";

// ============================================================================
// TYPES
// ============================================================================

export type PvgisStatus = "idle" | "loading" | "done" | "error";

export interface PvgisPanelProps {
  projectId: string;
  /** Résultat PVGIS courant (null = pas encore calculé) */
  result: PvgisResult | null;
  /** Callback quand un nouveau résultat est obtenu */
  onResultChange: (result: PvgisResult | null) => void;
}

// ============================================================================
// HELPERS
// ============================================================================

function fmt(n: number): string {
  return n.toLocaleString("fr-FR", { maximumFractionDigits: 0 });
}

// ============================================================================
// COMPOSANT
// ============================================================================

export function PvgisPanel({ projectId, result, onResultChange }: PvgisPanelProps) {
  const [status, setStatus] = useState<PvgisStatus>(result ? "done" : "idle");
  const [error, setError] = useState<string | null>(null);

  const handleCalculate = useCallback(
    async (force = false) => {
      setStatus("loading");
      setError(null);

      try {
        const res = await calculateProjectPvgis({
          projectId,
          forceRecalculate: force,
        });

        if (!res.success) {
          setError(res.error);
          setStatus("error");
          return false;
        }

        onResultChange(res.data);
        setStatus("done");
        return true;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Erreur inconnue";
        setError(msg);
        setStatus("error");
        return false;
      }
    },
    [projectId, onResultChange],
  );

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      {/* En-tête */}
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">☀️</span>
          <h3 className="text-sm font-semibold text-gray-900">
            Productible PVGIS
          </h3>
          <StatusPill status={status} />
        </div>

        {/* Boutons */}
        {status === "idle" && (
          <button
            onClick={() => handleCalculate(false)}
            className="rounded-md bg-amber-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-600 transition"
          >
            Calculer
          </button>
        )}
        {status === "done" && (
          <button
            onClick={() => handleCalculate(true)}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition"
          >
            ↻ Recalculer
          </button>
        )}
        {status === "error" && (
          <button
            onClick={() => handleCalculate(false)}
            className="rounded-md bg-red-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-600 transition"
          >
            Réessayer
          </button>
        )}
        {status === "loading" && (
          <span className="text-xs text-gray-400 animate-pulse">
            Calcul en cours…
          </span>
        )}
      </div>

      {/* Contenu */}
      <div className="px-5 py-4">
        {/* IDLE */}
        {status === "idle" && (
          <p className="text-sm text-gray-500">
            Aucun résultat disponible. Cliquez sur « Calculer » ou validez
            l&apos;étape pour lancer la simulation solaire.
          </p>
        )}

        {/* LOADING */}
        {status === "loading" && (
          <div className="flex items-center gap-3 py-2">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
            <span className="text-sm text-gray-500">
              Interrogation de l&apos;API PVGIS européenne…
            </span>
          </div>
        )}

        {/* ERROR */}
        {status === "error" && error && (
          <div className="rounded-md bg-red-50 p-3">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* DONE — KPIs */}
        {status === "done" && result && (
          <div className="space-y-3">
            {/* KPIs ligne */}
            <div className="grid gap-3 sm:grid-cols-3">
              <KpiCard
                value={`${fmt(result.totals.annualKwh)} kWh`}
                label="Production annuelle"
                color="green"
              />
              <KpiCard
                value={`${result.totals.peakPowerKwc.toFixed(1)} kWc`}
                label="Puissance installée"
                color="blue"
              />
              <KpiCard
                value={`${result.totals.annualKwhPerKwc} kWh/kWc`}
                label="Rendement"
                color="purple"
              />
            </div>

            {/* Pans */}
            {result.pans.length > 1 && (
              <div className="grid gap-2 sm:grid-cols-2">
                {result.pans.map((pan) => (
                  <div
                    key={pan.panId}
                    className={`rounded-md border p-3 text-sm ${
                      pan.panId === "A"
                        ? "border-blue-200 bg-blue-50/50"
                        : "border-orange-200 bg-orange-50/50"
                    }`}
                  >
                    <span className="font-medium text-gray-700">
                      {pan.label}
                    </span>
                    <span className="ml-2 text-gray-500">
                      {fmt(pan.annualKwh)} kWh · {pan.peakPowerKwc.toFixed(1)} kWc
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Timestamp */}
            <p className="text-xs text-gray-400 text-right">
              Calculé le{" "}
              {new Date(result.calculatedAt).toLocaleString("fr-FR")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// SUB COMPONENTS
// ============================================================================

function StatusPill({ status }: { status: PvgisStatus }) {
  const map: Record<PvgisStatus, { label: string; cls: string }> = {
    idle: { label: "Non calculé", cls: "bg-gray-100 text-gray-500" },
    loading: { label: "Calcul…", cls: "bg-amber-100 text-amber-700 animate-pulse" },
    done: { label: "OK", cls: "bg-green-100 text-green-700" },
    error: { label: "Erreur", cls: "bg-red-100 text-red-700" },
  };
  const { label, cls } = map[status];
  return (
    <span className={`ml-1 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${cls}`}>
      {label}
    </span>
  );
}

function KpiCard({
  value,
  label,
  color,
}: {
  value: string;
  label: string;
  color: "green" | "blue" | "purple";
}) {
  const colorMap = {
    green: "border-green-200 bg-green-50 text-green-700",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    purple: "border-purple-200 bg-purple-50 text-purple-700",
  };
  return (
    <div className={`rounded-md border p-3 ${colorMap[color]}`}>
      <p className="text-lg font-bold leading-tight">{value}</p>
      <p className="text-xs opacity-80">{label}</p>
    </div>
  );
}
