"use client";

import type { MutableRefObject } from "react";
import { useEffect, useState } from "react";
import type { FinanceState, FinanceReadonlyData } from "@/lib/types/finance";
import { createDefaultFinanceState } from "@/lib/types/finance";
import { getFinanceState } from "@/lib/actions/finance";
import { getBuildingConfig } from "@/lib/actions/building-configs";
import { getPvgisResult } from "@/lib/actions/pvgis";
import { FinanceEditor } from "./finance-editor";

/* ─── Types ─── */

export type SaveRef = MutableRefObject<(() => Promise<boolean>) | null>;

interface FinanceTabContentProps {
  projectId: string;
  saveRef: SaveRef;
}

/* ═══════════════════════════════════════════════════════════════════
 * FinanceTabContent — Orchestrateur de l'étape Finance
 *
 * Hydratation au mount :
 *   1. Charger finance_state depuis DB (ou créer defaults)
 *   2. Charger kWc depuis building_configs (readonly)
 *   3. Charger productible depuis pvgis_results (readonly)
 *   4. Rendre FinanceEditor avec saveRef
 * ═══════════════════════════════════════════════════════════════════ */

export function FinanceTabContent({ projectId, saveRef }: FinanceTabContentProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [financeState, setFinanceState] = useState<FinanceState | null>(null);
  const [readonlyData, setReadonlyData] = useState<FinanceReadonlyData | null>(null);

  useEffect(() => {
    async function hydrate() {
      try {
        // Charger les 3 sources en parallèle
        const [finRes, configRes, pvgisRes] = await Promise.all([
          getFinanceState(projectId),
          getBuildingConfig(projectId),
          getPvgisResult(projectId),
        ]);

        // ── kWc (from building) ──
        let kwc = 0;
        if (configRes.success && configRes.data) {
          kwc = configRes.data.derived.powerKwc;
        }

        // ── Productible (from PVGIS) ──
        let productibleKwhPerKwc = 0;
        let productionAnnuelleKwh = 0;
        if (pvgisRes.success && pvgisRes.data) {
          productibleKwhPerKwc = pvgisRes.data.totals.annualKwhPerKwc;
          productionAnnuelleKwh = pvgisRes.data.totals.annualKwh;
        }

        // Extraire les infos bâtiment pour la grille tarifaire
        const buildingInfo =
          configRes.success && configRes.data
            ? {
                type: configRes.data.params.type,
                width: configRes.data.params.width,
                nbSpans: configRes.data.params.nbSpans,
              }
            : undefined;

        setReadonlyData({ kwc, productibleKwhPerKwc, productionAnnuelleKwh, buildingInfo });

        // ── FinanceState (from DB or defaults) ──
        if (finRes.success && finRes.data) {
          setFinanceState(finRes.data);
        } else {
          setFinanceState(createDefaultFinanceState(kwc, buildingInfo));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur de chargement");
      } finally {
        setLoading(false);
      }
    }

    hydrate();
  }, [projectId]);

  // ── Loading ──

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <div className="text-gray-500">Chargement des données financières…</div>
      </div>
    );
  }

  // ── Error ──

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6">
        <h2 className="mb-2 text-lg font-semibold text-red-800">Erreur</h2>
        <p className="text-sm text-red-700">{error}</p>
      </div>
    );
  }

  // ── Missing building config ──

  if (!readonlyData || readonlyData.kwc === 0) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6">
        <h2 className="mb-2 text-lg font-semibold text-amber-800">
          Configuration bâtiment requise
        </h2>
        <p className="text-sm text-amber-700">
          Revenez à l&apos;étape Bâtiment pour configurer le hangar avant
          d&apos;accéder à l&apos;estimation financière.
        </p>
      </div>
    );
  }

  // ── Missing PVGIS ──

  if (readonlyData.productibleKwhPerKwc === 0) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6">
        <h2 className="mb-2 text-lg font-semibold text-amber-800">
          Résultats PVGIS requis
        </h2>
        <p className="text-sm text-amber-700">
          Validez l&apos;étape Carte pour lancer le calcul PVGIS avant
          d&apos;accéder à l&apos;estimation financière.
        </p>
      </div>
    );
  }

  return (
    <FinanceEditor
      projectId={projectId}
      initialState={financeState!}
      readonly={readonlyData}
      saveRef={saveRef}
    />
  );
}
