/**
 * Hook réactif pour l'analyse PLU.
 * Combine les données parcellaires, les hauteurs du bâtiment et la géométrie
 * pour recalculer automatiquement la conformité PLU.
 *
 * Recalcule dynamiquement si :
 * - Le bâtiment est déplacé (corners changent)
 * - Les hauteurs changent
 * - Les données parcellaires changent
 */

"use client";

import { useMemo } from "react";
import type { ParcelleInfo } from "@/lib/types/parcelle";
import type { PluAnalysis } from "@/lib/types/plu";
import { runPluAnalysis } from "@/lib/geometry/plu-checks";

interface UsePluAnalysisParams {
  /** Données parcellaires (cadastre, zone urba, etc.) */
  parcelleInfo: ParcelleInfo | null;
  /** Hauteur sablière du bâtiment en mètres */
  heightSabliereM: number;
  /** Hauteur faîtage du bâtiment en mètres */
  heightFaitageM: number;
  /** Les 4 coins exacts du bâtiment [lat, lng] — mis à jour en temps réel */
  buildingCorners: [number, number][];
  /** IDUs des parcelles possédées par le client (principale toujours possédée) */
  ownedParcelleIdus?: Set<string>;
  /** Géométries de parcelles voisines ajoutées manuellement comme possédées */
  manualOwnedGeometries?: GeoJSON.MultiPolygon[];
}

/**
 * Hook qui recalcule l'analyse PLU à chaque changement de paramètres.
 * Retourne null pendant le chargement ou si aucune donnée n'est disponible.
 */
export function usePluAnalysis({
  parcelleInfo,
  heightSabliereM,
  heightFaitageM,
  buildingCorners,
  ownedParcelleIdus,
  manualOwnedGeometries,
}: UsePluAnalysisParams): PluAnalysis | null {
  return useMemo(() => {
    // Pas de données du tout → pas d'analyse
    if (!parcelleInfo && buildingCorners.length < 3) return null;

    // Préparer les parcelles secondaires pour la détection de conflit de zones
    const parcellesSecondaires = (parcelleInfo?.parcellesSecondaires ?? []).map((p) => ({
      zoneUrba: p.zoneUrba,
      parcelle: `${p.cadastre.section}-${p.cadastre.numero} (${p.cadastre.nom_com})`,
    }));

    // Collecter les géométries des parcelles secondaires possédées par le client
    const ownedAdjacentGeometries: GeoJSON.MultiPolygon[] = [];
    if (ownedParcelleIdus && ownedParcelleIdus.size > 0) {
      for (const sec of parcelleInfo?.parcellesSecondaires ?? []) {
        if (ownedParcelleIdus.has(sec.cadastre.idu)) {
          ownedAdjacentGeometries.push(sec.geometry);
        }
      }
    }
    // Ajouter les parcelles voisines ajoutées manuellement
    if (manualOwnedGeometries) {
      ownedAdjacentGeometries.push(...manualOwnedGeometries);
    }

    return runPluAnalysis(
      parcelleInfo?.zoneUrba ?? null,
      heightSabliereM,
      heightFaitageM,
      buildingCorners,
      parcelleInfo?.cadastreGeometry ?? null,
      parcellesSecondaires,
      ownedAdjacentGeometries,
    );
  }, [
    parcelleInfo?.zoneUrba,
    parcelleInfo?.cadastreGeometry,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    JSON.stringify(parcelleInfo?.parcellesSecondaires),
    heightSabliereM,
    heightFaitageM,
    // On sérialise les corners pour que useMemo détecte les changements
    // eslint-disable-next-line react-hooks/exhaustive-deps
    JSON.stringify(buildingCorners),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    ownedParcelleIdus ? [...ownedParcelleIdus].sort().join(",") : "",
    // eslint-disable-next-line react-hooks/exhaustive-deps
    manualOwnedGeometries?.length ?? 0,
  ]);
}
