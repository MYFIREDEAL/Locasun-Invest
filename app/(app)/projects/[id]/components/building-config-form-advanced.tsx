"use client";

import { useState, useEffect, useCallback } from "react";
import type { Project } from "@/lib/types/project";
import type {
  BuildingParams,
  BuildingDerived,
  BuildingType,
  ExtensionType,
} from "@/lib/types/building";
import {
  BUILDING_TYPES,
  BUILDING_TYPE_LABELS,
  EXTENSION_TYPES,
  EXTENSION_LABELS,
  ALLOWED_SPACINGS,
  WIDTHS_BY_TYPE,
  SLOPE_BY_TYPE,
  SABLIERE_BY_TYPE,
  TYPE_CONSTRAINTS,
  POLE_POSITION_LABELS,
  STRUCTURE_COLORS,
  STRUCTURE_COLOR_LABELS,
  DEFAULT_STRUCTURE_COLOR,
  type StructureColor,
} from "@/lib/types/building";
import {
  calculateDerived,
  getDefaultParamsForType,
  resetParamsForTypeChange,
  updateParamsForWidthChange,
  calculateZoneWidths,
} from "@/lib/geometry/building-calculations";
import { setVariantsRegistry, type VariantKey, type BuildingVariant } from "@/lib/types/building-variants";
import { getVariants } from "@/lib/actions/variants";
import { Building3DView } from "./building-3d-view";
import { lookupBuildingCost } from "@/lib/data/building-pricing";

/**
 * Ref que le parent peut fournir pour déclencher la sauvegarde
 * depuis le bouton "Valider l'étape" du wizard.
 * La fonction retourne true si le save a réussi, false sinon.
 */
export type SaveRef = React.MutableRefObject<(() => Promise<boolean>) | null>;

interface BuildingConfigFormAdvancedProps {
  project: Project;
  rulesetVersion: string;
  initialParams?: BuildingParams;
  onSave?: (params: BuildingParams, derived: BuildingDerived) => Promise<void>;
  /** Si fourni, le bouton interne est masqué — le parent déclenche le save */
  saveRef?: SaveRef;
}

export function BuildingConfigFormAdvanced({
  project,
  rulesetVersion,
  initialParams,
  onSave,
  saveRef,
}: BuildingConfigFormAdvancedProps) {
  // S'assurer que structureColor a une valeur par défaut
  const normalizedInitialParams = initialParams 
    ? { ...initialParams, structureColor: initialParams.structureColor || DEFAULT_STRUCTURE_COLOR }
    : getDefaultParamsForType("SYM");
    
  const [params, setParams] = useState<BuildingParams>(normalizedInitialParams);
  const [derived, setDerived] = useState<BuildingDerived>(
    calculateDerived(params, rulesetVersion)
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [variantsLoaded, setVariantsLoaded] = useState(false);

  const constraints = TYPE_CONSTRAINTS[params.type];
  const isReadOnly = project.status !== "draft" && project.status !== "returned";

  // Charger les variants depuis Supabase au montage
  useEffect(() => {
    async function loadVariants() {
      try {
        const variants = await getVariants();
        setVariantsRegistry(variants);
        setVariantsLoaded(true);
        // Recalculer avec les nouveaux variants
        setDerived(calculateDerived(params, rulesetVersion));
      } catch (e) {
        console.error("Erreur chargement variants:", e);
        setVariantsLoaded(true); // Continuer avec les valeurs par défaut
      }
    }
    loadVariants();
  }, []);

  // Recalculer les dérivés quand les params changent
  useEffect(() => {
    if (variantsLoaded) {
      setDerived(calculateDerived(params, rulesetVersion));
    }
  }, [params, rulesetVersion, variantsLoaded]);

  const updateParam = useCallback(<K extends keyof BuildingParams>(
    key: K,
    value: BuildingParams[K]
  ) => {
    setParams((prev) => ({ ...prev, [key]: value }));
    setError(null);
  }, []);

  const handleTypeChange = useCallback((newType: BuildingType) => {
    setParams((prev) => resetParamsForTypeChange(prev, newType));
    setError(null);
  }, []);

  const handleWidthChange = useCallback((newWidth: number) => {
    setParams((prev) => updateParamsForWidthChange(prev, newWidth));
    setError(null);
  }, []);

  const handleSave = async () => {
    if (!onSave) return;
    setIsSaving(true);
    setError(null);
    try {
      await onSave(params, derived);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur lors de la sauvegarde");
    } finally {
      setIsSaving(false);
    }
  };

  // Exposer le save au parent via ref (pour le bouton "Valider l'étape")
  useEffect(() => {
    if (!saveRef) return;
    saveRef.current = async () => {
      if (!onSave) return false;
      setIsSaving(true);
      setError(null);
      try {
        await onSave(params, derived);
        setIsSaving(false);
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur lors de la sauvegarde");
        setIsSaving(false);
        return false;
      }
    };
    return () => { if (saveRef) saveRef.current = null; };
  });

  return (
    <div className="flex gap-6">
      {/* ── Colonne gauche : Formulaire + Récap (scrollable) ── */}
      <div className="w-[400px] shrink-0 space-y-6">

      {/* Formulaire */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">
          Paramètres du bâtiment
        </h3>

        {/* Type de bâtiment */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Type de structure
          </label>
          <select
            value={params.type}
            onChange={(e) => handleTypeChange(e.target.value as BuildingType)}
            disabled={isReadOnly}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 disabled:bg-gray-100"
          >
            {BUILDING_TYPES.map((type) => (
              <option key={type} value={type}>
                {BUILDING_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </div>

        {/* Largeur - dépend du type */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Largeur (m)
          </label>
          <select
            value={params.width}
            onChange={(e) => handleWidthChange(parseFloat(e.target.value))}
            disabled={isReadOnly}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 disabled:bg-gray-100"
          >
            {WIDTHS_BY_TYPE[params.type].map((w) => (
              <option key={w} value={w}>
                {w} m
              </option>
            ))}
          </select>
        </div>

        {/* Paramètres fixes (pente et sablière) */}
        <div className="rounded-md bg-gray-50 p-3">
          <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Paramètres fixes</h4>
          <div className="flex gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-orange-500"></span>
              <span>Pente: {SLOPE_BY_TYPE[params.type]}°</span>
            </div>
            {SABLIERE_BY_TYPE[params.type] !== null && (
              <div className="flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-blue-500"></span>
                <span>H. Égout: {SABLIERE_BY_TYPE[params.type]}m</span>
              </div>
            )}
          </div>
        </div>

        {/* Espacement travée */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Espacement travée (m)
          </label>
          <div className="mt-1 flex gap-2">
            {ALLOWED_SPACINGS.map((spacing) => (
              <button
                key={spacing}
                type="button"
                onClick={() => updateParam("spacing", spacing)}
                disabled={isReadOnly}
                className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                  params.spacing === spacing
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                } disabled:opacity-50`}
              >
                {spacing} m
              </button>
            ))}
          </div>
        </div>

        {/* Nombre de travées */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Nombre de travées
          </label>
          <div className="mt-1 flex items-center gap-3">
            <button
              type="button"
              onClick={() => updateParam("nbSpans", Math.max(1, params.nbSpans - 1))}
              disabled={isReadOnly || params.nbSpans <= 1}
              className="flex h-10 w-10 items-center justify-center rounded-md bg-gray-100 text-xl font-bold text-gray-700 hover:bg-gray-200 disabled:opacity-50"
            >
              −
            </button>
            <span className="w-16 text-center text-lg font-semibold">
              {params.nbSpans}
            </span>
            <button
              type="button"
              onClick={() => updateParam("nbSpans", Math.min(20, params.nbSpans + 1))}
              disabled={isReadOnly || params.nbSpans >= 20}
              className="flex h-10 w-10 items-center justify-center rounded-md bg-gray-100 text-xl font-bold text-gray-700 hover:bg-gray-200 disabled:opacity-50"
            >
              +
            </button>
            <span className="text-sm text-gray-500">
              → Longueur: {derived.length} m
            </span>
          </div>
        </div>

        {/* Extensions (si autorisées) */}
        {constraints.allowsExtensions && (
          <div className="space-y-3 rounded-md bg-gray-50 p-4">
            <h4 className="text-sm font-medium text-gray-700">Extensions</h4>
            
            {/* Extension gauche */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500">Gauche</label>
                <select
                  value={params.extensionLeft}
                  onChange={(e) => {
                    const val = e.target.value as ExtensionType;
                    updateParam("extensionLeft", val);
                    if (val === "none") updateParam("extensionLeftWidth", 0);
                  }}
                  disabled={isReadOnly}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 disabled:bg-gray-100"
                >
                  {EXTENSION_TYPES.map((ext) => (
                    <option key={ext} value={ext}>
                      {EXTENSION_LABELS[ext]}
                    </option>
                  ))}
                </select>
              </div>
              {params.extensionLeft !== "none" && (
                <div>
                  <label className="block text-xs text-gray-500">Largeur (m)</label>
                  <input
                    type="number"
                    value={params.extensionLeftWidth}
                    onChange={(e) => updateParam("extensionLeftWidth", Math.max(0, Math.min(10, parseFloat(e.target.value) || 0)))}
                    min={0}
                    max={10}
                    step={0.5}
                    disabled={isReadOnly}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 disabled:bg-gray-100"
                  />
                </div>
              )}
            </div>

            {/* Extension droite */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500">Droite</label>
                <select
                  value={params.extensionRight}
                  onChange={(e) => {
                    const val = e.target.value as ExtensionType;
                    updateParam("extensionRight", val);
                    if (val === "none") updateParam("extensionRightWidth", 0);
                  }}
                  disabled={isReadOnly}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 disabled:bg-gray-100"
                >
                  {EXTENSION_TYPES.map((ext) => (
                    <option key={ext} value={ext}>
                      {EXTENSION_LABELS[ext]}
                    </option>
                  ))}
                </select>
              </div>
              {params.extensionRight !== "none" && (
                <div>
                  <label className="block text-xs text-gray-500">Largeur (m)</label>
                  <input
                    type="number"
                    value={params.extensionRightWidth}
                    onChange={(e) => updateParam("extensionRightWidth", Math.max(0, Math.min(10, parseFloat(e.target.value) || 0)))}
                    min={0}
                    max={10}
                    step={0.5}
                    disabled={isReadOnly}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 disabled:bg-gray-100"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Couleur de la structure */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Couleur de la structure
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            {STRUCTURE_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => updateParam("structureColor", color)}
                disabled={isReadOnly}
                title={STRUCTURE_COLOR_LABELS[color]}
                className={`relative h-10 w-10 rounded-md border-2 transition-all ${
                  params.structureColor === color
                    ? "border-blue-500 ring-2 ring-blue-200"
                    : "border-gray-300 hover:border-gray-400"
                } disabled:opacity-50`}
                style={{ backgroundColor: color }}
              >
                {params.structureColor === color && (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <svg
                      className={`h-5 w-5 ${color === "#f5f5f4" || color === "#6b7280" ? "text-gray-800" : "text-white"}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </span>
                )}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-gray-500">
            {STRUCTURE_COLOR_LABELS[params.structureColor as StructureColor] || "Noir"}
          </p>
        </div>
      </div>

      {/* Colonne droite (ancien): Résumé et calculs — maintenant sous les paramètres */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">
          Récapitulatif
        </h3>

        {/* Dimensions */}
        <div className="rounded-lg bg-blue-50 p-4">
          <h4 className="text-sm font-medium text-blue-800">Dimensions</h4>
          <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
            <div>Longueur:</div>
            <div className="font-semibold">{derived.length} m</div>
            <div>Largeur:</div>
            <div className="font-semibold">{params.width} m</div>
            <div>Largeur totale:</div>
            <div className="font-semibold">{derived.totalWidth} m</div>
            <div>H. sablière G:</div>
            <div className="font-semibold">{params.heightSabliereLeft} m</div>
            <div>H. sablière D:</div>
            <div className="font-semibold">{params.heightSabliereRight} m</div>
            <div>H. faîtage:</div>
            <div className="font-semibold">{params.heightFaitage} m</div>
            {constraints.hasTwoPans && (
              <>
                <div>Position faîtage:</div>
                <div className="font-semibold text-purple-700">{derived.faitagePosition} m (depuis gauche)</div>
              </>
            )}
            {constraints.hasSlope && (
              <>
                <div>Pente:</div>
                <div className="font-semibold">{derived.slopeAngle.toFixed(1)}°</div>
              </>
            )}
          </div>
        </div>

        {/* Géométrie des pans */}
        <div className="rounded-lg bg-purple-50 p-4">
          <h4 className="text-sm font-medium text-purple-800">Géométrie des pans</h4>
          <div className="mt-2 space-y-3">
            {/* Pan A */}
            <div className="rounded bg-purple-100 p-2">
              <div className="text-xs font-medium text-purple-700 mb-1">
                Pan A (droite{constraints.hasTwoPans && params.type.startsWith("ASYM") ? " - grand pan" : ""})
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <span className="text-gray-500">Largeur:</span>
                  <span className="font-semibold ml-1">{derived.panWidthA} m</span>
                </div>
                <div>
                  <span className="text-gray-500">Δh:</span>
                  <span className="font-semibold ml-1">{derived.heightDeltaPanA} m</span>
                </div>
                <div>
                  <span className="text-gray-500">Rampant:</span>
                  <span className="font-semibold ml-1">{derived.rampantPanA.toFixed(2)} m</span>
                </div>
              </div>
            </div>
            {/* Pan B */}
            {constraints.hasTwoPans && (
              <div className="rounded bg-purple-100 p-2">
                <div className="text-xs font-medium text-purple-700 mb-1">
                  Pan B (gauche{params.type.startsWith("ASYM") ? " - petit pan" : ""})
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="text-gray-500">Largeur:</span>
                    <span className="font-semibold ml-1">{derived.panWidthB} m</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Δh:</span>
                    <span className="font-semibold ml-1">{derived.heightDeltaPanB} m</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Rampant:</span>
                    <span className="font-semibold ml-1">{derived.rampantPanB.toFixed(2)} m</span>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="mt-2 text-xs text-purple-600">
            💡 Calcul Pythagore: rampant = √(largeur² + Δh²)
          </div>
        </div>

        {/* Surfaces */}
        <div className="rounded-lg bg-green-50 p-4">
          <h4 className="text-sm font-medium text-green-800">Surfaces toiture</h4>
          <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
            <div>Pan A:</div>
            <div className="font-semibold">{derived.surfacePanA.toFixed(1)} m²</div>
            {constraints.hasTwoPans && (
              <>
                <div>Pan B:</div>
                <div className="font-semibold">{derived.surfacePanB.toFixed(1)} m²</div>
              </>
            )}
            <div className="border-t pt-1">Total:</div>
            <div className="border-t pt-1 font-bold">{derived.surfaceTotal.toFixed(1)} m²</div>
          </div>
        </div>

        {/* Poteaux intermédiaires et zones */}
        <div className="rounded-lg bg-orange-50 p-4">
          <h4 className="text-sm font-medium text-orange-800">Structure & Zones</h4>
          <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
            <div>Poteaux intermédiaires:</div>
            <div className="font-semibold">
              {derived.hasIntermediatePoles ? (
                <span className="text-orange-600">
                  Oui ({derived.nbIntermediatePoles} poteaux)
                </span>
              ) : (
                <span className="text-gray-500">Non</span>
              )}
            </div>
            {derived.hasIntermediatePoles && derived.polePosition && (
              <>
                <div>Position:</div>
                <div className="font-semibold">
                  {POLE_POSITION_LABELS[derived.polePosition]}
                </div>
                <div>Décalage gauche:</div>
                <div className="font-semibold">{derived.poleOffsetFromLeft?.toFixed(1)} m</div>
              </>
            )}
            {/* Affichage des zones */}
            <div className="col-span-2 mt-2 border-t pt-2">
              <div className="text-xs text-gray-600 mb-1">Largeurs des zones:</div>
              <div className="flex gap-2">
                {calculateZoneWidths(params).map((width, idx) => (
                  <div 
                    key={idx}
                    className="flex-1 rounded bg-orange-100 px-2 py-1 text-center text-sm font-medium"
                  >
                    {width.toFixed(1)} m
                  </div>
                ))}
              </div>
            </div>
            {(constraints.requiresIntermediatePoles || constraints.optionalIntermediatePoles) && (
              <div className="text-xs text-gray-500 col-span-2 mt-1">
                {constraints.requiresIntermediatePoles
                  ? "Poteaux requis pour ce type de structure"
                  : params.width > 20 
                    ? "Poteaux ajoutés (largeur > 20m)"
                    : "Pas de poteaux nécessaires (largeur ≤ 20m)"}
              </div>
            )}
          </div>
        </div>

        {/* Zones PV */}
        <div className="rounded-lg bg-yellow-50 p-4">
          <h4 className="text-sm font-medium text-yellow-800">Zones PV</h4>
          <div className="mt-2 flex gap-4">
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                  derived.zonePvA
                    ? "bg-green-500 text-white"
                    : "bg-gray-300 text-gray-600"
                }`}
              >
                A
              </span>
              <span className="text-sm">
                {derived.zonePvA ? "Disponible" : "Non disponible"}
              </span>
            </div>
            {constraints.hasTwoPans && (
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                    derived.zonePvB
                      ? "bg-green-500 text-white"
                      : "bg-gray-300 text-gray-600"
                  }`}
                >
                  B
                </span>
                <span className="text-sm">
                  {derived.zonePvB ? "Disponible" : "Non disponible"}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Puissance PV */}
        <div className="rounded-lg bg-emerald-50 p-4">
          <h4 className="text-sm font-medium text-emerald-800">⚡ Puissance PV installée</h4>
          <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
            {derived.zonePvA && (
              <>
                <div>Pan A (droite - {params.type.startsWith("ASYM") ? "Sud - grand pan" : "Sud"}):</div>
                <div className="font-semibold">
                  {derived.nbPanelsPanA} panneaux · {derived.powerKwcPanA.toFixed(2)} kWc
                </div>
              </>
            )}
            {constraints.hasTwoPans && derived.zonePvB && (
              <>
                <div>Pan B (gauche - {params.type.startsWith("ASYM") ? "Nord - petit pan" : "Nord"}):</div>
                <div className="font-semibold">
                  {derived.nbPanelsPanB} panneaux · {derived.powerKwcPanB.toFixed(2)} kWc
                </div>
              </>
            )}
            <div className="border-t pt-2 font-medium text-emerald-700">Total:</div>
            <div className="border-t pt-2 font-bold text-emerald-700">
              {derived.nbPanels} panneaux · {derived.powerKwc.toFixed(2)} kWc
            </div>
          </div>
        </div>

        {/* Estimation coût bâtiment (grille tarifaire Nelson) */}
        {(() => {
          const cost = lookupBuildingCost(params.type, params.width, params.nbSpans);
          if (!cost) return null;
          const fmtEur = (v: number) => Math.round(v).toLocaleString("fr-FR") + " €";
          return (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
              <h4 className="text-sm font-medium text-amber-800">💰 Estimation coût bâtiment</h4>
              <div className="mt-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Fondations + Charpente + Couverture:</span>
                  <span className="font-bold text-amber-700 text-lg">{fmtEur(cost.tarif)}</span>
                </div>
                <div className="mt-1 text-xs text-amber-600">
                  Grille Nelson — {cost.exact ? "match exact" : cost.interpolated ? "interpolation" : "approximation"} 
                  {" "}({cost.kwcGrid} kWc ref.)
                </div>
              </div>
            </div>
          );
        })()}

        {/* Ruleset version */}
        <div className="text-xs text-gray-400">
          Ruleset v{rulesetVersion}
        </div>

        {/* Erreur */}
        {error && (
          <div className="rounded-md bg-red-50 p-3">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Bouton de sauvegarde (masqué si le wizard gère le save via saveRef) */}
        {!isReadOnly && onSave && !saveRef && (
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full rounded-md bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isSaving ? "Sauvegarde..." : "💾 Sauvegarder la configuration"}
          </button>
        )}

        {isReadOnly && (
          <div className="rounded-md bg-yellow-50 p-3">
            <p className="text-sm text-yellow-800">
              ⚠️ Projet en statut &quot;{project.status}&quot; - lecture seule
            </p>
          </div>
        )}
      </div>
      </div>{/* fin colonne gauche */}

      {/* ── Colonne droite : Vue 3D (sticky) ── */}
      <div className="flex-1 min-w-0">
        <div className="sticky top-32 rounded-lg border border-gray-200 bg-white overflow-hidden">
          <div className="aspect-[4/3]">
            <Building3DView config={{ params, derived }} />
          </div>
        </div>
      </div>
    </div>
  );
}
