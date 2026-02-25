"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Project } from "@/lib/types/project";
import type { StepId } from "@/lib/types/project";
import type { BuildingConfig, BuildingConfigRow } from "@/lib/types/building";
import type { PvgisResult } from "@/lib/types/pvgis";
import { useProjectSteps } from "@/lib/hooks/use-project-steps";
import { StepperHeader } from "./stepper-header";
import { ConfigTabContent } from "./config-tab-content";
import { MapTabContent } from "./map-tab-content";
import { FinanceTabContent } from "./finance-tab-content";
import { SyntheseTabContent } from "./synthese-tab-content";
import { PvgisPanel } from "./pvgis-panel";
import { getBuildingConfig } from "@/lib/actions/building-configs";
import { calculateProjectPvgis, getPvgisResult } from "@/lib/actions/pvgis";
import { saveFinanceSnapshot, clearFinanceSnapshot } from "@/lib/actions/finance";
import { getFinanceState } from "@/lib/actions/finance";
import { computeFinanceModel } from "@/lib/geometry/finance-model";
import type { SaveRef } from "./building-config-form-advanced";

interface ProjectWizardProps {
  project: Project;
  /** Étape initiale passée via query param ?step= */
  initialStep?: StepId;
}

export function ProjectWizard({ project, initialStep }: ProjectWizardProps) {
  const steps = useProjectSteps(project.id, project.wizard_state);
  const [validating, setValidating] = useState(false);

  // Résultat PVGIS partagé entre Carte et Synthèse
  const [pvgisResult, setPvgisResult] = useState<PvgisResult | null>(null);

  // Refs de sauvegarde — chaque step assigne sa fonction save ici
  const batimentSaveRef = useRef<(() => Promise<boolean>) | null>(null);
  const carteSaveRef = useRef<(() => Promise<boolean>) | null>(null);
  const financeSaveRef = useRef<(() => Promise<boolean>) | null>(null);

  // Synchroniser l'étape initiale depuis l'URL (une seule fois)
  useEffect(() => {
    if (initialStep && initialStep !== steps.activeStep) {
      steps.goToStep(initialStep);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync URL quand on change d'étape (shallow via replaceState)
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("step", steps.activeStep);
    window.history.replaceState({}, "", url.toString());
  }, [steps.activeStep]);

  // Handler "Valider l'étape" — save + validate
  const handleValidate = useCallback(async () => {
    setValidating(true);
    try {
      let saved = true;

      switch (steps.activeStep) {
        case "batiment": {
          // 1. Lire l'ancien kWc AVANT la sauvegarde
          const oldConfig = await getBuildingConfig(project.id);
          const oldKwc = oldConfig.success && oldConfig.data
            ? oldConfig.data.derived.powerKwc
            : null;

          // 2. Sauvegarder la config bâtiment
          if (batimentSaveRef.current) {
            saved = await batimentSaveRef.current();
          }

          // 3. Si kWc a changé → invalider finance + synthèse + supprimer snapshot
          if (saved && oldKwc !== null) {
            const newConfig = await getBuildingConfig(project.id);
            const newKwc = newConfig.success && newConfig.data
              ? newConfig.data.derived.powerKwc
              : null;

            if (newKwc !== null && newKwc !== oldKwc) {
              await clearFinanceSnapshot(project.id);
              steps.invalidateFrom("batiment");
            }
          }
          break;
        }
        case "carte": {
          // 1. Sauvegarder la carte (implantation + parcelle)
          if (carteSaveRef.current) {
            saved = await carteSaveRef.current();
          }
          // 2. Lancer le calcul PVGIS (si save OK)
          if (saved) {
            const pvgisRes = await calculateProjectPvgis({
              projectId: project.id,
              forceRecalculate: false,
            });
            if (pvgisRes.success) {
              setPvgisResult(pvgisRes.data);

              // 3. Si productible a été recalculé → invalider finance + synthèse
              if (pvgisRes.recomputed) {
                await clearFinanceSnapshot(project.id);
                steps.invalidateFrom("carte");
              }
            }
            // On ne bloque pas la validation si PVGIS échoue
            // (erreur réseau, pas de pan PV, etc.)
          }
          break;
        }
        case "finance": {
          // 1. Sauvegarder le state finance
          if (financeSaveRef.current) {
            saved = await financeSaveRef.current();
          }
          // 2. Compute finance model + save snapshot
          if (saved) {
            const [finRes, configRes, pvgisRes] = await Promise.all([
              getFinanceState(project.id),
              getBuildingConfig(project.id),
              getPvgisResult(project.id),
            ]);

            if (finRes.success && finRes.data && configRes.success && configRes.data && pvgisRes.success && pvgisRes.data) {
              const kwc = configRes.data.derived.powerKwc;
              const productibleKwhPerKwc = pvgisRes.data.totals.annualKwhPerKwc;
              const model = computeFinanceModel(kwc, productibleKwhPerKwc, finRes.data);

              // Gain net d'exploitation 20 ans = cumul EBE − investissement total
              const cumulEbe20 = model.cumulative.cumulativeEbe[model.cumulative.cumulativeEbe.length - 1] ?? 0;
              const gainNetExploitation20ans = cumulEbe20 - model.totalCost;

              // TODO: REMOVE — console.log temporaires debug investisseur
              console.log("[SNAPSHOT DEBUG]", {
                cumulEbe20,
                totalCost: model.totalCost,
                gainNetExploitation20ans,
                multiplicateur: model.totalCost > 0 ? cumulEbe20 / model.totalCost : 0,
              });

              // Séries BP aplaties (sérialisables en JSONB)
              const snapshotSeries = model.series.map((yr) => ({
                year: yr.year,
                caAcc: yr.caAcc,
                caTb: yr.caTb,
                totalCa: yr.totalCa,
                maintenance: yr.charges.maintenance,
                assurance: yr.charges.assurance,
                divers: yr.charges.divers,
                ifer: yr.charges.ifer,
                totalCharges: yr.charges.totalCharges,
                ebe: yr.ebe,
                amortissement: yr.amortissement,
                interets: yr.interets,
                rai: yr.rai,
                is: yr.is,
                resultatNet: yr.resultatNet,
                dscr: yr.dscr,
              }));

              const snapshot = {
                validatedAt: new Date().toISOString(),
                kwc,
                productibleKwhPerKwc,
                productionAnnuelleKwh: model.productionAnnualKwh,
                totalCost: model.totalCost,
                downPayment: model.downPayment,
                capitalEmprunte: model.capitalEmprunte,
                triProjetPct: model.kpis.triProjetPct,
                dscrMoyen: model.kpis.dscrMoyen,
                roiSansAccYears: model.kpis.roiSansAccYears,
                roiAvecAccYears: model.kpis.roiAvecAccYears,
                revenuAnnee1: model.series[0]?.totalCa ?? 0,
                chargesAnnee1: model.series[0]?.charges.totalCharges ?? 0,
                resultatNetAnnee1: model.series[0]?.resultatNet ?? 0,
                gainNetExploitation20ans,
                series: snapshotSeries,
                cumulative: model.cumulative,
              };
              await saveFinanceSnapshot(project.id, snapshot);
            }
          }
          break;
        }
        case "synthese":
          // Lecture seule — rien à sauvegarder
          break;
      }

      if (saved) {
        steps.validateStep();
      }
    } finally {
      setValidating(false);
    }
  }, [steps, project.id]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Stepper Header sticky */}
      <StepperHeader
        project={project}
        stepsState={steps.stepsState}
        activeStep={steps.activeStep}
        onStepClick={steps.goToStep}
        onValidate={handleValidate}
        onNext={steps.goNext}
        onPrev={steps.goPrev}
        canNavigateTo={steps.canNavigateTo}
        canValidate={steps.canValidate && !validating}
        canGoNext={steps.canGoNext}
      />

      {/* Contenu de l'étape active */}
      <div className="px-8 pt-2 pb-8">
        <StepContent
          activeStep={steps.activeStep}
          project={project}
          onInvalidateFrom={steps.invalidateFrom}
          batimentSaveRef={batimentSaveRef}
          carteSaveRef={carteSaveRef}
          financeSaveRef={financeSaveRef}
          pvgisResult={pvgisResult}
          onPvgisResultChange={setPvgisResult}
        />
      </div>
    </div>
  );
}

/* ═══════════════ Step content router ═══════════════ */

function StepContent({
  activeStep,
  project,
  onInvalidateFrom: _onInvalidateFrom,
  batimentSaveRef,
  carteSaveRef,
  financeSaveRef,
  pvgisResult,
  onPvgisResultChange,
}: {
  activeStep: StepId;
  project: Project;
  onInvalidateFrom: (step: StepId) => void;
  batimentSaveRef: SaveRef;
  carteSaveRef: SaveRef;
  financeSaveRef: SaveRef;
  pvgisResult: PvgisResult | null;
  onPvgisResultChange: (r: PvgisResult | null) => void;
}) {
  switch (activeStep) {
    case "batiment":
      return <BatimentStep project={project} saveRef={batimentSaveRef} />;
    case "carte":
      return (
        <CarteStep
          project={project}
          saveRef={carteSaveRef}
          pvgisResult={pvgisResult}
          onPvgisResultChange={onPvgisResultChange}
        />
      );
    case "finance":
      return <FinanceStep projectId={project.id} saveRef={financeSaveRef} />;
    case "synthese":
      return <SyntheseStep project={project} pvgisResult={pvgisResult} />;
    default:
      return <BatimentStep project={project} saveRef={batimentSaveRef} />;
  }
}

/* ─── Bâtiment (= ancien ConfigTab) ─── */

function BatimentStep({ project, saveRef }: { project: Project; saveRef: SaveRef }) {
  return <ConfigTabContent project={project} saveRef={saveRef} />;
}

/* ─── Carte (= ancien CarteTab + PVGIS Panel) ─── */

function CarteStep({
  project,
  saveRef,
  pvgisResult,
  onPvgisResultChange,
}: {
  project: Project;
  saveRef: SaveRef;
  pvgisResult: PvgisResult | null;
  onPvgisResultChange: (r: PvgisResult | null) => void;
}) {
  const [configRow, setConfigRow] = useState<BuildingConfigRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadConfig() {
      const [configResult, pvgisRes] = await Promise.all([
        getBuildingConfig(project.id),
        // Si pas de pvgisResult en mémoire, tenter de le restaurer depuis la DB
        pvgisResult ? Promise.resolve(null) : getPvgisResult(project.id),
      ]);

      if (configResult.success && configResult.data) {
        setConfigRow(configResult.data);
      }

      // Restaurer pvgisResult depuis la DB si on n'en avait pas
      if (!pvgisResult && pvgisRes && pvgisRes.success && pvgisRes.data) {
        onPvgisResultChange(pvgisRes.data);
      }

      setLoading(false);
    }
    loadConfig();
  }, [project.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[500px]">
        <div className="text-gray-500">Chargement de la configuration…</div>
      </div>
    );
  }

  if (!configRow) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6">
        <h2 className="mb-2 text-lg font-semibold text-amber-800">
          Configuration requise
        </h2>
        <p className="text-sm text-amber-700">
          Revenez à l&apos;étape Bâtiment pour configurer le hangar avant
          d&apos;accéder à la carte.
        </p>
      </div>
    );
  }

  const config: BuildingConfig = {
    params: configRow.params,
    derived: configRow.derived,
  };

  return (
    <div className="space-y-4">
      {/* Carte — isolate crée un contexte d'empilement pour que les z-index
          internes de Leaflet (400+) ne débordent pas sur le header sticky */}
      <div className="isolate rounded-lg border border-gray-200 bg-white p-6">
        <MapTabContent
          projectId={project.id}
          config={config}
          configRow={configRow}
          saveRef={saveRef}
        />
      </div>

      {/* Panel PVGIS */}
      <PvgisPanel
        projectId={project.id}
        result={pvgisResult}
        onResultChange={onPvgisResultChange}
      />
    </div>
  );
}

/* ─── Finance (placeholder) ─── */

function FinanceStep({ projectId, saveRef }: { projectId: string; saveRef: SaveRef }) {
  return <FinanceTabContent projectId={projectId} saveRef={saveRef} />;
}

/* ─── Synthèse (= ancien SyntheseTab) ─── */

function SyntheseStep({
  project,
  pvgisResult,
}: {
  project: Project;
  pvgisResult: PvgisResult | null;
}) {
  return <SyntheseTabContent project={project} pvgisOverride={pvgisResult} />;
}
