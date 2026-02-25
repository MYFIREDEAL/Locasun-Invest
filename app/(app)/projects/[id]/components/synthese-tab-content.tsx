"use client";

/**
 * Onglet Synthèse — Récapitulatif technique complet + estimation financière
 * 
 * Section 1 : Récap technique
 *   - Dimensions, structure, pente, surfaces
 *   - Panneaux solaires (nombre, puissance)
 *   - Production solaire (kWh/an)
 * 
 * Section 2 : Raccordement électrique
 *   - Distance transfo → PDL → bâtiment (annotations)
 *   - Poste source Enedis le plus proche (API)
 * 
 * Section 3 : Sécurité incendie
 *   - Bouche incendie / Bâche à eau annotée
 *   - Distance au bâtiment
 *   - Conformité SDIS (< 200m bouche, < 400m bâche)
 * 
 * Section 4 : PLU & Cadastre
 *   - Zone PLU, conformité hauteurs / recul
 *   - Parcelle(s), surface, section
 *   - Conflit zones si multi-parcelle
 * 
 * Section 5 : Environnement & risques
 *   - Altitude, vent Eurocode, proximité océan
 *   - Natura 2000, Géorisques
 * 
 * Section 6 : Estimation financière
 *   - Coûts structure, panneaux, main d'œuvre
 *   - Revenu annuel, ROI
 * 
 * Section 7 : Checklist de validation
 */

import { Fragment, useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import type { Project } from "@/lib/types/project";
import type { BuildingConfigRow, BuildingParams, BuildingDerived } from "@/lib/types/building";
import { BUILDING_TYPE_LABELS, TYPE_CONSTRAINTS } from "@/lib/types/building";
import type { PvgisResult } from "@/lib/types/pvgis";
import type { ParcelleInfo } from "@/lib/types/parcelle";
import { getZoneLabel } from "@/lib/types/parcelle";
import type { MapAnnotationRow } from "@/lib/types/annotations";
import { haversineDistanceAnnotation, polylineLengthMetres, formatAnnotationDistance, SUBTYPE_EMOJI, SUBTYPE_LABEL } from "@/lib/types/annotations";
import { getBuildingConfig } from "@/lib/actions/building-configs";
import { getPvgisResult } from "@/lib/actions/pvgis";
import { getAnnotations } from "@/lib/actions/annotations";
import { getOwnedParcelles, type OwnedParcelleRow } from "@/lib/actions/owned-parcelles";
import { getFinanceSnapshot } from "@/lib/actions/finance";
import type { FinanceSnapshot } from "@/lib/types/finance";
import { runPluAnalysis } from "@/lib/geometry/plu-checks";
import type { PluAnalysis } from "@/lib/types/plu";
import { CONFORMITE_DISPLAY } from "@/lib/types/plu";
import { InvestorSummaryBlock } from "./investor-summary-block";
import { FinancialAnnexe } from "./financial-annexe";
import dynamic from "next/dynamic";

const Building3DView = dynamic(
  () => import("./building-3d-view").then((m) => m.Building3DView),
  { ssr: false, loading: () => <div className="flex items-center justify-center h-full bg-gradient-to-b from-blue-50 to-gray-100 rounded-lg text-gray-400 text-sm">Chargement 3D…</div> },
);

interface SyntheseTabContentProps {
  project: Project;
  /** Si fourni (depuis le wizard), utilisé en priorité sur le fetch DB */
  pvgisOverride?: PvgisResult | null;
}

/** Distance max bouche incendie → bâtiment (SDIS) */
const SDIS_BOUCHE_MAX_M = 200;

/** Distance max bâche à eau → bâtiment (SDIS) */
const SDIS_BACHE_MAX_M = 400;

// ============================================================================
// HELPERS
// ============================================================================

function formatNumber(n: number): string {
  return n.toLocaleString("fr-FR", { maximumFractionDigits: 0 });
}

function formatCurrency(n: number): string {
  return n.toLocaleString("fr-FR", { maximumFractionDigits: 0 }) + " €";
}

/** Calcule la distance en mètres entre le centroïde du bâtiment et une annotation point */
function distanceToBuildingM(
  annotation: MapAnnotationRow,
  centroidLat: number,
  centroidLon: number,
): number | null {
  if (annotation.geometry.type !== "Point") return null;
  const [lng, lat] = annotation.geometry.coordinates;
  return Math.round(haversineDistanceAnnotation(centroidLat, centroidLon, lat, lng));
}

// ============================================================================
// STATUS BADGE
// ============================================================================

function CheckBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
      ok ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
    }`}>
      {ok ? "✅" : "❌"} {label}
    </span>
  );
}

function WarnBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
      ⚠️ {label}
    </span>
  );
}

function InfoBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
      ℹ️ {label}
    </span>
  );
}

function PluStatusBadge({ status }: { status: "conforme" | "non-conforme" | "indisponible" }) {
  const d = CONFORMITE_DISPLAY[status];
  return (
    <span className={`font-semibold text-xs ${d.color}`}>
      {d.icon} {d.label}
    </span>
  );
}

// ============================================================================
// COMPOSANT PRINCIPAL
// ============================================================================

export function SyntheseTabContent({ project, pvgisOverride }: SyntheseTabContentProps) {
  const [configRow, setConfigRow] = useState<BuildingConfigRow | null>(null);
  const [pvgis, setPvgis] = useState<PvgisResult | null>(pvgisOverride ?? null);
  const [annotations, setAnnotations] = useState<MapAnnotationRow[]>([]);
  const [parcelle, setParcelle] = useState<ParcelleInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [ownedParcelleIdus, setOwnedParcelleIdus] = useState<Set<string>>(new Set());
  const [ownedGeometries, setOwnedGeometries] = useState<GeoJSON.MultiPolygon[]>([]);
  const [ownedParcelles, setOwnedParcelles] = useState<OwnedParcelleRow[]>([]);
  const [financeSnapshot, setFinanceSnapshot] = useState<FinanceSnapshot | null>(null);

  // Sync pvgisOverride quand il change (ex: recalcul depuis la carte)
  useEffect(() => {
    if (pvgisOverride !== undefined) {
      setPvgis(pvgisOverride);
    }
  }, [pvgisOverride]);

  const loadData = useCallback(async () => {
    setLoading(true);
    // Si pvgisOverride est fourni, pas besoin de fetch PVGIS depuis la DB
    const needsPvgisFetch = pvgisOverride === undefined || pvgisOverride === null;
    const [configResult, pvgisResult, annotationsResult, ownedResult, snapshotResult] = await Promise.all([
      getBuildingConfig(project.id),
      needsPvgisFetch ? getPvgisResult(project.id) : Promise.resolve(null),
      getAnnotations(project.id),
      getOwnedParcelles(project.id),
      getFinanceSnapshot(project.id),
    ]);

    if (configResult.success && configResult.data) {
      setConfigRow(configResult.data);
      // Lire les données parcellaires directement depuis le cache DB
      // (sauvegardées par la carte lors du clic "Sauvegarder")
      if (configResult.data.parcelle_data) {
        setParcelle(configResult.data.parcelle_data);
      }
    }
    if (pvgisResult && pvgisResult.success && pvgisResult.data) {
      setPvgis(pvgisResult.data);
    }
    if (annotationsResult.success) {
      setAnnotations(annotationsResult.data);
    }
    // Owned parcelles
    if (ownedResult.success && ownedResult.data.length > 0) {
      const idus = new Set<string>();
      const geoms: GeoJSON.MultiPolygon[] = [];
      for (const row of ownedResult.data) {
        idus.add(row.idu);
        if (row.geometry) {
          geoms.push(row.geometry);
        }
      }
      setOwnedParcelleIdus(idus);
      setOwnedGeometries(geoms);
      setOwnedParcelles(ownedResult.data);
    }
    // Finance snapshot
    if (snapshotResult && snapshotResult.success && snapshotResult.data) {
      setFinanceSnapshot(snapshotResult.data);
    }
    setLoading(false);
  }, [project.id, pvgisOverride]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // --- Annotations utiles ---
  const centroidLat = configRow?.centroid_lat ?? null;
  const centroidLon = configRow?.centroid_lon ?? null;

  const transfoAnnotations = useMemo(() =>
    annotations.filter(a => a.subtype === "transfo").map(a => ({
      ...a,
      distanceM: centroidLat && centroidLon ? distanceToBuildingM(a, centroidLat, centroidLon) : null,
    })),
    [annotations, centroidLat, centroidLon],
  );

  const pdlAnnotations = useMemo(() =>
    annotations.filter(a => a.subtype === "pdl").map(a => ({
      ...a,
      distanceM: centroidLat && centroidLon ? distanceToBuildingM(a, centroidLat, centroidLon) : null,
    })),
    [annotations, centroidLat, centroidLon],
  );

  const incendieAnnotations = useMemo(() =>
    annotations.filter(a => a.subtype === "incendie").map(a => ({
      ...a,
      distanceM: centroidLat && centroidLon ? distanceToBuildingM(a, centroidLat, centroidLon) : null,
    })),
    [annotations, centroidLat, centroidLon],
  );

  const eauAnnotations = useMemo(() =>
    annotations.filter(a => a.subtype === "eau").map(a => ({
      ...a,
      distanceM: centroidLat && centroidLon ? distanceToBuildingM(a, centroidLat, centroidLon) : null,
    })),
    [annotations, centroidLat, centroidLon],
  );

  const cableAnnotations = useMemo(() =>
    annotations.filter(a => a.subtype === "cable" && a.geometry.type === "LineString").map(a => ({
      ...a,
      lengthM: a.geometry.type === "LineString" ? Math.round(polylineLengthMetres(a.geometry.coordinates)) : null,
    })),
    [annotations],
  );

  // Câble Transfo → PDL
  const transfoToPdlCable = useMemo(() => {
    if (cableAnnotations.length === 0) return null;
    for (const cable of cableAnnotations) {
      const startIsTransfo = transfoAnnotations.some(t => t.id === cable.linked_start_id);
      const endIsPdl = pdlAnnotations.some(p => p.id === cable.linked_end_id);
      const startIsPdl = pdlAnnotations.some(p => p.id === cable.linked_start_id);
      const endIsTransfo = transfoAnnotations.some(t => t.id === cable.linked_end_id);
      if ((startIsTransfo && endIsPdl) || (startIsPdl && endIsTransfo)) {
        return cable;
      }
    }
    return null;
  }, [cableAnnotations, transfoAnnotations, pdlAnnotations]);

  // Câble PDL → Bâtiment
  const batimentAnnotations = useMemo(() =>
    annotations.filter(a => a.subtype === "batiment"),
    [annotations],
  );

  const pdlToBatimentCable = useMemo(() => {
    if (cableAnnotations.length === 0) return null;
    for (const cable of cableAnnotations) {
      const startIsPdl = pdlAnnotations.some(p => p.id === cable.linked_start_id);
      const endIsBat = batimentAnnotations.some(b => b.id === cable.linked_end_id);
      const startIsBat = batimentAnnotations.some(b => b.id === cable.linked_start_id);
      const endIsPdl = pdlAnnotations.some(p => p.id === cable.linked_end_id);
      if ((startIsPdl && endIsBat) || (startIsBat && endIsPdl)) {
        return cable;
      }
    }
    return null;
  }, [cableAnnotations, pdlAnnotations, batimentAnnotations]);

  // Distance totale raccordement = câble Transfo→PDL + câble PDL→Bâtiment
  const distanceTransfoPdlM = transfoToPdlCable?.lengthM ?? null;
  const distancePdlBatimentM = pdlToBatimentCable?.lengthM ?? null;
  const distanceTotaleRaccordementM =
    distanceTransfoPdlM !== null && distancePdlBatimentM !== null
      ? distanceTransfoPdlM + distancePdlBatimentM
      : null;

  // --- PLU Analysis ---
  const pluAnalysis: PluAnalysis | null = useMemo(() => {
    if (!configRow || !parcelle) return null;
    // Recalculer les corners depuis le polygon
    const corners: [number, number][] = [];
    if (configRow.polygon) {
      const coords = configRow.polygon.coordinates[0];
      if (coords) {
        for (const [lon, lat] of coords.slice(0, 4)) {
          corners.push([lat, lon]);
        }
      }
    }
    const parcellesSecondaires = (parcelle.parcellesSecondaires ?? []).map((p) => ({
      zoneUrba: p.zoneUrba,
      parcelle: `${p.cadastre.section}-${p.cadastre.numero} (${p.cadastre.nom_com})`,
    }));
    // Collecter les géométries des parcelles secondaires possédées
    const ownedAdjacentGeometries: GeoJSON.MultiPolygon[] = [...ownedGeometries];
    if (ownedParcelleIdus.size > 0) {
      for (const sec of parcelle.parcellesSecondaires ?? []) {
        if (ownedParcelleIdus.has(sec.cadastre.idu) && !ownedGeometries.some(g => g === sec.geometry)) {
          ownedAdjacentGeometries.push(sec.geometry);
        }
      }
    }
    return runPluAnalysis(
      parcelle.zoneUrba ?? null,
      configRow.params.heightSabliereLeft,
      configRow.params.heightFaitage,
      corners,
      parcelle.cadastreGeometry ?? null,
      parcellesSecondaires,
      ownedAdjacentGeometries,
    );
  }, [configRow, parcelle, ownedParcelleIdus, ownedGeometries]);

  // --- Loading ---
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Chargement de la synthèse…</div>
      </div>
    );
  }

  // --- Pas de config ---
  if (!configRow) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
        <div className="text-4xl mb-4">📋</div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Configuration requise</h3>
        <p className="text-sm text-gray-500">
          Configurez d&apos;abord le bâtiment dans l&apos;onglet Configuration, puis placez-le sur la Carte.
        </p>
      </div>
    );
  }

  const params = configRow.params;
  const derived = configRow.derived;
  const constraints = TYPE_CONSTRAINTS[params.type];
  const hasLocation = configRow.centroid_lat !== null;

  // Surface au sol
  const surfaceAuSol = derived.length * (params.width + (params.extensionLeftWidth ?? 0) + (params.extensionRightWidth ?? 0));

  // Sécurité incendie — trouver la source la plus proche
  const nearestIncendie = incendieAnnotations.length > 0
    ? incendieAnnotations.reduce((best, a) => (!best || (a.distanceM ?? Infinity) < (best.distanceM ?? Infinity)) ? a : best)
    : null;
  const nearestEau = eauAnnotations.length > 0
    ? eauAnnotations.reduce((best, a) => (!best || (a.distanceM ?? Infinity) < (best.distanceM ?? Infinity)) ? a : best)
    : null;

  const incendieOk = nearestIncendie ? (nearestIncendie.distanceM ?? Infinity) <= SDIS_BOUCHE_MAX_M : false;
  const eauOk = nearestEau ? (nearestEau.distanceM ?? Infinity) <= SDIS_BACHE_MAX_M : false;
  const hasIncendieSource = nearestIncendie !== null || nearestEau !== null;
  const incendieGlobalOk = incendieOk || eauOk;

  return (
    <div className="space-y-6">
      {/* ================================================================ */}
      {/* SECTION 1 : BÂTIMENT & PRODUCTION                                */}
      {/* ================================================================ */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          🔧 Bâtiment
        </h2>

        {/* --- Ligne haute : infos à gauche, 3D à droite --- */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Colonne gauche : dimensions + hauteurs + panneaux */}
          <div className="space-y-4">
            {/* Dimensions */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2 border-b pb-1">📐 Dimensions</h3>
              <dl className="space-y-1.5 text-sm">
                <Row label="Type" value={BUILDING_TYPE_LABELS[params.type]} />
                <Row label="Largeur" value={`${params.width} m`} />
                <Row label="Longueur" value={`${derived.length} m (${params.nbSpans} travées × ${params.spacing} m)`} />
                <Row label="Surface au sol" value={`${formatNumber(surfaceAuSol)} m²`} />
                <Row label="Surface toiture" value={`${formatNumber(derived.surfaceTotal)} m²`} />
                {constraints.hasTwoPans && (
                  <>
                    <Row label="Surface pan A" value={`${formatNumber(derived.surfacePanA)} m² (rampant ${derived.rampantPanA.toFixed(2)} m)`} />
                    <Row label="Surface pan B" value={`${formatNumber(derived.surfacePanB)} m² (rampant ${derived.rampantPanB.toFixed(2)} m)`} />
                  </>
                )}
              </dl>
            </div>

            {/* Hauteurs & pente */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2 border-b pb-1">📏 Hauteurs & pente</h3>
              <dl className="space-y-1.5 text-sm">
                <Row label="Sablière gauche" value={`${params.heightSabliereLeft} m`} />
                <Row label="Sablière droite" value={`${params.heightSabliereRight} m`} />
                <Row label="Faîtage" value={`${params.heightFaitage} m`} />
                <Row label="Pente" value={`${derived.slopeAngle}°`} />
                {derived.hasIntermediatePoles && (
                  <Row label="Poteaux intermédiaires" value={`${derived.nbIntermediatePoles} (${derived.polePosition ?? "centre"})`} />
                )}
              </dl>
            </div>

            {/* Panneaux solaires */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2 border-b pb-1">☀️ Panneaux solaires</h3>
              <dl className="space-y-1.5 text-sm">
                <Row label="Nombre total" value={`${derived.nbPanels} panneaux`} />
                <Row label="Puissance totale" value={`${derived.powerKwc.toFixed(1)} kWc`} />
                {constraints.hasTwoPans && (
                  <>
                    <Row label="Pan A" value={`${derived.nbPanelsPanA} panneaux · ${derived.powerKwcPanA.toFixed(1)} kWc`} />
                    <Row label="Pan B" value={`${derived.nbPanelsPanB} panneaux · ${derived.powerKwcPanB.toFixed(1)} kWc`} />
                  </>
                )}
              </dl>
            </div>
          </div>

          {/* Colonne droite : vue 3D */}
          <div className="rounded-lg overflow-hidden border border-gray-200 min-h-[320px]">
            <Building3DView config={{ params, derived }} />
          </div>
        </div>

        {/* --- KPI Production solaire (sous la 3D) --- */}
        {pvgis ? (
          <div className="mt-6 grid grid-cols-3 gap-4">
            <div className="rounded-lg border border-green-200 bg-green-50 p-4">
              <p className="text-2xl font-bold text-green-700">{formatNumber(pvgis.totals.annualKwh)}</p>
              <p className="text-xs text-green-600 mt-1">Production annuelle (kWh)</p>
            </div>
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
              <p className="text-2xl font-bold text-blue-700">{derived.powerKwc.toFixed(1)}</p>
              <p className="text-xs text-blue-600 mt-1">Puissance installée (kWc)</p>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <p className="text-2xl font-bold text-amber-700">{pvgis.totals.annualKwhPerKwc}</p>
              <p className="text-xs text-amber-600 mt-1">Rendement (kWh/kWc)</p>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-xs text-gray-400 italic">
            Calcul PVGIS non disponible — retournez à l&apos;étape Carte pour lancer la simulation.
          </p>
        )}
      </div>

      {/* ================================================================ */}
      {/* SECTION 2 : RACCORDEMENT & SÉCURITÉ INCENDIE                     */}
      {/* ================================================================ */}
      <div className="grid gap-6 md:grid-cols-2">
          {/* --- Colonne gauche : Raccordement électrique --- */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">⚡ Raccordement électrique</h2>

            {!hasLocation ? (
              <p className="text-xs text-gray-400 italic">Placez le bâtiment sur la carte.</p>
            ) : transfoAnnotations.length === 0 && pdlAnnotations.length === 0 ? (
              <p className="text-xs text-orange-600 italic">⚠️ Annotez le transformateur, le PDL et tracez les câbles sur la carte.</p>
            ) : (
              <>
                {/* Schéma visuel compact */}
                <div className="flex items-center gap-2 text-xs mb-3 flex-wrap">
                  <span className="inline-flex items-center gap-1 rounded bg-white border px-1.5 py-0.5 font-medium">{SUBTYPE_EMOJI.transfo} Transfo</span>
                  <span className="text-gray-400">——</span>
                  <span className="font-semibold text-gray-700">{distanceTransfoPdlM !== null ? formatAnnotationDistance(distanceTransfoPdlM) : "?"}</span>
                  <span className="text-gray-400">→</span>
                  <span className="inline-flex items-center gap-1 rounded bg-white border px-1.5 py-0.5 font-medium">{SUBTYPE_EMOJI.pdl} PDL</span>
                  <span className="text-gray-400">——</span>
                  <span className="font-semibold text-gray-700">{distancePdlBatimentM !== null ? formatAnnotationDistance(distancePdlBatimentM) : "?"}</span>
                  <span className="text-gray-400">→</span>
                  <span className="inline-flex items-center gap-1 rounded bg-white border px-1.5 py-0.5 font-medium">🏗 Bât.</span>
                </div>

                <dl className="space-y-1 text-sm border-t pt-2">
                  <div className="flex justify-between gap-4">
                    <dt className="text-gray-600">Transfo → PDL</dt>
                    <dd className="font-medium">{distanceTransfoPdlM !== null ? formatAnnotationDistance(distanceTransfoPdlM) : <span className="text-orange-500 italic text-xs">non tracé</span>}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-gray-600">PDL → Bâtiment</dt>
                    <dd className="font-medium">{distancePdlBatimentM !== null ? formatAnnotationDistance(distancePdlBatimentM) : <span className="text-orange-500 italic text-xs">non tracé</span>}</dd>
                  </div>
                  <div className={`flex justify-between gap-4 border-t pt-1 font-semibold ${distanceTotaleRaccordementM !== null ? "text-green-700" : "text-gray-400"}`}>
                    <dt>Distance totale</dt>
                    <dd>{distanceTotaleRaccordementM !== null ? formatAnnotationDistance(distanceTotaleRaccordementM) : "—"}</dd>
                  </div>
                </dl>
              </>
            )}
          </div>

          {/* --- Colonne droite : Sécurité incendie DECI --- */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">🚒 Sécurité incendie (DECI)</h2>

            {!hasLocation ? (
              <p className="text-xs text-gray-400 italic">Placez le bâtiment sur la carte.</p>
            ) : !hasIncendieSource ? (
              <p className="text-xs text-orange-600 italic">⚠️ Annotez une bouche incendie ou bâche à eau sur la carte.</p>
            ) : (
              <div className="space-y-3">
                {nearestIncendie && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-600 mb-1">🚒 Bouche / poteau incendie</h4>
                    <dl className="space-y-1 text-sm">
                      <Row label="Distance au bâtiment" value={nearestIncendie.distanceM !== null ? formatAnnotationDistance(nearestIncendie.distanceM) : "—"} />
                      <Row label="Norme SDIS" value={`≤ ${SDIS_BOUCHE_MAX_M} m`} />
                    </dl>
                    <div className="mt-1">
                      {incendieOk
                        ? <CheckBadge ok={true} label="Conforme" />
                        : <CheckBadge ok={false} label={`Non conforme (${nearestIncendie.distanceM} m > ${SDIS_BOUCHE_MAX_M} m)`} />
                      }
                    </div>
                  </div>
                )}

                {nearestEau && (
                  <div className={nearestIncendie ? "border-t pt-2" : ""}>
                    <h4 className="text-xs font-semibold text-gray-600 mb-1">💧 Bâche à eau / réserve</h4>
                    <dl className="space-y-1 text-sm">
                      <Row label="Distance au bâtiment" value={nearestEau.distanceM !== null ? formatAnnotationDistance(nearestEau.distanceM) : "—"} />
                      <Row label="Norme SDIS" value={`≤ ${SDIS_BACHE_MAX_M} m`} />
                    </dl>
                    <div className="mt-1">
                      {eauOk
                        ? <CheckBadge ok={true} label="Conforme" />
                        : <CheckBadge ok={false} label={`Non conforme (${nearestEau.distanceM} m > ${SDIS_BACHE_MAX_M} m)`} />
                      }
                    </div>
                  </div>
                )}

                {/* Résumé DECI */}
                <div className="border-t pt-2">
                  {incendieGlobalOk ? (
                    <div className="text-green-700 text-xs font-medium">✅ DECI conforme</div>
                  ) : (
                    <div className="text-red-700 text-xs font-medium">🔴 DECI non conforme — prévoir bâche à eau ou forage</div>
                  )}
                </div>
              </div>
            )}
          </div>
      </div>

      {/* ================================================================ */}
      {/* SECTION 4 : PLU & CADASTRE                                       */}
      {/* ================================================================ */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          📋 PLU & Cadastre
        </h2>

        {!parcelle ? (
          <p className="text-xs text-gray-400 italic">
            {hasLocation ? "Sauvegardez la carte pour obtenir les données cadastrales." : "Placez le bâtiment sur la carte."}
          </p>
        ) : (
          <div className="space-y-5">
            {/* --- Tableau des parcelles --- */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">🗺️ Parcelles concernées</h3>
              {parcelle.cadastre ? (
                <>
                  {parcelle.adresseLabel && (
                    <p className="text-xs text-gray-500 mb-2">📍 {parcelle.adresseLabel}</p>
                  )}
                  <div className="overflow-x-auto rounded border border-gray-200">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-600">
                          <th className="px-3 py-2"></th>
                          <th className="px-3 py-2">Commune</th>
                          <th className="px-3 py-2">Section</th>
                          <th className="px-3 py-2">N°</th>
                          <th className="px-3 py-2 text-right">Surface</th>
                          <th className="px-3 py-2">Zone PLU</th>
                          <th className="px-3 py-2">IDU</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {/* Parcelle principale */}
                        <tr className="bg-blue-50/40">
                          <td className="px-3 py-1.5 text-xs font-medium text-blue-700">
                            Principale{ownedParcelleIdus.has(parcelle.cadastre.idu) ? " 🔑" : ""}
                          </td>
                          <td className="px-3 py-1.5">{parcelle.cadastre.nom_com}</td>
                          <td className="px-3 py-1.5">{parcelle.cadastre.section}</td>
                          <td className="px-3 py-1.5">{parcelle.cadastre.numero}</td>
                          <td className="px-3 py-1.5 text-right">{formatNumber(parcelle.cadastre.contenance)} m²</td>
                          <td className="px-3 py-1.5">
                            {parcelle.zoneUrba ? (
                              <span className="inline-flex items-center gap-1 text-xs">
                                <span className="font-medium">{parcelle.zoneUrba.libelle}</span>
                                <span className="text-gray-400">({getZoneLabel(parcelle.zoneUrba.typezone)})</span>
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-3 py-1.5 text-xs text-gray-500">{parcelle.cadastre.idu}</td>
                        </tr>

                        {/* Parcelles secondaires */}
                        {parcelle.parcellesSecondaires.map((p, i) => (
                          <tr key={i} className="bg-orange-50/30">
                            <td className="px-3 py-1.5 text-xs font-medium text-orange-600">
                              Secondaire {i + 1}{ownedParcelleIdus.has(p.cadastre.idu) ? " 🔑" : ""}
                            </td>
                            <td className="px-3 py-1.5">{p.cadastre.nom_com}</td>
                            <td className="px-3 py-1.5">{p.cadastre.section}</td>
                            <td className="px-3 py-1.5">{p.cadastre.numero}</td>
                            <td className="px-3 py-1.5 text-right">{formatNumber(p.cadastre.contenance)} m²</td>
                            <td className="px-3 py-1.5">
                              {p.zoneUrba ? (
                                <span className="inline-flex items-center gap-1 text-xs">
                                  <span className="font-medium">{p.zoneUrba.libelle}</span>
                                  <span className="text-gray-400">({getZoneLabel(p.zoneUrba.typezone)})</span>
                                </span>
                              ) : (
                                <span className="text-xs text-gray-400">—</span>
                              )}
                            </td>
                            <td className="px-3 py-1.5 text-xs text-gray-500">{p.cadastre.idu}</td>
                          </tr>
                        ))}

                        {/* Parcelles propriétaire (ajoutées manuellement via 🔑, hors principale/secondaires) */}
                        {ownedParcelles
                          .filter(op => {
                            // Exclure celles déjà affichées comme Principale ou Secondaire
                            if (parcelle.cadastre && op.idu === parcelle.cadastre.idu) return false;
                            return !parcelle.parcellesSecondaires.some(ps => ps.cadastre.idu === op.idu);
                          })
                          .map((op) => (
                          <tr key={op.idu} className="bg-green-50/30">
                            <td className="px-3 py-1.5 text-xs font-medium text-green-700">🔑 Proprio</td>
                            <td className="px-3 py-1.5">{op.cadastre_props.nom_com}</td>
                            <td className="px-3 py-1.5">{op.cadastre_props.section}</td>
                            <td className="px-3 py-1.5">{op.cadastre_props.numero}</td>
                            <td className="px-3 py-1.5 text-right">{formatNumber(op.cadastre_props.contenance)} m²</td>
                            <td className="px-3 py-1.5">
                              {op.zone_urba ? (
                                <span className="inline-flex items-center gap-1 text-xs">
                                  <span className="font-medium">{op.zone_urba.libelle}</span>
                                  <span className="text-gray-400">({getZoneLabel(op.zone_urba.typezone)})</span>
                                </span>
                              ) : (
                                <span className="text-xs text-gray-400">—</span>
                              )}
                            </td>
                            <td className="px-3 py-1.5 text-xs text-gray-500">{op.idu}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {parcelle.parcellesSecondaires.length > 0 && (
                    <p className="mt-1.5 text-xs text-orange-600 font-medium">
                      ⚠️ Bâtiment à cheval sur {parcelle.parcellesSecondaires.length + 1} parcelles
                    </p>
                  )}

                  {ownedParcelles.length > 0 && (
                    <p className="mt-1 text-xs text-green-700 font-medium">
                      🔑 {(() => {
                        // La principale est toujours considérée comme possédée
                        const principaleIdu = parcelle.cadastre?.idu;
                        const extraOwned = ownedParcelles.filter(op => op.idu !== principaleIdu);
                        const totalCount = 1 + extraOwned.length; // 1 = principale
                        const totalSurface = (parcelle.cadastre?.contenance ?? 0) +
                          extraOwned.reduce((sum, op) => sum + (op.cadastre_props.contenance ?? 0), 0);
                        return `${totalCount} parcelle${totalCount > 1 ? "s" : ""} détenue${totalCount > 1 ? "s" : ""} par le propriétaire (surface totale proprio : ${formatNumber(totalSurface)} m²)`;
                      })()}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-xs text-gray-400 italic">Données cadastrales indisponibles</p>
              )}
            </div>

            {/* --- Analyse PLU --- */}
            {pluAnalysis && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">📐 Conformité PLU</h3>
                <div className="rounded border border-gray-200 p-3 space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-600">Statut global :</span>
                    <PluStatusBadge status={pluAnalysis.globalStatus} />
                  </div>

                  {/* Hauteurs */}
                  {pluAnalysis.heightCheck && pluAnalysis.rules?.maxHeightM && (
                    <div className="text-xs flex justify-between items-center">
                      <span className="text-gray-500">Faîtage : {pluAnalysis.heightCheck.heightFaitageM.toFixed(1)} m / {pluAnalysis.rules.maxHeightM} m max</span>
                      <PluStatusBadge status={pluAnalysis.heightCheck.faitageStatus} />
                    </div>
                  )}

                  {/* Distance limites */}
                  {pluAnalysis.distanceCheck.distanceMinM !== null && pluAnalysis.rules?.minDistanceBoundaryM && (
                    <div className="text-xs flex justify-between items-center">
                      <span className="text-gray-500">Recul : {pluAnalysis.distanceCheck.distanceMinM.toFixed(1)} m / {pluAnalysis.rules.minDistanceBoundaryM} m min</span>
                      <PluStatusBadge status={pluAnalysis.distanceCheck.status} />
                    </div>
                  )}

                  {/* Conflit zones multi-parcelles */}
                  {pluAnalysis.zoneConflict?.hasDifferentZones && (
                    <div className="bg-red-50 border border-red-300 text-red-700 px-2 py-1.5 rounded text-xs">
                      🔴 <span className="font-semibold">Zones PLU différentes entre les parcelles</span>
                      <ul className="mt-0.5 ml-3 list-disc">
                        {pluAnalysis.zoneConflict.zones.map((z, i) => (
                          <li key={i}>{getZoneLabel(z.typezone)} ({z.libelle}) — {z.parcelle}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {pluAnalysis.zoneConflict && !pluAnalysis.zoneConflict.hasDifferentZones && (
                    <div className="bg-green-50 border border-green-200 text-green-700 px-2 py-1.5 rounded text-xs">
                      ✅ <span className="font-semibold">Même zone PLU</span> sur toutes les parcelles
                    </div>
                  )}

                  {/* Lien GPU */}
                  {pluAnalysis.gpuDocumentUrl && (
                    <a href={pluAnalysis.gpuDocumentUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 underline hover:text-blue-800">
                      Voir le PLU sur le Géoportail ↗
                    </a>
                  )}

                  {pluAnalysis.rules?.source === "default" && (
                    <p className="text-xs text-orange-500">⚠️ Valeurs par défaut (règlement exact non disponible via API)</p>
                  )}
                </div>
              </div>
            )}

            {/* --- Mairie de la commune --- */}
            {parcelle.mairie && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">🏛️ Mairie — {parcelle.mairie.nom}</h3>
                <div className="rounded border border-gray-200 p-3 space-y-2">
                  {/* Téléphone */}
                  {parcelle.mairie.telephones.length > 0 && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-gray-500">📞</span>
                      {parcelle.mairie.telephones.map((tel, i) => (
                        <a key={i} href={`tel:${tel.replace(/\s/g, "")}`} className="text-blue-600 underline hover:text-blue-800 font-medium">
                          {tel}
                        </a>
                      ))}
                    </div>
                  )}

                  {/* Email */}
                  {parcelle.mairie.email && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-gray-500">✉️</span>
                      <a href={`mailto:${parcelle.mairie.email}`} className="text-blue-600 underline hover:text-blue-800">
                        {parcelle.mairie.email}
                      </a>
                    </div>
                  )}

                  {/* Adresse */}
                  {parcelle.mairie.adresse && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-gray-500">📍</span>
                      <span className="text-gray-700">{parcelle.mairie.adresse}</span>
                    </div>
                  )}

                  {/* Horaires */}
                  {parcelle.mairie.horaires.length > 0 && (
                    <div className="text-xs">
                      <p className="text-gray-500 mb-1">🕐 Horaires d&apos;ouverture :</p>
                      <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 ml-5">
                        {parcelle.mairie.horaires.map((h, i) => {
                          const jour = h.jourDebut === h.jourFin ? h.jourDebut : `${h.jourDebut}–${h.jourFin}`;
                          const plage1 = h.heureDebut1 && h.heureFin1 ? `${h.heureDebut1}–${h.heureFin1}` : "";
                          const plage2 = h.heureDebut2 && h.heureFin2 ? `${h.heureDebut2}–${h.heureFin2}` : "";
                          const plages = [plage1, plage2].filter(Boolean).join(" / ");
                          return (
                            <Fragment key={i}>
                              <span className="text-gray-600 font-medium">{jour}</span>
                              <span className="text-gray-500">{plages || "Fermé"}{h.commentaire ? ` (${h.commentaire})` : ""}</span>
                            </Fragment>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Liens */}
                  <div className="flex gap-3 pt-1">
                    {parcelle.mairie.siteInternet && (
                      <a href={parcelle.mairie.siteInternet} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 underline hover:text-blue-800">
                        Site internet ↗
                      </a>
                    )}
                    {parcelle.mairie.urlServicePublic && (
                      <a href={parcelle.mairie.urlServicePublic} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 underline hover:text-blue-800">
                        Fiche service-public.fr ↗
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ================================================================ */}
      {/* SECTION 5 : ENVIRONNEMENT & RISQUES                              */}
      {/* ================================================================ */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          🌍 Environnement & Risques
        </h2>

        {!parcelle ? (
          <p className="text-xs text-gray-400 italic">
            {hasLocation ? "Sauvegardez la carte pour obtenir ces données." : "Placez le bâtiment sur la carte."}
          </p>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {/* Environnement */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2 border-b pb-1">🏔️ Environnement</h3>
              <dl className="space-y-1.5 text-sm">
                <Row label="Altitude" value={parcelle.altitudeM !== null ? `${formatNumber(parcelle.altitudeM)} m` : "—"} />
                <Row label="Distance océan" value={parcelle.distanceOceanKm !== null ? `${parcelle.distanceOceanKm.toFixed(1)} km` : "—"} />
                {parcelle.isProximiteOcean && (
                  <div className="text-xs text-orange-600 font-semibold">⚠️ Proximité océan &lt; 3 km → surcoût galvanisation</div>
                )}
                <Row label="Zone vent Eurocode" value={parcelle.zoneVent !== null ? `Zone ${parcelle.zoneVent}` : "—"} />
                {parcelle.ventVb0Kmh !== null && (
                  <Row label="Vitesse vent Vb0" value={`${parcelle.ventVb0Kmh} km/h (${parcelle.ventVb0Ms} m/s)`} />
                )}
              </dl>
            </div>

            {/* Risques */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2 border-b pb-1">⚠️ Risques & protections</h3>
              {/* Natura 2000 */}
              {parcelle.natura2000.length > 0 ? (
                <div className="mb-2">
                  <p className="text-xs text-red-600 font-semibold">🌿 Site(s) Natura 2000 :</p>
                  {parcelle.natura2000.map((n, i) => (
                    <p key={i} className="text-xs text-red-500 ml-2">• {n.sitename} ({n.sitetype})</p>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-green-600 mb-2">✅ Aucun site Natura 2000</p>
              )}

              {/* Géorisques */}
              {parcelle.risques.length > 0 ? (
                <div>
                  <p className="text-xs text-orange-600 font-semibold">🏚️ Risques naturels ({parcelle.communeRisques}) :</p>
                  {parcelle.risques.slice(0, 5).map((r, i) => (
                    <p key={i} className="text-xs text-orange-500 ml-2">• {r.libelle_risque_long}</p>
                  ))}
                  {parcelle.risques.length > 5 && (
                    <p className="text-xs text-gray-400 ml-2">… et {parcelle.risques.length - 5} autres</p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-green-600">✅ Aucun risque répertorié</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ================================================================ */}
      {/* SECTION 6 : RENTABILITE — VUE INVESTISSEUR                      */}
      {/* ================================================================ */}
      {financeSnapshot ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-5 flex items-center gap-2">
              💰 Rentabilité — Vue investisseur
            </h2>
            <InvestorSummaryBlock snapshot={financeSnapshot} />
          </div>
          <FinancialAnnexe snapshot={financeSnapshot} />
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            💰 Rentabilité
          </h2>
          <div className="text-center py-8">
            <div className="text-4xl mb-3">💰</div>
            <h3 className="text-base font-semibold text-amber-700 mb-1">Étude financière à revalider</h3>
            <p className="text-sm text-gray-500 mb-4">
              Les données techniques ont été modifiées ou l&apos;étape Finance n&apos;a pas encore été validée.
              Configurez et validez l&apos;étape Finance pour afficher les KPIs de rentabilité.
            </p>
          </div>
        </div>
      )}
      {/* ================================================================ */}
      {/* BOUTON GENERER LES OFFRES                                        */}
      {/* ================================================================ */}
      {financeSnapshot && (
        <div className="rounded-xl border-2 border-emerald-300 bg-gradient-to-r from-emerald-50 to-white p-6 text-center">
          <div className="text-3xl mb-2">📄</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Offres commerciales</h3>
          <p className="text-sm text-gray-500 mb-4">
            Générez une page d&apos;offre à présenter au client (Agri, Développeur…)
          </p>
          <Link
            href={`/projects/${project.id}/offres`}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-800 transition-colors shadow-md"
          >
            🌾 Générer les offres →
          </Link>
        </div>
      )}
      {/* ================================================================ */}
      {/* SECTION 7 : CHECKLIST DE VALIDATION                              */}
      {/* ================================================================ */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          ✅ Checklist projet
        </h2>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-gray-500 uppercase mb-1">Conception</h3>
            <CheckBadge ok={true} label="Configuration bâtiment" />
            <CheckBadge ok={hasLocation} label="Implantation sur carte" />
            <CheckBadge ok={pvgis !== null} label="Calcul solaire PVGIS" />
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-gray-500 uppercase mb-1">Raccordement</h3>
            <CheckBadge ok={transfoAnnotations.length > 0} label="Transfo repéré" />
            <CheckBadge ok={pdlAnnotations.length > 0} label="PDL repéré" />
            {cableAnnotations.length > 0
              ? <CheckBadge ok={true} label={`${cableAnnotations.length} câble(s) tracé(s)`} />
              : <WarnBadge label="Aucun câble tracé" />
            }
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-gray-500 uppercase mb-1">Sécurité incendie</h3>
            {hasIncendieSource
              ? <CheckBadge ok={incendieGlobalOk} label={incendieGlobalOk ? "DECI conforme" : "DECI non conforme"} />
              : <WarnBadge label="Aucune source d'eau annotée" />
            }
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-gray-500 uppercase mb-1">Urbanisme</h3>
            {pluAnalysis ? (
              <>
                <CheckBadge ok={pluAnalysis.globalStatus === "conforme"} label={pluAnalysis.globalStatus === "conforme" ? "PLU conforme" : pluAnalysis.globalStatus === "non-conforme" ? "PLU non conforme" : "PLU indisponible"} />
                {pluAnalysis.zoneConflict?.hasDifferentZones && (
                  <CheckBadge ok={false} label="Zones PLU différentes" />
                )}
              </>
            ) : (
              <InfoBadge label="PLU non chargé" />
            )}
            {parcelle?.natura2000 && parcelle.natura2000.length > 0 && (
              <CheckBadge ok={false} label="Zone Natura 2000" />
            )}
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-gray-500 uppercase mb-1">Rentabilité</h3>
            {financeSnapshot
              ? <>
                  <CheckBadge ok={true} label="Étude financière validée" />
                  <CheckBadge ok={financeSnapshot.triProjetPct !== null && financeSnapshot.triProjetPct >= 3} label={financeSnapshot.triProjetPct !== null ? `TRI ${financeSnapshot.triProjetPct.toFixed(1)} %` : "TRI non calculable"} />
                  <CheckBadge ok={financeSnapshot.dscrMoyen >= 1.0} label={`DSCR ${financeSnapshot.dscrMoyen.toFixed(2)}`} />
                </>
              : <WarnBadge label="Étude financière à valider" />
            }
          </div>
        </div>
      </div>

      {/* ================================================================ */}
      {/* AVERTISSEMENT                                                     */}
      {/* ================================================================ */}
      <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
        <p className="text-xs text-amber-700">
          ⚠️ <span className="font-semibold">Données indicatives</span> — Les informations cadastrales, PLU et environnementales
          proviennent de sources publiques et peuvent nécessiter une vérification terrain.
          Les KPIs financiers sont issus du modèle configuré à l&apos;étape Finance.
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// SOUS-COMPOSANTS
// ============================================================================

/** Ligne clé/valeur pour les récaps */
function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between">
      <dt className="text-gray-500">{label}</dt>
      <dd className={`font-medium ${highlight ? "text-green-700" : "text-gray-900"}`}>{value}</dd>
    </div>
  );
}

/** Ligne de coût avec montant et détail optionnel */
function CostRow({ label, value, detail, bold, highlight }: {
  label: string;
  value: number;
  detail?: string;
  bold?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className={`flex justify-between items-baseline py-0.5 ${bold ? "font-semibold" : ""}`}>
      <div>
        <span className={`text-sm ${highlight ? "text-green-700" : "text-gray-700"}`}>{label}</span>
        {detail && <span className="text-xs text-gray-400 ml-1">({detail})</span>}
      </div>
      <span className={`text-sm tabular-nums ${highlight ? "text-green-700 font-bold" : bold ? "text-gray-900" : "text-gray-600"}`}>
        {formatCurrency(value)}
      </span>
    </div>
  );
}


