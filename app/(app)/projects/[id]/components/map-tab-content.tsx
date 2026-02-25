"use client";

import dynamic from "next/dynamic";
import type { BuildingConfig, BuildingConfigRow } from "@/lib/types/building";
import type { SaveRef } from "./building-config-form-advanced";

const MapView = dynamic(() => import("./map-view"), { 
  ssr: false,
  loading: () => <div className="h-[800px] bg-gray-100 flex items-center justify-center">Chargement...</div>
});

interface Props {
  projectId: string;
  config: BuildingConfig;
  configRow: BuildingConfigRow | null;
  /** Ref pour que le wizard puisse déclencher le save */
  saveRef?: SaveRef;
}

export function MapTabContent({ projectId, config, configRow, saveRef }: Props) {
  const length = config.derived?.length ?? config.params.nbSpans * config.params.spacing;
  const totalWidth = config.derived?.totalWidth ?? config.params.width;

  return (
    <div className="h-[800px]">
      <MapView
        projectId={projectId}
        buildingConfig={configRow}
        length={length}
        totalWidth={totalWidth}
        saveRef={saveRef}
      />
    </div>
  );
}
