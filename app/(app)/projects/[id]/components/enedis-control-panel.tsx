/**
 * Panneau de contrôle réseau Enedis — version compacte.
 * Titre + bouton rafraîchir + poste le plus proche.
 */

"use client";

import type { EnedisLayerVisibility, EnedisNearestPoste } from "@/lib/types/enedis";
import { ENEDIS_COLORS } from "@/lib/types/enedis";
import { formatDistance } from "@/lib/geometry/enedis-utils";

interface EnedisControlPanelProps {
  visibility: EnedisLayerVisibility;
  onToggle: (layer: keyof EnedisLayerVisibility) => void;
  loading: boolean;
  error: string | null;
  onLoad: () => void;
  nearestPoste: EnedisNearestPoste | null;
  postesCount: number;
  lignesBtCount: number;
  lignesHtaCount: number;
  timestamp: string | null;
  warnings: string[];
}

export function EnedisControlPanel({
  loading,
  error,
  onLoad,
  nearestPoste,
  postesCount,
  lignesBtCount,
  lignesHtaCount,
}: EnedisControlPanelProps) {
  const hasData = postesCount > 0 || lignesBtCount > 0 || lignesHtaCount > 0;

  return (
    <div data-map-overlay className="bg-white/95 px-2.5 py-2 rounded-lg shadow-lg z-[1000] text-sm w-[200px]">
      {/* Header + bouton */}
      <div className="flex items-center justify-between mb-1.5">
        <span className="font-bold text-xs flex items-center gap-1">⚡ Réseau Enedis</span>
      </div>

      <button
        onClick={onLoad}
        disabled={loading}
        className="w-full px-2 py-1 text-[11px] font-medium rounded border transition-colors
          bg-yellow-50 border-yellow-300 hover:bg-yellow-100 disabled:opacity-50 disabled:cursor-wait"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-1">
            <span className="animate-spin inline-block w-3 h-3 border-2 border-yellow-500 border-t-transparent rounded-full" />
            Chargement…
          </span>
        ) : hasData ? (
          "🔄 Rafraîchir le réseau"
        ) : (
          "📡 Charger le réseau"
        )}
      </button>

      {/* Error */}
      {error && (
        <div className="mt-1.5 p-1 bg-red-50 border border-red-200 rounded text-[10px] text-red-700 truncate">
          ⚠️ {error}
        </div>
      )}

      {/* Nearest poste info */}
      {nearestPoste && (
        <div className="border-t pt-1.5 mt-1.5">
          <div className="text-[10px] text-gray-400 mb-0.5">Poste le plus proche</div>
          <div className="flex items-start gap-1.5">
            <span style={{ color: ENEDIS_COLORS.poste }} className="text-sm leading-none mt-0.5">●</span>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-[11px] truncate">{nearestPoste.name}</div>
              <div className="text-[10px] text-gray-500">{nearestPoste.subtype}</div>
              <div className="text-[11px] font-bold text-gray-800 mt-0.5">
                📏 {formatDistance(nearestPoste.distanceM)} <span className="font-normal text-gray-500">à vol d&apos;oiseau</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Légende Enedis + Routes — bandeau horizontal en bas de la carte.
 */
export function EnedisLegend({ visible, showRoutes }: { visible: boolean; showRoutes?: boolean }) {
  if (!visible && !showRoutes) return null;

  return (
    <div data-map-overlay className="absolute top-3 left-1/2 -translate-x-1/2 bg-black/70 backdrop-blur-sm px-5 py-2 rounded-full z-[1000] flex items-center gap-4 text-xs text-white whitespace-nowrap">
      {showRoutes && (
        <span className="flex items-center gap-1.5">
          <span style={{ color: "#ffffff", fontWeight: "bold", fontSize: "14px", lineHeight: 1 }}>━━</span>
          Route
        </span>
      )}
      {visible && (
        <>
          <span className="flex items-center gap-1.5">
            <span style={{ color: ENEDIS_COLORS.poste }} className="text-sm">●</span>
            Poste
          </span>
          <span className="flex items-center gap-1.5">
            <span style={{ color: ENEDIS_COLORS.btAerien, fontSize: "14px" }}>━━</span>
            BT aérien
          </span>
          <span className="flex items-center gap-1.5">
            <span style={{ color: ENEDIS_COLORS.btEnterre, fontSize: "14px" }}>╌╌</span>
            BT enterré
          </span>
          <span className="flex items-center gap-1.5">
            <span style={{ color: ENEDIS_COLORS.htaAerien, fontSize: "14px" }}>━━</span>
            HTA aérien
          </span>
          <span className="flex items-center gap-1.5">
            <span style={{ color: "#ffffff", fontSize: "12px", textShadow: "0 0 2px #333" }}>●</span>
            Poteau MT
          </span>
          <span className="flex items-center gap-1.5">
            <span style={{ color: ENEDIS_COLORS.htaEnterre, fontSize: "14px" }}>╌╌</span>
            HTA enterré
          </span>
        </>
      )}
    </div>
  );
}
