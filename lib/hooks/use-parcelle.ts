/**
 * Hook React pour charger et gérer les données parcellaires.
 * Appelle /api/parcelle puis expose les résultats pour l'UI et la carte.
 */

"use client";

import { useState, useCallback, useRef } from "react";
import type { ParcelleInfo } from "@/lib/types/parcelle";

interface UseParcelleState {
  /** Données parcellaires combinées */
  info: ParcelleInfo | null;
  /** En cours de chargement */
  loading: boolean;
  /** Message d'erreur */
  error: string | null;
  /** Timestamp du dernier chargement */
  timestamp: string | null;
}

interface UseParcelleReturn extends UseParcelleState {
  /** Charger les données parcellaires pour un point, avec coins du bâtiment optionnels */
  loadParcelle: (lat: number, lng: number, corners?: [number, number][]) => Promise<void>;
}

export function useParcelle(): UseParcelleReturn {
  const [state, setState] = useState<UseParcelleState>({
    info: null,
    loading: false,
    error: null,
    timestamp: null,
  });

  // Eviter les appels concurrents
  const abortRef = useRef<AbortController | null>(null);

  const loadParcelle = useCallback(async (lat: number, lng: number, corners?: [number, number][]) => {
    // Annuler un éventuel appel en cours
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      let url = `/api/parcelle?lat=${lat}&lng=${lng}`;
      if (corners && corners.length > 0) {
        url += `&corners=${encodeURIComponent(JSON.stringify(corners))}`;
      }

      const res = await fetch(url, { signal: controller.signal });

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `Erreur ${res.status}`);
      }

      const json = await res.json() as { data: ParcelleInfo; timestamp: string };

      if (!controller.signal.aborted) {
        setState({
          info: json.data,
          loading: false,
          error: null,
          timestamp: json.timestamp,
        });
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      if (!controller.signal.aborted) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: err instanceof Error ? err.message : "Erreur inconnue",
        }));
      }
    }
  }, []);

  return {
    ...state,
    loadParcelle,
  };
}
