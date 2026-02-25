"use client";

/**
 * OffresPageClient — Sélecteur de template d'offre + rendu
 *
 * Templates disponibles :
 *   - 🌾 Agri / Particulier (offre-agri-template)
 *   - 🏗️ Développeur (à venir)
 *
 * Les données du snapshot sont mappées vers le format du template choisi.
 */

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import type { Project } from "@/lib/types/project";
import type { FinanceSnapshot } from "@/lib/types/finance";
import type { BuildingConfig } from "@/lib/types/building";
import { mapSnapshotToOffreAgri } from "@/lib/geometry/offre-agri-mapper";
import { generateShareToken } from "@/lib/actions/share";
import { OffreAgriTemplate } from "./offre-agri-template";

// ============================================================================
// TYPES
// ============================================================================

type TemplateId = "agri" | "developpeur";

interface TemplateOption {
  id: TemplateId;
  label: string;
  emoji: string;
  description: string;
  available: boolean;
}

const TEMPLATES: TemplateOption[] = [
  {
    id: "agri",
    label: "Agri / Particulier",
    emoji: "🌾",
    description: "Offre pour agriculteur ou particulier investisseur — KPIs, trésorerie, 3 offres.",
    available: true,
  },
  {
    id: "developpeur",
    label: "Développeur",
    emoji: "🏗️",
    description: "Offre pour développeur / tiers-investisseur — à venir.",
    available: false,
  },
];

// ============================================================================
// PROPS
// ============================================================================

interface OffresPageClientProps {
  project: Project;
  snapshot: FinanceSnapshot | null;
  buildingConfig: BuildingConfig | null;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function OffresPageClient({ project, snapshot, buildingConfig }: OffresPageClientProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateId>("agri");
  const [shareState, setShareState] = useState<"idle" | "loading" | "copied">("idle");

  // Mapper les données du snapshot vers le format du template Agri
  const agriData = useMemo(() => {
    if (!snapshot) return null;
    return mapSnapshotToOffreAgri(snapshot);
  }, [snapshot]);

  // Générer le lien de partage et copier dans le presse-papier
  const handleShare = useCallback(async () => {
    setShareState("loading");
    const result = await generateShareToken(project.id);
    if (result.success) {
      const url = `${window.location.origin}/share/${result.data}/offres`;
      await navigator.clipboard.writeText(url);
      setShareState("copied");
      setTimeout(() => setShareState("idle"), 2500);
    } else {
      setShareState("idle");
    }
  }, [project.id]);

  // ── Pas de snapshot → message d'erreur ──
  if (!snapshot) {
    return (
      <div className="max-w-3xl mx-auto p-8">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-8 text-center">
          <div className="text-4xl mb-4">💰</div>
          <h2 className="text-lg font-semibold text-amber-800 mb-2">Étude financière requise</h2>
          <p className="text-sm text-amber-700 mb-4">
            Validez d&apos;abord l&apos;étape Finance dans le wizard pour pouvoir générer les offres.
          </p>
          <Link
            href={`/projects/${project.id}?step=finance`}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
          >
            ← Retour au projet
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* ── Barre de navigation / sélection template ── */}
      <div className="sticky top-0 z-10 bg-white border-b shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href={`/projects/${project.id}?step=synthese`}
              className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
            >
              ← Retour synthèse
            </Link>
            <span className="text-gray-300">|</span>
            <h1 className="text-sm font-semibold text-gray-900">{project.name}</h1>
          </div>

          {/* Template selector + share button */}
          <div className="flex items-center gap-3">
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                onClick={() => t.available && setSelectedTemplate(t.id)}
                disabled={!t.available}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  selectedTemplate === t.id
                    ? "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300"
                    : t.available
                      ? "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      : "bg-gray-50 text-gray-400 cursor-not-allowed"
                }`}
                title={t.description}
              >
                <span>{t.emoji}</span>
                <span>{t.label}</span>
                {!t.available && <span className="text-[10px] ml-1 opacity-60">(bientôt)</span>}
              </button>
            ))}

            {/* Bouton partage */}
            <button
              onClick={handleShare}
              disabled={shareState === "loading"}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
            >
              {shareState === "copied" ? "✅ Lien copié !" : shareState === "loading" ? "⏳" : "🔗 Partager"}
            </button>
          </div>
        </div>
      </div>

      {/* ── Contenu du template ── */}
      {selectedTemplate === "agri" && agriData && (
        <OffreAgriTemplate data={agriData} projectName={project.name} buildingConfig={buildingConfig} />
      )}

      {selectedTemplate === "developpeur" && (
        <div className="max-w-3xl mx-auto p-8">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
            <div className="text-4xl mb-4">🏗️</div>
            <h2 className="text-lg font-semibold text-gray-700 mb-2">Template Développeur</h2>
            <p className="text-sm text-gray-500">Ce template sera disponible prochainement.</p>
          </div>
        </div>
      )}
    </div>
  );
}
