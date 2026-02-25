/**
 * Panneau "Analyse technique" — conformité PLU
 * Affiche les résultats des contrôles hauteur et distance limites parcelle.
 * S'insère dans le panneau droit de map-view.tsx.
 *
 * ⚠️ L'API GPU ne fournit pas les règles PLU structurées (hauteur max, recul).
 * Seul le type de zone (A, N, U…) est disponible. Les contrôles utilisent donc
 * des valeurs par défaut indicatives par type de zone, clairement signalées.
 */

"use client";

import type { PluAnalysis } from "@/lib/types/plu";
import { CONFORMITE_DISPLAY } from "@/lib/types/plu";
import { getZoneLabel } from "@/lib/types/parcelle";

interface PluAnalysisPanelProps {
  analysis: PluAnalysis | null;
  loading?: boolean;
}

/** Badge de conformité coloré */
function StatusBadge({ status }: { status: "conforme" | "non-conforme" | "indisponible" }) {
  const display = CONFORMITE_DISPLAY[status];
  return (
    <span className={`font-semibold ${display.color}`}>
      {display.icon} {display.label}
    </span>
  );
}

export function PluAnalysisPanel({ analysis, loading }: PluAnalysisPanelProps) {
  // Skeleton pendant le chargement
  if (loading) {
    return (
      <>
        <hr className="my-2" />
        <div className="space-y-1.5 animate-pulse">
          <div className="h-3 bg-gray-200 rounded w-2/5" />
          <div className="h-2.5 bg-gray-100 rounded w-3/4" />
          <div className="h-2.5 bg-gray-100 rounded w-2/3" />
          <div className="h-2.5 bg-gray-100 rounded w-1/2" />
        </div>
      </>
    );
  }

  // Pas d'analyse disponible
  if (!analysis) {
    return (
      <>
        <hr className="my-2" />
        <div className="font-bold mb-1 text-xs">🏗️ Analyse technique</div>
        <div className="text-xs text-gray-400">En attente des données…</div>
      </>
    );
  }

  const { heightCheck, distanceCheck, rules } = analysis;
  const isDefaultRules = rules?.source === "default";

  return (
    <>
      <hr className="my-2" />
      <div className="flex items-center justify-between mb-1">
        <div className="font-bold text-xs">🏗️ Analyse technique</div>
        <StatusBadge status={analysis.globalStatus} />
      </div>

      {/* Zone PLU détectée */}
      <div className="text-xs mb-1">
        📐 PLU :{" "}
        {analysis.pluAvailable ? (
          <span className="font-semibold">
            {analysis.zoneType ? getZoneLabel(analysis.zoneType) : "Zone détectée"}{" "}
            {analysis.zoneLabel && <span className="text-gray-500">({analysis.zoneLabel})</span>}
          </span>
        ) : (
          <span className="text-gray-400">PLU indisponible</span>
        )}
      </div>

      {/* ⚠️ Conflit de zones PLU entre parcelles */}
      {analysis.zoneConflict?.hasDifferentZones && (
        <div className="text-xs bg-red-50 border border-red-300 text-red-700 px-2 py-1 rounded mb-1.5">
          🔴 <span className="font-semibold">Zones PLU différentes</span> — le bâtiment est à cheval sur des parcelles de zones distinctes :
          <ul className="mt-0.5 ml-3 list-disc">
            {analysis.zoneConflict.zones.map((z, i) => (
              <li key={i}>
                <span className="font-semibold">{getZoneLabel(z.typezone)}</span>{" "}
                <span className="text-red-500">({z.libelle})</span>{" "}
                — parcelle {z.parcelle}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Zones identiques entre parcelles (pas de conflit) */}
      {analysis.zoneConflict && !analysis.zoneConflict.hasDifferentZones && (
        <div className="text-xs bg-green-50 border border-green-200 text-green-700 px-2 py-1 rounded mb-1.5">
          ✅ <span className="font-semibold">Même zone PLU</span> sur toutes les parcelles ({analysis.zoneConflict.zones[0]?.typezone})
        </div>
      )}

      {/* Avertissement : règles par défaut (PLU exact non dispo via API) */}
      {isDefaultRules && (
        <div className="text-xs bg-orange-50 border border-orange-200 text-orange-700 px-2 py-1 rounded mb-1.5">
          ⚠️ <span className="font-semibold">Règlement PLU indisponible</span> — valeurs par défaut zone {analysis.zoneType}
          {rules.maxHeightM !== null && ` (H≤${rules.maxHeightM}m`}
          {rules.minDistanceBoundaryM !== null && `, recul≥${rules.minDistanceBoundaryM}m)`}
          {rules.maxHeightM === null && rules.minDistanceBoundaryM === null && ""}
          {analysis.gpuDocumentUrl && (
            <>
              {" · "}
              <a
                href={analysis.gpuDocumentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-semibold text-orange-800 hover:text-orange-900"
              >
                Voir le PLU ↗
              </a>
            </>
          )}
        </div>
      )}

      {/* Source GPU officielle (si un jour on a les vraies règles) */}
      {rules && rules.source === "gpu" && (
        <div className="text-xs text-green-600 mb-1.5">
          ✅ Règles GPU officielles · H max {rules.maxHeightM}m · Recul {rules.minDistanceBoundaryM}m
        </div>
      )}

      {/* --- Hauteurs --- */}
      <div className="space-y-0.5 mb-1.5">
        <div className="text-xs font-semibold text-gray-600">📏 Hauteurs</div>

        {heightCheck ? (
          <>
            <div className="text-xs flex items-center gap-1">
              <span>Sablière : {heightCheck.heightSabliereM.toFixed(1)} m</span>
              {heightCheck.maxHeightM !== null ? (
                <>
                  <span className="text-gray-400">/ {heightCheck.maxHeightM} m</span>
                  <StatusBadge status={heightCheck.sabliereStatus} />
                </>
              ) : (
                <span className="text-gray-400">— Règle non définie</span>
              )}
            </div>
            <div className="text-xs flex items-center gap-1">
              <span>Faîtage : {heightCheck.heightFaitageM.toFixed(1)} m</span>
              {heightCheck.maxHeightM !== null ? (
                <>
                  <span className="text-gray-400">/ {heightCheck.maxHeightM} m</span>
                  <StatusBadge status={heightCheck.faitageStatus} />
                </>
              ) : (
                <span className="text-gray-400">— Règle non définie</span>
              )}
            </div>
          </>
        ) : (
          <div className="text-xs text-gray-400">Données de hauteur non disponibles</div>
        )}
      </div>

      {/* --- Distance limites parcelle --- */}
      <div className="space-y-0.5">
        <div className="text-xs font-semibold text-gray-600">📐 Distance limites</div>

        <div className="text-xs flex items-center gap-1">
          {distanceCheck.distanceMinM !== null ? (
            <>
              <span>Distance min : {distanceCheck.distanceMinM.toFixed(1)} m</span>
              {distanceCheck.minRequiredM !== null ? (
                <>
                  <span className="text-gray-400">/ {distanceCheck.minRequiredM} m requis</span>
                  <StatusBadge status={distanceCheck.status} />
                </>
              ) : (
                <span className="text-gray-400">— Règle non définie</span>
              )}
            </>
          ) : (
            <span className="text-gray-400">Parcelle indisponible</span>
          )}
        </div>
      </div>

      {/* Résumé non-conforme */}
      {analysis.globalStatus === "non-conforme" && (
        <div className="text-xs text-red-600 mt-1.5 bg-red-50 px-2 py-1 rounded">
          ⚠️ {analysis.summary}
        </div>
      )}
    </>
  );
}
