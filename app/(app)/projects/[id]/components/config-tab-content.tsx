"use client";

import { useState, useEffect } from "react";
import type { Project } from "@/lib/types/project";
import type { Ruleset } from "@/lib/validators/ruleset";
import type { BuildingParams, BuildingDerived, BuildingConfigRow } from "@/lib/types/building";
import { getActiveRuleset } from "@/lib/actions/rulesets";
import { saveBuildingConfig, getBuildingConfig } from "@/lib/actions/building-configs";
import { BuildingConfigFormAdvanced, type SaveRef } from "./building-config-form-advanced";

interface ConfigTabContentProps {
  project: Project;
  /** Ref pour que le wizard puisse déclencher le save */
  saveRef?: SaveRef;
}

export function ConfigTabContent({ project, saveRef }: ConfigTabContentProps) {
  const [ruleset, setRuleset] = useState<Ruleset | null>(null);
  const [existingConfig, setExistingConfig] = useState<BuildingConfigRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      // Charger le ruleset ET la config existante en parallèle
      const [rulesetResult, configResult] = await Promise.all([
        getActiveRuleset(),
        getBuildingConfig(project.id),
      ]);
      
      if (rulesetResult.success) {
        setRuleset(rulesetResult.data);
      } else {
        setError(rulesetResult.error);
      }
      
      if (configResult.success && configResult.data) {
        setExistingConfig(configResult.data);
      }
      
      setLoading(false);
    }
    loadData();
  }, [project.id]);

  const handleSave = async (params: BuildingParams, derived: BuildingDerived) => {
    const result = await saveBuildingConfig(project.id, params, derived);
    if (!result.success) {
      throw new Error(result.error);
    }
  };

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex items-center justify-center py-8">
          <div className="text-gray-500">Chargement du ruleset...</div>
        </div>
      </div>
    );
  }

  if (error || !ruleset) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-800">
            {error ?? "Aucun ruleset actif trouvé"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <BuildingConfigFormAdvanced
        key={existingConfig?.id ?? "new"}
        project={project}
        rulesetVersion={ruleset.version}
        initialParams={existingConfig?.params}
        onSave={handleSave}
        saveRef={saveRef}
      />
    </div>
  );
}
