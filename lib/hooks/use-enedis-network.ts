/**
 * Hook React pour charger et gérer les données réseau Enedis.
 * Gère le fetch, les erreurs, et le calcul des distances.
 */

"use client";

import { useState, useCallback, useRef } from "react";
import type {
  EnedisPoste,
  EnedisLigne,
  EnedisLayerVisibility,
  EnedisContext,
  EnedisNearestPoste,
} from "@/lib/types/enedis";
import {
  DEFAULT_ENEDIS_VISIBILITY,
  DEFAULT_ENEDIS_RADIUS,
} from "@/lib/types/enedis";
import { haversineDistance } from "@/lib/geometry/enedis-utils";

interface EnedisNetworkState {
  /** Données chargées */
  postes: EnedisPoste[];
  lignesBt: EnedisLigne[];
  lignesHta: EnedisLigne[];
  /** Visibilité des couches */
  visibility: EnedisLayerVisibility;
  /** Rayon utilisé pour la dernière requête */
  radius: number;
  /** En cours de chargement */
  loading: boolean;
  /** Message d'erreur */
  error: string | null;
  /** Poste le plus proche (avec distance) */
  nearestPoste: EnedisNearestPoste | null;
  /** Timestamp du dernier chargement */
  timestamp: string | null;
  /** Avertissements (datasets partiellement indisponibles) */
  warnings: string[];
}

interface UseEnedisNetworkReturn extends EnedisNetworkState {
  /** Charger les données réseau autour d'un point */
  loadNetwork: (lat: number, lon: number, radius?: number) => Promise<void>;
  /** Modifier la visibilité d'une couche */
  toggleLayer: (layer: keyof EnedisLayerVisibility) => void;
  /** Définir la visibilité complète */
  setVisibility: (v: EnedisLayerVisibility) => void;
  /** Contexte Enedis résumé (pour stockage) */
  getContext: () => EnedisContext | null;
  /** Réinitialiser l'état */
  reset: () => void;
}

export function useEnedisNetwork(): UseEnedisNetworkReturn {
  const [state, setState] = useState<EnedisNetworkState>({
    postes: [],
    lignesBt: [],
    lignesHta: [],
    visibility: { ...DEFAULT_ENEDIS_VISIBILITY },
    radius: DEFAULT_ENEDIS_RADIUS,
    loading: false,
    error: null,
    nearestPoste: null,
    timestamp: null,
    warnings: [],
  });

  // Ref pour éviter les appels concurrents
  const abortRef = useRef<AbortController | null>(null);

  /**
   * Charge le réseau Enedis autour du point spécifié.
   */
  const loadNetwork = useCallback(async (lat: number, lon: number, radius?: number) => {
    // Annuler la requête précédente si en cours
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    const r = radius ?? DEFAULT_ENEDIS_RADIUS;

    setState(prev => ({ ...prev, loading: true, error: null, warnings: [] }));

    try {
      const params = new URLSearchParams({
        lat: String(lat),
        lon: String(lon),
        radius: String(r),
      });

      const response = await fetch(`/api/enedis/network?${params}`, {
        signal: controller.signal,
      });

      const json = await response.json();

      if (!response.ok || !json.success) {
        setState(prev => ({
          ...prev,
          loading: false,
          error: json.error || "Erreur lors du chargement des données réseau Enedis",
          postes: [],
          lignesBt: [],
          lignesHta: [],
          nearestPoste: null,
          timestamp: null,
        }));
        return;
      }

      const { postes, lignesBt, lignesHta, timestamp } = json.data;

      // Calculer la distance de chaque poste au centroïde
      const postesWithDistance: EnedisPoste[] = (postes as EnedisPoste[]).map(p => ({
        ...p,
        distanceM: haversineDistance(lat, lon, p.coordinates[1], p.coordinates[0]),
      }));

      // Trier par distance et identifier le plus proche
      postesWithDistance.sort((a, b) => (a.distanceM ?? Infinity) - (b.distanceM ?? Infinity));
      const closestPoste = postesWithDistance[0];
      const nearest: EnedisNearestPoste | null = closestPoste
        ? {
            id: closestPoste.id,
            name: closestPoste.name,
            subtype: closestPoste.subtype,
            coordinates: closestPoste.coordinates,
            distanceM: closestPoste.distanceM ?? 0,
          }
        : null;

      setState(prev => ({
        ...prev,
        loading: false,
        error: null,
        postes: postesWithDistance,
        lignesBt: lignesBt as EnedisLigne[],
        lignesHta: lignesHta as EnedisLigne[],
        nearestPoste: nearest,
        radius: r,
        timestamp,
        warnings: json.data.warnings ?? [],
      }));
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setState(prev => ({
        ...prev,
        loading: false,
        error: "Impossible de contacter le serveur. Vérifiez votre connexion.",
      }));
    }
  }, []);

  const toggleLayer = useCallback((layer: keyof EnedisLayerVisibility) => {
    setState(prev => ({
      ...prev,
      visibility: { ...prev.visibility, [layer]: !prev.visibility[layer] },
    }));
  }, []);

  const setVisibility = useCallback((v: EnedisLayerVisibility) => {
    setState(prev => ({ ...prev, visibility: v }));
  }, []);

  const getContext = useCallback((): EnedisContext | null => {
    if (!state.timestamp) return null;
    return {
      nearestPoste: state.nearestPoste,
      distanceM: state.nearestPoste?.distanceM ?? null,
      summary: {
        postesCount: state.postes.length,
        lignesBtCount: state.lignesBt.length,
        lignesHtaCount: state.lignesHta.length,
        radiusM: state.radius,
      },
      timestamp: state.timestamp,
    };
  }, [state]);

  const reset = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    setState({
      postes: [],
      lignesBt: [],
      lignesHta: [],
      visibility: { ...DEFAULT_ENEDIS_VISIBILITY },
      radius: DEFAULT_ENEDIS_RADIUS,
      loading: false,
      error: null,
      nearestPoste: null,
      timestamp: null,
      warnings: [],
    });
  }, []);

  return {
    ...state,
    loadNetwork,
    toggleLayer,
    setVisibility,
    getContext,
    reset,
  };
}
