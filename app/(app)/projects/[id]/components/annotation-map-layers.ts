/**
 * Fonctions Leaflet pour dessiner les annotations sur la carte.
 * Points (icônes draggables), lignes (câbles avec sommets éditables),
 * et ancre bâtiment.
 *
 * Architecture: on maintient un LayerGroup séparé qu'on clearLayers() + re-dessine
 * à chaque changement d'annotations. Les callbacks (drag, click, dblclick) sont
 * passés en paramètre pour découpler du state React.
 */

import L from "leaflet";
import type {
  MapAnnotationRow,
  AnnotationSubtype,
  GeoJSONPoint,
  GeoJSONLineString,
} from "@/lib/types/annotations";
import {
  SUBTYPE_EMOJI,
  SUBTYPE_LABEL,
  polylineLengthMetres,
  formatAnnotationDistance,
} from "@/lib/types/annotations";

// ============================================================================
// TYPES
// ============================================================================

export interface AnnotationLayerGroup {
  points: L.LayerGroup;
  lines: L.LayerGroup;
  drawPreview: L.LayerGroup;
}

export interface AnnotationCallbacks {
  /** Called when a point marker is dragged to a new position */
  onPointDragEnd: (id: string, lat: number, lng: number) => void;
  /** Called when a point or anchor is clicked (for line drawing start/end) */
  onAnnotationClick: (id: string) => void;
  /** Called when user wants to delete a point */
  onDeletePoint: (id: string) => void;
  /** Called when user edits metadata note */
  onUpdateNote: (id: string, note: string) => void;
  /** Called when a line vertex is dragged */
  onLineVertexDrag: (lineId: string, vertexIndex: number, lat: number, lng: number) => void;
  /** Called when a line vertex drag ends (persist) */
  onLineVertexDragEnd: (lineId: string, newCoords: [number, number][]) => void;
  /** Called when user wants to delete a line */
  onDeleteLine: (id: string) => void;
}

// ============================================================================
// CREATE LAYER GROUPS
// ============================================================================

export function createAnnotationLayerGroups(): AnnotationLayerGroup {
  return {
    points: L.layerGroup(),
    lines: L.layerGroup(),
    drawPreview: L.layerGroup(),
  };
}

// ============================================================================
// DRAW ANNOTATIONS
// ============================================================================

/**
 * Clear and redraw all annotation layers.
 */
export function drawAnnotations(
  map: L.Map,
  layers: AnnotationLayerGroup,
  annotations: MapAnnotationRow[],
  callbacks: AnnotationCallbacks
): void {
  layers.points.clearLayers();
  layers.lines.clearLayers();

  // Add layer groups to map if not already added
  if (!map.hasLayer(layers.points)) {
    layers.points.addTo(map);
  }
  if (!map.hasLayer(layers.lines)) {
    layers.lines.addTo(map);
  }
  if (!map.hasLayer(layers.drawPreview)) {
    layers.drawPreview.addTo(map);
  }

  // Draw lines first (below points)
  const lines = annotations.filter((a) => a.type === "line");
  for (const line of lines) {
    drawLineAnnotation(layers.lines, line, annotations, callbacks);
  }

  // Draw points and anchors
  const pointsAndAnchors = annotations.filter(
    (a) => a.type === "point" || a.type === "anchor"
  );
  for (const pt of pointsAndAnchors) {
    drawPointAnnotation(layers.points, pt, callbacks);
  }
}

// ============================================================================
// POINT ANNOTATION
// ============================================================================

function makeIconHtml(subtype: AnnotationSubtype, isAnchor: boolean): string {
  const emoji = SUBTYPE_EMOJI[subtype] ?? "📍";
  const label = SUBTYPE_LABEL[subtype] ?? subtype;
  const bgColor = isAnchor ? "rgba(37,99,235,0.9)" : "rgba(255,255,255,0.95)";
  const border = isAnchor ? "2px solid #1d4ed8" : "2px solid #6b7280";
  const shadow = isAnchor
    ? "0 2px 8px rgba(37,99,235,0.5)"
    : "0 2px 6px rgba(0,0,0,0.3)";
  const textColor = isAnchor ? "#fff" : "#333";

  return `<div style="
    display:flex;flex-direction:column;align-items:center;
    pointer-events:auto;cursor:${isAnchor ? "default" : "grab"};
  ">
    <div style="
      width:30px;height:30px;
      display:flex;align-items:center;justify-content:center;
      background:${bgColor};
      border:${border};
      border-radius:50%;
      box-shadow:${shadow};
      font-size:16px;
      user-select:none;
    ">${emoji}</div>
    <div style="
      margin-top:2px;
      background:rgba(0,0,0,0.7);
      color:${isAnchor ? "#93c5fd" : textColor === "#333" ? "#fff" : textColor};
      padding:1px 4px;
      border-radius:3px;
      font-size:9px;
      font-weight:600;
      white-space:nowrap;
      line-height:12px;
      pointer-events:none;
    ">${label}</div>
  </div>`;
}

// ============================================================================
// BÂCHE À EAU — 10m × 10m blue square
// ============================================================================

const BACHE_SIZE_M = 10; // metres

/** Compute LatLngBounds for a 10m×10m square centered on (lat, lng) */
function bacheRectBounds(lat: number, lng: number): L.LatLngBoundsExpression {
  // ~1° lat ≈ 111 320 m — ~1° lng ≈ 111 320 × cos(lat)
  const halfM = BACHE_SIZE_M / 2;
  const dLat = halfM / 111320;
  const dLng = halfM / (111320 * Math.cos((lat * Math.PI) / 180));
  return [
    [lat - dLat, lng - dLng],
    [lat + dLat, lng + dLng],
  ];
}

/** Create a styled L.Rectangle for the bâche à eau */
function createBacheRect(lat: number, lng: number): L.Rectangle {
  return L.rectangle(bacheRectBounds(lat, lng), {
    color: "#2563eb",
    weight: 2,
    opacity: 0.8,
    fillColor: "#3b82f6",
    fillOpacity: 0.3,
    interactive: false,
  });
}

// ============================================================================
// POINT ANNOTATION
// ============================================================================

function drawPointAnnotation(
  layerGroup: L.LayerGroup,
  annotation: MapAnnotationRow,
  callbacks: AnnotationCallbacks
): void {
  const geom = annotation.geometry as GeoJSONPoint;
  if (geom.type !== "Point") return;

  const [lng, lat] = geom.coordinates;
  const isAnchor = annotation.type === "anchor";

  // For "eau" (bâche à eau), draw a 10m×10m blue square
  let bacheRect: L.Rectangle | null = null;
  if (annotation.subtype === "eau") {
    bacheRect = createBacheRect(lat, lng);
    bacheRect.addTo(layerGroup);
  }

  const marker = L.marker([lat, lng], {
    draggable: !isAnchor,
    icon: L.divIcon({
      html: makeIconHtml(annotation.subtype, isAnchor),
      iconSize: [50, 46],
      iconAnchor: [25, 15],
      className: "",
    }),
    bubblingMouseEvents: false,
  });

  // Popup with note + delete
  const note = (annotation.metadata as Record<string, unknown> | null)?.note ?? "";
  const subtypeLabel = annotation.subtype;
  const popupHtml = isAnchor
    ? `<div style="min-width:120px;font-size:12px">
        <strong>🏗 Ancre bâtiment</strong>
        <div style="color:#666;font-size:11px;margin-top:4px">Non supprimable</div>
      </div>`
    : `<div style="min-width:160px;font-size:12px">
        <strong>${SUBTYPE_EMOJI[annotation.subtype] ?? ""} ${subtypeLabel}</strong>
        <div style="margin:6px 0">
          <input type="text" value="${escapeHtml(String(note))}"
            placeholder="Ajouter une note..."
            data-annotation-note="${annotation.id}"
            style="width:100%;padding:3px 6px;border:1px solid #ddd;border-radius:4px;font-size:11px"
          />
        </div>
        <button data-annotation-delete="${annotation.id}"
          style="width:100%;padding:3px;background:#fee2e2;border:1px solid #fca5a5;border-radius:4px;font-size:11px;color:#dc2626;cursor:pointer"
        >🗑 Supprimer</button>
      </div>`;

  marker.bindPopup(popupHtml, { closeButton: true });

  // Handle popup interactions
  marker.on("popupopen", () => {
    setTimeout(() => {
      const noteInput = document.querySelector(
        `[data-annotation-note="${annotation.id}"]`
      ) as HTMLInputElement | null;
      if (noteInput) {
        noteInput.addEventListener("change", () => {
          callbacks.onUpdateNote(annotation.id, noteInput.value);
        });
      }
      const deleteBtn = document.querySelector(
        `[data-annotation-delete="${annotation.id}"]`
      );
      if (deleteBtn) {
        deleteBtn.addEventListener("click", () => {
          callbacks.onDeletePoint(annotation.id);
          marker.closePopup();
        });
      }
    }, 50);
  });

  // Click handler for line drawing
  marker.on("click", () => {
    callbacks.onAnnotationClick(annotation.id);
  });

  // Drag handler
  if (!isAnchor) {
    marker.on("drag", () => {
      // Move bâche rectangle with marker during drag
      if (bacheRect) {
        const pos = marker.getLatLng();
        bacheRect.setBounds(bacheRectBounds(pos.lat, pos.lng));
      }
    });
    marker.on("dragend", () => {
      const pos = marker.getLatLng();
      if (bacheRect) {
        bacheRect.setBounds(bacheRectBounds(pos.lat, pos.lng));
      }
      callbacks.onPointDragEnd(annotation.id, pos.lat, pos.lng);
    });
  }

  marker.addTo(layerGroup);
}

// ============================================================================
// LINE ANNOTATION
// ============================================================================

function drawLineAnnotation(
  layerGroup: L.LayerGroup,
  line: MapAnnotationRow,
  allAnnotations: MapAnnotationRow[],
  callbacks: AnnotationCallbacks
): void {
  const geom = line.geometry as GeoJSONLineString;
  if (geom.type !== "LineString" || geom.coordinates.length < 2) return;

  const latLngs: [number, number][] = geom.coordinates.map(
    (c) => [c[1], c[0]] as [number, number]
  );

  // White outline for contrast on satellite imagery
  L.polyline(latLngs, {
    color: "#ffffff",
    weight: 8,
    opacity: 0.5,
    interactive: false,
  }).addTo(layerGroup);

  // Invisible wide hit area for easy clicking
  const hitArea = L.polyline(latLngs, {
    color: "transparent",
    weight: 20,
    opacity: 0,
    interactive: true,
    bubblingMouseEvents: false,
  });

  // Main cable line (visual only)
  const polyline = L.polyline(latLngs, {
    color: "#22c55e",
    weight: 4,
    opacity: 0.9,
    dashArray: "8,4",
    interactive: false,
  });

  // Distance label
  const totalLength = polylineLengthMetres(geom.coordinates);
  const midIdx = Math.floor(latLngs.length / 2);
  const midPoint = latLngs[midIdx]!;

  const distLabel = L.marker(midPoint, {
    icon: L.divIcon({
      html: `<div style="
        background:rgba(0,0,0,0.75);
        color:#4ade80;
        padding:2px 6px;
        border-radius:10px;
        font-size:11px;
        font-weight:600;
        white-space:nowrap;
        pointer-events:none;
      ">${formatAnnotationDistance(totalLength)}</div>`,
      iconSize: [0, 0],
      iconAnchor: [0, -8],
      className: "",
    }),
    interactive: false,
  });
  distLabel.addTo(layerGroup);

  // Popup on the hit area for deletion
  hitArea.bindPopup(
    `<div style="min-width:140px;font-size:12px">
      <strong>🔗 Câble</strong>
      <div style="margin:4px 0;color:#666">${formatAnnotationDistance(totalLength)}</div>
      <button data-line-delete="${line.id}"
        style="width:100%;padding:3px;background:#fee2e2;border:1px solid #fca5a5;border-radius:4px;font-size:11px;color:#dc2626;cursor:pointer"
      >🗑 Supprimer</button>
    </div>`,
    { closeButton: true }
  );

  hitArea.on("popupopen", () => {
    setTimeout(() => {
      const deleteBtn = document.querySelector(
        `[data-line-delete="${line.id}"]`
      );
      if (deleteBtn) {
        deleteBtn.addEventListener("click", () => {
          callbacks.onDeleteLine(line.id);
          hitArea.closePopup();
        });
      }
    }, 50);
  });

  hitArea.addTo(layerGroup);
  polyline.addTo(layerGroup);

  // Draggable vertex markers
  const coordsCopy = [...geom.coordinates];
  for (let i = 0; i < latLngs.length; i++) {
    const ll = latLngs[i]!;
    const vertexIdx = i;

    const vertexMarker = L.marker(ll, {
      draggable: true,
      icon: L.divIcon({
        html: `<div style="
          width:12px;height:12px;
          background:#22c55e;
          border:2px solid #fff;
          border-radius:50%;
          box-shadow:0 1px 4px rgba(0,0,0,0.4);
          cursor:grab;
        "></div>`,
        iconSize: [12, 12],
        iconAnchor: [6, 6],
        className: "",
      }),
      bubblingMouseEvents: false,
    });

    vertexMarker.on("drag", (e: L.LeafletEvent) => {
      const pos = (e.target as L.Marker).getLatLng();
      callbacks.onLineVertexDrag(line.id, vertexIdx, pos.lat, pos.lng);
    });

    vertexMarker.on("dragend", () => {
      const pos = vertexMarker.getLatLng();
      coordsCopy[vertexIdx] = [pos.lng, pos.lat];
      callbacks.onLineVertexDragEnd(line.id, [...coordsCopy]);
    });

    vertexMarker.addTo(layerGroup);
  }
}

// ============================================================================
// DRAW PREVIEW (line being drawn)
// ============================================================================

/**
 * Draw the preview polyline during cable drawing mode.
 * @param vertices - Array of [lat, lng] (Leaflet order)
 * @param cursorPos - Current cursor position [lat, lng] or null
 */
export function drawLinePreview(
  layers: AnnotationLayerGroup,
  vertices: [number, number][],
  cursorPos: [number, number] | null
): void {
  layers.drawPreview.clearLayers();
  if (vertices.length === 0) return;

  const points = [...vertices];
  if (cursorPos) {
    points.push(cursorPos);
  }

  if (points.length < 2) return;

  // Preview line
  L.polyline(points, {
    color: "#22c55e",
    weight: 3,
    dashArray: "6,6",
    opacity: 0.8,
    interactive: false,
  }).addTo(layers.drawPreview);

  // Vertex markers
  for (const pt of vertices) {
    L.circleMarker(pt, {
      radius: 5,
      color: "#fff",
      weight: 2,
      fillColor: "#22c55e",
      fillOpacity: 1,
      interactive: false,
    }).addTo(layers.drawPreview);
  }

  // Distance preview
  const geoCoords: [number, number][] = points.map(
    (p) => [p[1], p[0]] as [number, number]
  );
  const dist = polylineLengthMetres(geoCoords);
  const lastPt = points[points.length - 1]!;

  L.marker(lastPt, {
    icon: L.divIcon({
      html: `<div style="
        background:rgba(34,197,94,0.9);
        color:#fff;
        padding:2px 6px;
        border-radius:10px;
        font-size:11px;
        font-weight:600;
        white-space:nowrap;
        pointer-events:none;
      ">${formatAnnotationDistance(dist)}</div>`,
      iconSize: [0, 0],
      iconAnchor: [0, -12],
      className: "",
    }),
    interactive: false,
  }).addTo(layers.drawPreview);
}

/**
 * Clear the draw preview.
 */
export function clearLinePreview(layers: AnnotationLayerGroup): void {
  layers.drawPreview.clearLayers();
}

// ============================================================================
// SNAP-TO-POINT HELPERS
// ============================================================================

/** Pixel threshold for snapping to an existing point/anchor */
const SNAP_THRESHOLD_PX = 25;

export interface SnapResult {
  annotation: MapAnnotationRow;
  latLng: [number, number]; // [lat, lng] — snap position (could be on edge, not annotation center)
  distancePx: number;
}

/**
 * Project a point onto a line segment (A→B) and return the nearest point on that segment.
 * All inputs/output in [lat, lng].
 */
function nearestPointOnSegment(
  p: [number, number],
  a: [number, number],
  b: [number, number]
): [number, number] {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return a; // segment is a point
  let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return [a[0] + t * dx, a[1] + t * dy];
}

/**
 * Find the nearest point on any edge of a polygon.
 * @param p cursor [lat, lng]
 * @param corners polygon corners [[lat,lng], ...] — will be closed automatically
 * @returns nearest [lat, lng] on edge
 */
function nearestPointOnPolygonEdge(
  p: [number, number],
  corners: [number, number][]
): [number, number] {
  let bestPt: [number, number] = corners[0] ?? p;
  let bestDistSq = Infinity;

  for (let i = 0; i < corners.length; i++) {
    const a = corners[i]!;
    const b = corners[(i + 1) % corners.length]!;
    const proj = nearestPointOnSegment(p, a, b);
    const dx = proj[0] - p[0];
    const dy = proj[1] - p[1];
    const distSq = dx * dx + dy * dy;
    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      bestPt = proj;
    }
  }

  return bestPt;
}

/**
 * Find the nearest point/anchor annotation within a pixel threshold of a
 * screen position. Also checks building polygon edges if provided.
 * Returns null if no point is close enough.
 *
 * @param map - Leaflet map instance (for latlng ↔ pixel conversion)
 * @param cursorLatLng - cursor position [lat, lng]
 * @param annotations - all annotations
 * @param excludeId - optional ID to exclude (e.g. the start point of the line)
 * @param buildingCorners - optional building polygon corners [[lat,lng], ...] for edge snapping
 */
export function findNearestSnapPoint(
  map: L.Map,
  cursorLatLng: [number, number],
  annotations: MapAnnotationRow[],
  excludeId?: string,
  buildingCorners?: [number, number][]
): SnapResult | null {
  const cursorPx = map.latLngToContainerPoint(cursorLatLng);

  let best: SnapResult | null = null;

  for (const a of annotations) {
    if (a.type !== "point" && a.type !== "anchor") continue;
    if (excludeId && a.id === excludeId) continue;
    // Skip building anchor center — we handle it via edge snap below
    if (a.type === "anchor" && a.subtype === "batiment" && buildingCorners && buildingCorners.length >= 3) continue;

    const geom = a.geometry as GeoJSONPoint;
    if (geom.type !== "Point") continue;

    const ptLatLng: [number, number] = [geom.coordinates[1], geom.coordinates[0]];
    const ptPx = map.latLngToContainerPoint(ptLatLng);
    const dx = cursorPx.x - ptPx.x;
    const dy = cursorPx.y - ptPx.y;
    const distancePx = Math.sqrt(dx * dx + dy * dy);

    if (distancePx <= SNAP_THRESHOLD_PX) {
      if (!best || distancePx < best.distancePx) {
        best = { annotation: a, latLng: ptLatLng, distancePx };
      }
    }
  }

  // Check building polygon edges — snap to nearest edge point
  if (buildingCorners && buildingCorners.length >= 3) {
    const buildingAnchor = annotations.find(
      (a) => a.type === "anchor" && a.subtype === "batiment"
    );
    if (buildingAnchor && !(excludeId && buildingAnchor.id === excludeId)) {
      const edgePt = nearestPointOnPolygonEdge(cursorLatLng, buildingCorners);
      const edgePx = map.latLngToContainerPoint(edgePt);
      const dx = cursorPx.x - edgePx.x;
      const dy = cursorPx.y - edgePx.y;
      const distancePx = Math.sqrt(dx * dx + dy * dy);

      // Use a slightly larger threshold for building edges (easier to hit)
      const BUILDING_EDGE_THRESHOLD_PX = 30;
      if (distancePx <= BUILDING_EDGE_THRESHOLD_PX) {
        if (!best || distancePx < best.distancePx) {
          // Return the anchor annotation but with the EDGE position
          best = { annotation: buildingAnchor, latLng: edgePt, distancePx };
        }
      }
    }
  }

  return best;
}

/**
 * Draw a snap indicator (green pulsing halo) around a point to show the user
 * they can connect to it.
 */
export function drawSnapIndicator(
  layers: AnnotationLayerGroup,
  latLng: [number, number] | null
): void {
  // We re-use drawPreview — the indicator is drawn ON TOP of the line preview.
  // The caller must call drawLinePreview BEFORE drawSnapIndicator.
  if (!latLng) return;

  L.circleMarker(latLng, {
    radius: 18,
    color: "#22c55e",
    weight: 3,
    fillColor: "#22c55e",
    fillOpacity: 0.15,
    interactive: false,
    className: "snap-indicator",
  }).addTo(layers.drawPreview);

  // Inner dot
  L.circleMarker(latLng, {
    radius: 6,
    color: "#fff",
    weight: 2,
    fillColor: "#22c55e",
    fillOpacity: 1,
    interactive: false,
  }).addTo(layers.drawPreview);
}

// ============================================================================
// HELPERS
// ============================================================================

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
