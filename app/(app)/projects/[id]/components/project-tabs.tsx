"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Project } from "@/lib/types/project";
import type { BuildingConfig, BuildingConfigRow } from "@/lib/types/building";
import { ConfigTabContent } from "./config-tab-content";
import { MapTabContent } from "./map-tab-content";
import { ResultsTabContent } from "./results-tab-content";
import { SyntheseTabContent } from "./synthese-tab-content";
import { getBuildingConfig } from "@/lib/actions/building-configs";

interface ProjectTabsProps {
  projectId: string;
  activeTab: string;
  project: Project;
}

const tabs = [
  { id: "config", label: "Configuration", icon: "⚙️" },
  { id: "carte", label: "Carte", icon: "🗺️" },
  { id: "resultats", label: "Résultats", icon: "📊" },
  { id: "synthese", label: "Synthèse", icon: "📋" },
  { id: "envois", label: "Envois", icon: "📤" },
];

export function ProjectTabs({ projectId, activeTab, project }: ProjectTabsProps) {
  return (
    <div>
      {/* Navigation des onglets */}
      <div className="border-b border-gray-200 bg-white">
        <nav className="flex space-x-8 px-8" aria-label="Tabs">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <Link
                key={tab.id}
                href={`/projects/${projectId}?tab=${tab.id}`}
                className={`border-b-2 px-1 py-4 text-sm font-medium ${
                  isActive
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Contenu de l'onglet */}
      <div className="p-8">
        <TabContent tab={activeTab} project={project} />
      </div>
    </div>
  );
}

function TabContent({ tab, project }: { tab: string; project: Project }) {
  switch (tab) {
    case "config":
      return <ConfigTab project={project} />;
    case "carte":
      return <CarteTab project={project} />;
    case "resultats":
      return <ResultatsTab project={project} />;
    case "synthese":
      return <SyntheseTab project={project} />;
    case "envois":
      return <EnvoisTab project={project} />;
    default:
      return <ConfigTab project={project} />;
  }
}

function ConfigTab({ project }: { project: Project }) {
  return <ConfigTabContent project={project} />;
}

function CarteTab({ project }: { project: Project }) {
  const [configRow, setConfigRow] = useState<BuildingConfigRow | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    async function loadConfig() {
      const result = await getBuildingConfig(project.id);
      if (result.success && result.data) {
        setConfigRow(result.data);
      }
      setLoading(false);
    }
    loadConfig();
  }, [project.id]);
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-[500px]">
        <div className="text-gray-500">Chargement...</div>
      </div>
    );
  }
  
  if (!configRow) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          Carte d&apos;implantation
        </h2>
        <p className="text-sm text-gray-500">
          Configurez d&apos;abord le bâtiment dans l&apos;onglet Configuration.
        </p>
      </div>
    );
  }
  
  const config: BuildingConfig = {
    params: configRow.params,
    derived: configRow.derived,
  };
  
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <MapTabContent 
        projectId={project.id} 
        config={config} 
        configRow={configRow} 
      />
    </div>
  );
}

function ResultatsTab({ project }: { project: Project }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <ResultsTabContent project={project} />
    </div>
  );
}

function SyntheseTab({ project }: { project: Project }) {
  return <SyntheseTabContent project={project} />;
}

function EnvoisTab({ project: _project }: { project: Project }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <h2 className="mb-4 text-lg font-semibold text-gray-900">
        Historique des envois
      </h2>
      <p className="text-sm text-gray-500">
        Soumissions et décisions du projet.
      </p>
      
      {/* Placeholder pour l'historique */}
      <div className="mt-6 rounded-lg border-2 border-dashed border-gray-300 p-8 text-center">
        <p className="text-sm text-gray-500">
          Aucun envoi pour le moment
        </p>
      </div>
    </div>
  );
}
