/**
 * Hook React pour gérer les annotations cartographiques.
 * Charge, crée, met à jour, supprime, et maintient l'état local.
 */

"use client";

import { useState, useCallback, useRef } from "react";
import type {
  MapAnnotationRow,
  PointSubtype,
  AnnotationToolMode,
} from "@/lib/types/annotations";
import {
  getAnnotations,
  createPointAnnotation,
  createLineAnnotation,
  upsertBuildingAnchor,
  updatePointPosition,
  updateLineGeometry,
  updateAnnotationMetadata,
  deleteAnnotation,
  updateLinkedLines,
} from "@/lib/actions/annotations";

interface UseAnnotationsReturn {
  /** All annotations for this project */
  annotations: MapAnnotationRow[];
  /** The building anchor annotation (if any) */
  buildingAnchor: MapAnnotationRow | null;
  /** Current tool mode */
  toolMode: AnnotationToolMode;
  /** Loading state */
  loading: boolean;
  /** Error message */
  error: string | null;

  /** Load all annotations from DB */
  load: () => Promise<void>;
  /** Set tool mode */
  setToolMode: (mode: AnnotationToolMode) => void;

  /** Add a point annotation */
  addPoint: (subtype: PointSubtype, lat: number, lng: number) => Promise<MapAnnotationRow | null>;
  /** Add a line annotation */
  addLine: (
    coords: [number, number][],
    startId: string | null,
    endId: string | null
  ) => Promise<MapAnnotationRow | null>;
  /** Create/update building anchor */
  syncBuildingAnchor: (lat: number, lng: number) => Promise<void>;

  /** Move a point and update linked lines */
  movePoint: (id: string, lat: number, lng: number) => Promise<void>;
  /** Update line geometry */
  updateLine: (id: string, coords: [number, number][]) => Promise<void>;
  /** Update metadata (note) */
  updateMeta: (id: string, metadata: Record<string, unknown>) => Promise<void>;
  /** Delete an annotation */
  remove: (id: string) => Promise<void>;

  /** Find annotation by ID */
  findById: (id: string) => MapAnnotationRow | undefined;
}

export function useAnnotations(projectId: string): UseAnnotationsReturn {
  const [annotations, setAnnotations] = useState<MapAnnotationRow[]>([]);
  const [toolMode, setToolMode] = useState<AnnotationToolMode>({ type: "idle" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadedRef = useRef(false);

  const buildingAnchor =
    annotations.find((a) => a.type === "anchor" && a.subtype === "batiment") ?? null;

  // ---- Load ----
  const load = useCallback(async () => {
    if (loadedRef.current) return; // Only load once
    setLoading(true);
    setError(null);
    const result = await getAnnotations(projectId);
    if (result.success) {
      setAnnotations(result.data);
      loadedRef.current = true;
    } else {
      setError(result.error);
    }
    setLoading(false);
  }, [projectId]);

  // ---- Add point ----
  const addPoint = useCallback(
    async (subtype: PointSubtype, lat: number, lng: number) => {
      const result = await createPointAnnotation({
        projectId,
        subtype,
        lat,
        lng,
      });
      if (result.success) {
        setAnnotations((prev) => [...prev, result.data]);
        return result.data;
      }
      setError(result.error);
      return null;
    },
    [projectId]
  );

  // ---- Add line ----
  const addLine = useCallback(
    async (
      coords: [number, number][],
      startId: string | null,
      endId: string | null
    ) => {
      const result = await createLineAnnotation({
        projectId,
        coordinates: coords,
        linkedStartId: startId,
        linkedEndId: endId,
      });
      if (result.success) {
        setAnnotations((prev) => [...prev, result.data]);
        return result.data;
      }
      console.error("[addLine] Erreur:", result.error);
      setError(result.error);
      return null;
    },
    [projectId]
  );

  // ---- Sync building anchor ----
  const syncBuildingAnchor = useCallback(
    async (lat: number, lng: number) => {
      const result = await upsertBuildingAnchor({ projectId, lat, lng });
      if (result.success) {
        setAnnotations((prev) => {
          const filtered = prev.filter(
            (a) => !(a.type === "anchor" && a.subtype === "batiment")
          );
          return [...filtered, result.data];
        });
      }
    },
    [projectId]
  );

  // ---- Move point ----
  const movePoint = useCallback(
    async (id: string, lat: number, lng: number) => {
      const result = await updatePointPosition({ id, lat, lng });
      if (result.success) {
        setAnnotations((prev) =>
          prev.map((a) => (a.id === id ? result.data : a))
        );

        // Update linked lines
        const linkedResult = await updateLinkedLines(id, lng, lat);
        if (linkedResult.success && linkedResult.data.length > 0) {
          setAnnotations((prev) => {
            const updated = new Map(linkedResult.data.map((l) => [l.id, l]));
            return prev.map((a) => updated.get(a.id) ?? a);
          });
        }
      } else {
        setError(result.error);
      }
    },
    []
  );

  // ---- Update line geometry ----
  const updateLine = useCallback(
    async (id: string, coords: [number, number][]) => {
      const result = await updateLineGeometry({ id, coordinates: coords });
      if (result.success) {
        setAnnotations((prev) =>
          prev.map((a) => (a.id === id ? result.data : a))
        );
      } else {
        setError(result.error);
      }
    },
    []
  );

  // ---- Update metadata ----
  const updateMeta = useCallback(
    async (id: string, metadata: Record<string, unknown>) => {
      const result = await updateAnnotationMetadata({ id, metadata });
      if (result.success) {
        setAnnotations((prev) =>
          prev.map((a) => (a.id === id ? result.data : a))
        );
      } else {
        setError(result.error);
      }
    },
    []
  );

  // ---- Delete ----
  const remove = useCallback(async (id: string) => {
    const result = await deleteAnnotation(id);
    if (result.success) {
      setAnnotations((prev) => prev.filter((a) => a.id !== id));
    } else {
      setError(result.error);
    }
  }, []);

  // ---- Find by ID ----
  const findById = useCallback(
    (id: string) => annotations.find((a) => a.id === id),
    [annotations]
  );

  return {
    annotations,
    buildingAnchor,
    toolMode,
    loading,
    error,
    load,
    setToolMode,
    addPoint,
    addLine,
    syncBuildingAnchor,
    movePoint,
    updateLine,
    updateMeta,
    remove,
    findById,
  };
}
