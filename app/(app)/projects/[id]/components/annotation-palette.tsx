/**
 * Palette d'annotations cartographiques.
 * Drag & drop des icônes sur la carte + bouton "Tracer câble" + liste câbles.
 */

"use client";

import { memo, useCallback, type DragEvent } from "react";
import {
  PALETTE_ITEMS,
  SUBTYPE_EMOJI,
  SUBTYPE_LABEL,
  polylineLengthMetres,
  formatAnnotationDistance,
  type PointSubtype,
  type AnnotationToolMode,
  type MapAnnotationRow,
  type GeoJSONLineString,
} from "@/lib/types/annotations";

interface CableInfo {
  id: string;
  startLabel: string;
  endLabel: string;
  distance: string;
}

interface AnnotationPaletteProps {
  toolMode: AnnotationToolMode;
  onStartDrawLine: () => void;
  onCancel: () => void;
  annotations: MapAnnotationRow[];
  /** Nombre de parcelles voisines possédées */
  ownedParcelleCount: number;
}

function buildCableList(annotations: MapAnnotationRow[]): CableInfo[] {
  const lines = annotations.filter((a) => a.type === "line");
  const byId = new Map(annotations.map((a) => [a.id, a]));

  return lines.map((line) => {
    const startAnn = line.linked_start_id ? byId.get(line.linked_start_id) : null;
    const endAnn = line.linked_end_id ? byId.get(line.linked_end_id) : null;

    const startLabel = startAnn
      ? `${SUBTYPE_EMOJI[startAnn.subtype] ?? "?"} ${SUBTYPE_LABEL[startAnn.subtype] ?? startAnn.subtype}`
      : "?";
    const endLabel = endAnn
      ? `${SUBTYPE_EMOJI[endAnn.subtype] ?? "?"} ${SUBTYPE_LABEL[endAnn.subtype] ?? endAnn.subtype}`
      : "?";

    const geom = line.geometry as GeoJSONLineString;
    const dist =
      geom.type === "LineString" && geom.coordinates.length >= 2
        ? formatAnnotationDistance(polylineLengthMetres(geom.coordinates))
        : "—";

    return { id: line.id, startLabel, endLabel, distance: dist };
  });
}

export const AnnotationPalette = memo(function AnnotationPalette({
  toolMode,
  onStartDrawLine,
  onCancel,
  annotations,
  ownedParcelleCount,
}: AnnotationPaletteProps) {
  const isDrawing = toolMode.type === "draw-line";
  const cables = buildCableList(annotations);

  const handleDragStart = useCallback((e: DragEvent<HTMLButtonElement>, subtype: PointSubtype, emoji: string) => {
    e.dataTransfer.setData("application/annotation-subtype", subtype);
    e.dataTransfer.effectAllowed = "copy";
    const ghost = document.createElement("div");
    ghost.textContent = emoji;
    ghost.style.cssText = "font-size:28px;position:absolute;top:-100px;left:-100px;";
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 14, 14);
    requestAnimationFrame(() => {
      document.body.removeChild(ghost);
    });
  }, []);

  return (
    <div
      data-map-overlay
      className="bg-white/95 px-3 py-3 rounded-lg shadow-lg text-sm w-[200px]"
    >
      {/* Header */}
      <div className="font-bold text-[10px] text-gray-500 mb-2 text-center uppercase tracking-wider">
        Annotations
      </div>

      {/* Icon grid — drag only */}
      <div className="grid grid-cols-3 gap-1.5 mb-3">
        {PALETTE_ITEMS.map((item) => (
          <button
            key={item.subtype}
            draggable
            onDragStart={(e) => handleDragStart(e, item.subtype, item.emoji)}
            title={`${item.label} — glisser sur la carte`}
            className="flex flex-col items-center justify-center rounded-md px-1 py-1.5 bg-gray-100 hover:bg-gray-200 cursor-grab active:cursor-grabbing transition-colors"
          >
            <span className="text-xl leading-none">{item.emoji}</span>
            <span className="text-[9px] leading-tight mt-1 font-medium truncate w-full text-center">{item.label}</span>
          </button>
        ))}
      </div>

      {/* Draw cable button */}
      <button
        onClick={isDrawing ? onCancel : onStartDrawLine}
        className={`w-full px-2 py-2 text-[11px] font-medium rounded-md border transition-colors
          ${
            isDrawing
              ? "bg-red-50 border-red-300 text-red-700 hover:bg-red-100"
              : "bg-green-50 border-green-300 text-green-700 hover:bg-green-100"
          }`}
      >
        {isDrawing ? "✕ Annuler" : "🔗 Câble"}
      </button>

      {/* Cable instructions */}
      {isDrawing && (
        <div className="mt-1.5 px-1 py-1.5 bg-green-50 border border-green-200 rounded text-[10px] text-green-800 leading-snug text-center">
          Cliquez sur le Transfo sur la carte, puis faites glisser la souris vers le PDL et cliquez dessus pour valider
        </div>
      )}

      {/* Owned parcelle count */}
      {ownedParcelleCount > 0 && (
        <div className="mt-1.5 px-1 py-1 bg-emerald-50 border border-emerald-200 rounded text-[10px] text-emerald-700 text-center font-medium">
          � {ownedParcelleCount} parcelle{ownedParcelleCount > 1 ? "s" : ""} propriétaire
        </div>
      )}

      {/* Cable list */}
      {cables.length > 0 && (
        <div className="border-t mt-2 pt-2">
          <div className="text-[9px] text-gray-400 uppercase tracking-wide mb-1 font-semibold">
            Câbles ({cables.length})
          </div>
          <div className="flex flex-col gap-1 max-h-[160px] overflow-y-auto">
            {cables.map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-1 text-[10px] bg-amber-50 rounded px-1.5 py-1 border border-amber-200"
              >
                <span className="truncate flex-1">{c.startLabel}</span>
                <span className="text-gray-400">→</span>
                <span className="truncate flex-1">{c.endLabel}</span>
                <span className="font-bold text-amber-700 whitespace-nowrap ml-0.5">{c.distance}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});
