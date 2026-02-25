"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  BUILDING_TYPE_LABELS,
} from "@/lib/types/building";
import type { BuildingType } from "@/lib/types/building";
import {
  getPricingGrid,
  updatePricingEntry,
  resetPricingToDefault,
  type PricingSeriesData,
} from "@/lib/actions/pricing";

// Types de bâtiment qui ont des données de prix
const PRICED_TYPES: { type: BuildingType; label: string }[] = [
  { type: "SYM", label: "Symétrique" },
  { type: "ASYM1", label: "Asymétrique 1 zone" },
  { type: "ASYM2", label: "Asymétrique 2 zones" },
];

export default function PricingAdminPage() {
  const [allSeries, setAllSeries] = useState<PricingSeriesData[]>([]);
  const [selectedType, setSelectedType] = useState<BuildingType>("SYM");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [editCell, setEditCell] = useState<{ seriesIdx: number; entryIdx: number } | null>(null);
  const [editValue, setEditValue] = useState("");

  const loadPricing = useCallback(async () => {
    try {
      const data = await getPricingGrid();
      setAllSeries(data);
    } catch (e) {
      console.error("Erreur chargement pricing:", e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPricing();
  }, [loadPricing]);

  // Séries filtrées par type sélectionné
  const filteredSeries = allSeries.filter((s) => s.type === selectedType);

  const handleStartEdit = (seriesIdx: number, entryIdx: number, currentTarif: number) => {
    setEditCell({ seriesIdx, entryIdx });
    setEditValue(currentTarif.toString());
  };

  const handleCancelEdit = () => {
    setEditCell(null);
    setEditValue("");
  };

  const handleSaveEdit = async () => {
    if (!editCell) return;

    const series = filteredSeries[editCell.seriesIdx];
    if (!series) return;
    const entry = series.entries[editCell.entryIdx];
    if (!entry || !entry.id) return;

    const newTarif = parseInt(editValue, 10);
    if (isNaN(newTarif) || newTarif < 0) {
      setSaveMessage("❌ Tarif invalide");
      setTimeout(() => setSaveMessage(null), 3000);
      return;
    }

    setIsSaving(true);
    const result = await updatePricingEntry(entry.id, newTarif);
    if (result.success) {
      // Mettre à jour localement
      setAllSeries((prev) => {
        const next = [...prev];
        const globalIdx = next.findIndex(
          (s) => s.type === series.type && s.width === series.width,
        );
        if (globalIdx >= 0) {
          const current = next[globalIdx];
          if (current) {
            next[globalIdx] = {
              ...current,
              entries: current.entries.map((e, i) =>
                i === editCell.entryIdx ? { ...e, tarif: newTarif } : e,
              ),
            };
          }
        }
        return next;
      });
      setSaveMessage("✓ Tarif mis à jour");
      setEditCell(null);
    } else {
      setSaveMessage(`❌ ${result.error}`);
    }
    setIsSaving(false);
    setTimeout(() => setSaveMessage(null), 3000);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSaveEdit();
    if (e.key === "Escape") handleCancelEdit();
  };

  const handleReset = async () => {
    if (!confirm("Réinitialiser TOUS les tarifs aux valeurs Nelson par défaut ?")) return;
    setIsSaving(true);
    const result = await resetPricingToDefault();
    if (result.success) {
      setSaveMessage("✓ Tarifs réinitialisés !");
      await loadPricing();
    } else {
      setSaveMessage(`❌ ${result.error}`);
    }
    setIsSaving(false);
    setTimeout(() => setSaveMessage(null), 3000);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Chargement des tarifs...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl p-6">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <Link
            href="/admin/variants"
            className="text-sm text-blue-600 hover:underline"
          >
            ← Configuration des variantes
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">
            Grille tarifaire bâtiments
          </h1>
          <p className="text-gray-600">
            Tarifs charpente + couverture + fondations par type, largeur et nombre de travées
          </p>
          {saveMessage && (
            <p className={`mt-2 text-sm font-medium ${saveMessage.includes("✓") ? "text-green-600" : "text-red-600"}`}>
              {saveMessage}
            </p>
          )}
        </div>
        <button
          onClick={handleReset}
          disabled={isSaving}
          className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300 disabled:opacity-50"
        >
          Réinitialiser par défaut
        </button>
      </div>

      {/* Sélecteur de type */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Type de bâtiment
        </label>
        <div className="flex flex-wrap gap-2">
          {PRICED_TYPES.map(({ type, label }) => (
            <button
              key={type}
              onClick={() => {
                setSelectedType(type);
                setEditCell(null);
              }}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                selectedType === type
                  ? "bg-amber-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Info */}
      <div className="mb-6 rounded-lg bg-amber-50 border border-amber-200 p-4">
        <p className="text-sm text-amber-800">
          💰 Source : grille Nelson Énergies 2025 — Répartition dans le modèle finance : <strong>50% charpente</strong>, <strong>25% couverture</strong>, <strong>25% fondations</strong>.
          Cliquer sur un tarif pour le modifier.
        </p>
      </div>

      {/* Un tableau par série (type + largeur) */}
      {filteredSeries.length === 0 ? (
        <div className="rounded-lg border border-gray-200 p-8 text-center text-gray-500">
          Aucune grille tarifaire pour {BUILDING_TYPE_LABELS[selectedType]}
        </div>
      ) : (
        <div className="space-y-8">
          {filteredSeries.map((series, seriesIdx) => (
            <div key={`${series.type}_${series.width}`} className="rounded-lg border border-gray-200 overflow-hidden">
              {/* Header de série */}
              <div className="bg-gray-50 px-6 py-3 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {BUILDING_TYPE_LABELS[series.type]} — {series.width} m
                  </h3>
                  <span className="text-sm text-gray-500">
                    Entraxe {series.spacing} m
                  </span>
                </div>
                <span className="text-sm text-gray-500">
                  {series.entries.length} travée(s) configurée(s)
                </span>
              </div>

              {/* Tableau */}
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                      Travées
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28">
                      Longueur
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                      kWc
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tarif sans PV (€)
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28">
                      €/kWc
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {series.entries.map((entry, entryIdx) => {
                    const isEditing = editCell?.seriesIdx === seriesIdx && editCell?.entryIdx === entryIdx;
                    const longueur = entry.nbSpans * series.spacing;
                    const eurPerKwc = entry.kwc > 0 ? Math.round(entry.tarif / entry.kwc) : 0;

                    return (
                      <tr key={entry.nbSpans} className={isEditing ? "bg-amber-50" : "hover:bg-gray-50"}>
                        <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                          {entry.nbSpans}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600">
                          {longueur} m
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600">
                          {entry.kwc}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm">
                          {isEditing ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onKeyDown={handleKeyDown}
                                autoFocus
                                className="w-32 rounded border border-amber-400 px-2 py-1 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
                              />
                              <button
                                onClick={handleSaveEdit}
                                disabled={isSaving}
                                className="rounded bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-700 disabled:opacity-50"
                              >
                                {isSaving ? "…" : "✓"}
                              </button>
                              <button
                                onClick={handleCancelEdit}
                                className="rounded bg-gray-200 px-2 py-1 text-xs text-gray-700 hover:bg-gray-300"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleStartEdit(seriesIdx, entryIdx, entry.tarif)}
                              className="font-mono text-amber-700 font-semibold hover:bg-amber-100 rounded px-2 py-1 transition-colors cursor-pointer"
                              title="Cliquer pour modifier"
                            >
                              {entry.tarif.toLocaleString("fr-FR")} €
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 font-mono">
                          {eurPerKwc} €/kWc
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
