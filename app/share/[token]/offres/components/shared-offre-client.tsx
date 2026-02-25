"use client";

/**
 * SharedOffreClient — Rendu public de l'offre Agri (sans navigation app)
 *
 * Même template que la page authentifiée, mais :
 *   - Pas de barre de nav app
 *   - Pas de sélecteur de template
 *   - Juste le rendu du template Agri
 */

import { useMemo } from "react";
import type { FinanceSnapshot } from "@/lib/types/finance";
import type { BuildingConfig } from "@/lib/types/building";
import { mapSnapshotToOffreAgri } from "@/lib/geometry/offre-agri-mapper";
import { OffreAgriTemplate } from "@/app/(app)/projects/[id]/offres/components/offre-agri-template";

interface SharedOffreClientProps {
  projectName: string;
  snapshot: FinanceSnapshot | null;
  buildingConfig: BuildingConfig | null;
}

export function SharedOffreClient({
  projectName,
  snapshot,
  buildingConfig,
}: SharedOffreClientProps) {
  const agriData = useMemo(() => {
    if (!snapshot) return null;
    return mapSnapshotToOffreAgri(snapshot);
  }, [snapshot]);

  if (!snapshot || !agriData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center max-w-md">
          <div className="text-4xl mb-4">📋</div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            Offre non disponible
          </h2>
          <p className="text-sm text-gray-500">
            L&apos;étude financière de ce projet n&apos;est pas encore finalisée.
          </p>
        </div>
      </div>
    );
  }

  return (
    <OffreAgriTemplate
      data={agriData}
      projectName={projectName}
      buildingConfig={buildingConfig}
    />
  );
}
