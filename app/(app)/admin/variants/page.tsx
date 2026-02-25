"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  BUILDING_TYPES,
  BUILDING_TYPE_LABELS,
  WIDTHS_BY_TYPE,
  SLOPE_BY_TYPE,
} from "@/lib/types/building";
import type { BuildingType } from "@/lib/types/building";
import {
  DEFAULT_VARIANTS,
  getVariantKey,
  type BuildingVariant,
  type VariantKey,
} from "@/lib/types/building-variants";
import { getVariants, upsertVariant, resetVariantsToDefault } from "@/lib/actions/variants";
import {
  getPricingGrid,
  updatePricingEntry,
  type PricingSeriesData,
} from "@/lib/actions/pricing";

export default function VariantsConfigPage() {
  const [selectedType, setSelectedType] = useState<BuildingType>("SYM");
  const [variants, setVariants] = useState<Record<VariantKey, BuildingVariant>>(
    { ...DEFAULT_VARIANTS }
  );
  const [editingKey, setEditingKey] = useState<VariantKey | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Pricing state
  const [pricingSeries, setPricingSeries] = useState<PricingSeriesData[]>([]);
  const [editPriceCell, setEditPriceCell] = useState<{ key: string; entryIdx: number } | null>(null);
  const [editPriceValue, setEditPriceValue] = useState("");

  // Charger les variantes depuis Supabase au montage
  useEffect(() => {
    async function loadFromDb() {
      try {
        const [dbVariants, dbPricing] = await Promise.all([
          getVariants(),
          getPricingGrid(),
        ]);
        setVariants(dbVariants);
        setPricingSeries(dbPricing);
      } catch (e) {
        console.error("Erreur chargement:", e);
        setVariants({ ...DEFAULT_VARIANTS });
      } finally {
        setIsLoading(false);
      }
    }
    loadFromDb();
  }, []);

  const widths = WIDTHS_BY_TYPE[selectedType];
  const slope = SLOPE_BY_TYPE[selectedType];

  const handleVariantChange = (
    key: VariantKey,
    field: keyof BuildingVariant,
    value: number
  ) => {
    setVariants((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: value,
      },
    }));
  };

  const handleSave = async () => {
    if (!editingKey) return;
    
    setIsSaving(true);
    setSaveMessage(null);
    
    try {
      const variant = variants[editingKey];
      if (variant) {
        const result = await upsertVariant(variant);
        if (result.success) {
          setSaveMessage("✓ Variante sauvegardée !");
          setEditingKey(null);
        } else {
          setSaveMessage(`❌ ${result.error}`);
        }
      }
      
      // Effacer le message après 3 secondes
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (e) {
      setSaveMessage("❌ Erreur de sauvegarde");
    }
    
    setIsSaving(false);
  };

  const handleReset = async () => {
    if (confirm("Réinitialiser toutes les variantes aux valeurs par défaut ?")) {
      setIsSaving(true);
      const result = await resetVariantsToDefault();
      if (result.success) {
        setVariants({ ...DEFAULT_VARIANTS });
        setSaveMessage("✓ Variantes réinitialisées !");
      } else {
        setSaveMessage(`❌ ${result.error}`);
      }
      setIsSaving(false);
      setTimeout(() => setSaveMessage(null), 3000);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Chargement des variantes...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl p-6">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <Link
            href="/admin/rulesets"
            className="text-sm text-blue-600 hover:underline"
          >
            ← Retour aux rulesets
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">
            Configuration des variantes
          </h1>
          <p className="text-gray-600">
            Définir les hauteurs (sablière gauche/droite, faîtage) pour chaque
            combinaison type + largeur
          </p>
          {saveMessage && (
            <p className={`mt-2 text-sm font-medium ${saveMessage.includes("✓") ? "text-green-600" : "text-red-600"}`}>
              {saveMessage}
            </p>
          )}
        </div>
        <button
          onClick={handleReset}
          className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
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
          {BUILDING_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                selectedType === type
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {BUILDING_TYPE_LABELS[type]}
            </button>
          ))}
        </div>
      </div>

      {/* Info pente */}
      <div className="mb-6 rounded-lg bg-blue-50 p-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-full bg-orange-500"></span>
            <span className="text-sm font-medium">
              Pente fixe: {slope}°
            </span>
          </div>
          <div className="text-sm text-gray-600">
            {widths.length} largeur(s) disponible(s)
          </div>
        </div>
      </div>

      {/* Tableau des variantes */}
      <div className="rounded-lg border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Largeur
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                H. Sablière Gauche
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                H. Sablière Droite
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                H. Faîtage
              </th>
              {(selectedType === "ASYM1" || selectedType === "ASYM2") && (
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Position Faîtage<br/>
                  <span className="text-xs font-normal normal-case text-gray-400">← depuis la gauche</span>
                </th>
              )}
              {selectedType === "ASYM2" && (
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Position Poteau<br/>
                  <span className="text-xs font-normal normal-case text-gray-400">← depuis la gauche</span>
                </th>
              )}
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {widths.map((width) => {
              const key = getVariantKey(selectedType, width);
              const variant = variants[key];
              const isEditing = editingKey === key;

              if (!variant) {
                // Calculer le colspan: 4 de base + 1 si ASYM1/ASYM2 + 1 si ASYM2
                const colspan = 4 + (selectedType === "ASYM1" || selectedType === "ASYM2" ? 1 : 0) + (selectedType === "ASYM2" ? 1 : 0);
                return (
                  <tr key={width} className="bg-yellow-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {width} m
                    </td>
                    <td colSpan={colspan} className="px-6 py-4 text-sm text-yellow-600">
                      ⚠️ Variante non configurée
                    </td>
                  </tr>
                );
              }

              return (
                <tr key={width} className={isEditing ? "bg-blue-50" : ""}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {width} m
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {isEditing ? (
                      <input
                        type="number"
                        value={variant.heightSabliereLeft}
                        onChange={(e) =>
                          handleVariantChange(
                            key,
                            "heightSabliereLeft",
                            parseFloat(e.target.value) || 0
                          )
                        }
                        step={0.1}
                        className="w-20 rounded border border-gray-300 px-2 py-1 text-sm"
                      />
                    ) : (
                      <span className="font-mono">{variant.heightSabliereLeft} m</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {isEditing ? (
                      <input
                        type="number"
                        value={variant.heightSabliereRight}
                        onChange={(e) =>
                          handleVariantChange(
                            key,
                            "heightSabliereRight",
                            parseFloat(e.target.value) || 0
                          )
                        }
                        step={0.1}
                        className="w-20 rounded border border-gray-300 px-2 py-1 text-sm"
                      />
                    ) : (
                      <span className="font-mono">{variant.heightSabliereRight} m</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {isEditing ? (
                      <input
                        type="number"
                        value={variant.heightFaitage}
                        onChange={(e) =>
                          handleVariantChange(
                            key,
                            "heightFaitage",
                            parseFloat(e.target.value) || 0
                          )
                        }
                        step={0.1}
                        className="w-20 rounded border border-gray-300 px-2 py-1 text-sm"
                      />
                    ) : (
                      <span className="font-mono text-blue-600 font-semibold">
                        {variant.heightFaitage} m
                      </span>
                    )}
                  </td>
                  {(selectedType === "ASYM1" || selectedType === "ASYM2") && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {isEditing ? (
                        <input
                          type="number"
                          value={variant.faitagePositionFromLeft || 0}
                          onChange={(e) =>
                            handleVariantChange(
                              key,
                              "faitagePositionFromLeft",
                              parseFloat(e.target.value) || 0
                            )
                          }
                          step={0.1}
                          className="w-20 rounded border border-gray-300 px-2 py-1 text-sm"
                        />
                      ) : (
                        <span className="font-mono text-orange-600">
                          {(variant.faitagePositionFromLeft || 0).toFixed(2)} m
                        </span>
                      )}
                    </td>
                  )}
                  {selectedType === "ASYM2" && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {isEditing ? (
                        <input
                          type="number"
                          value={variant.poteauPositionFromLeft || variant.zoneLeft || 0}
                          onChange={(e) =>
                            handleVariantChange(
                              key,
                              "poteauPositionFromLeft",
                              parseFloat(e.target.value) || 0
                            )
                          }
                          step={0.1}
                          className="w-20 rounded border border-gray-300 px-2 py-1 text-sm"
                        />
                      ) : (
                        <span className="font-mono text-purple-600">
                          {(variant.poteauPositionFromLeft || variant.zoneLeft || 0).toFixed(2)} m
                        </span>
                      )}
                    </td>
                  )}
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {isEditing ? (
                      <div className="flex gap-2">
                        <button
                          onClick={handleSave}
                          disabled={isSaving}
                          className="rounded bg-green-600 px-3 py-1 text-xs text-white hover:bg-green-700 disabled:opacity-50"
                        >
                          {isSaving ? "..." : "✓"}
                        </button>
                        <button
                          onClick={() => setEditingKey(null)}
                          className="rounded bg-gray-200 px-3 py-1 text-xs text-gray-700 hover:bg-gray-300"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setEditingKey(key)}
                        className="rounded bg-blue-100 px-3 py-1 text-xs text-blue-700 hover:bg-blue-200"
                      >
                        Modifier
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ================================================================ */}
      {/* GRILLE TARIFAIRE pour le type sélectionné                       */}
      {/* ================================================================ */}
      {(() => {
        const typeSeries = pricingSeries.filter((s) => s.type === selectedType);
        if (typeSeries.length === 0) return null;

        const handleStartPriceEdit = (seriesKey: string, entryIdx: number, tarif: number) => {
          setEditPriceCell({ key: seriesKey, entryIdx });
          setEditPriceValue(tarif.toString());
        };

        const handleCancelPriceEdit = () => {
          setEditPriceCell(null);
          setEditPriceValue("");
        };

        const handleSavePriceEdit = async () => {
          if (!editPriceCell) return;
          const series = typeSeries.find(
            (s) => `${s.type}_${s.width}` === editPriceCell.key,
          );
          if (!series) return;
          const entry = series.entries[editPriceCell.entryIdx];
          if (!entry?.id) return;

          const newTarif = parseInt(editPriceValue, 10);
          if (isNaN(newTarif) || newTarif < 0) {
            setSaveMessage("❌ Tarif invalide");
            setTimeout(() => setSaveMessage(null), 3000);
            return;
          }

          setIsSaving(true);
          const result = await updatePricingEntry(entry.id, newTarif);
          if (result.success) {
            setPricingSeries((prev) =>
              prev.map((s) =>
                `${s.type}_${s.width}` === editPriceCell.key
                  ? {
                      ...s,
                      entries: s.entries.map((e, i) =>
                        i === editPriceCell.entryIdx ? { ...e, tarif: newTarif } : e,
                      ),
                    }
                  : s,
              ),
            );
            setSaveMessage("✓ Tarif mis à jour");
            setEditPriceCell(null);
          } else {
            setSaveMessage(`❌ ${result.error}`);
          }
          setIsSaving(false);
          setTimeout(() => setSaveMessage(null), 3000);
        };

        const handlePriceKeyDown = (e: React.KeyboardEvent) => {
          if (e.key === "Enter") handleSavePriceEdit();
          if (e.key === "Escape") handleCancelPriceEdit();
        };

        return (
          <div className="mt-10">
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              💰 Grille tarifaire — {BUILDING_TYPE_LABELS[selectedType]}
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              Tarifs charpente + couverture + fondations (€ HT). Cliquer sur un tarif pour le modifier.
            </p>

            <div className="space-y-6">
              {typeSeries.map((series) => {
                const seriesKey = `${series.type}_${series.width}`;
                return (
                  <div
                    key={seriesKey}
                    className="rounded-lg border border-gray-200 overflow-hidden"
                  >
                    {/* Header série */}
                    <div className="bg-amber-50 px-6 py-3 border-b border-amber-200 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-amber-900">
                        Largeur {series.width} m — entraxe {series.spacing} m
                      </h3>
                      <span className="text-xs text-amber-700">
                        {series.entries.length} ligne(s)
                      </span>
                    </div>

                    {/* Tableau */}
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase w-20">
                            Travées
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase w-24">
                            Longueur
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase w-20">
                            kWc
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            Tarif (€ HT)
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase w-24">
                            €/kWc
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-100">
                        {series.entries.map((entry, entryIdx) => {
                          const isEditing =
                            editPriceCell?.key === seriesKey &&
                            editPriceCell?.entryIdx === entryIdx;
                          const longueur = entry.nbSpans * series.spacing;
                          const eurPerKwc =
                            entry.kwc > 0
                              ? Math.round(entry.tarif / entry.kwc)
                              : 0;

                          return (
                            <tr
                              key={`${seriesKey}_${entry.nbSpans}`}
                              className={
                                isEditing ? "bg-amber-50" : "hover:bg-gray-50"
                              }
                            >
                              <td className="px-4 py-1.5 text-sm font-medium text-gray-900">
                                {entry.nbSpans}
                              </td>
                              <td className="px-4 py-1.5 text-sm text-gray-600">
                                {longueur} m
                              </td>
                              <td className="px-4 py-1.5 text-sm text-gray-600">
                                {entry.kwc}
                              </td>
                              <td className="px-4 py-1.5 text-sm">
                                {isEditing ? (
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="number"
                                      value={editPriceValue}
                                      onChange={(e) =>
                                        setEditPriceValue(e.target.value)
                                      }
                                      onKeyDown={handlePriceKeyDown}
                                      autoFocus
                                      className="w-28 rounded border border-amber-400 px-2 py-0.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
                                    />
                                    <button
                                      onClick={handleSavePriceEdit}
                                      disabled={isSaving}
                                      className="rounded bg-green-600 px-2 py-0.5 text-xs text-white hover:bg-green-700 disabled:opacity-50"
                                    >
                                      {isSaving ? "…" : "✓"}
                                    </button>
                                    <button
                                      onClick={handleCancelPriceEdit}
                                      className="rounded bg-gray-200 px-2 py-0.5 text-xs text-gray-700 hover:bg-gray-300"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() =>
                                      handleStartPriceEdit(
                                        seriesKey,
                                        entryIdx,
                                        entry.tarif,
                                      )
                                    }
                                    className="font-mono text-amber-700 font-semibold hover:bg-amber-100 rounded px-2 py-0.5 transition-colors cursor-pointer"
                                    title="Cliquer pour modifier"
                                  >
                                    {entry.tarif.toLocaleString("fr-FR")} €
                                  </button>
                                )}
                              </td>
                              <td className="px-4 py-1.5 text-sm text-gray-400 font-mono">
                                {eurPerKwc}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Schéma visuel dynamique selon le type */}
      <div className="mt-8 rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Schéma des hauteurs - {BUILDING_TYPE_LABELS[selectedType]}
        </h3>
        <div className="flex justify-center">
          <BuildingSchema type={selectedType} />
        </div>
      </div>
    </div>
  );
}

// Composant de schéma dynamique
function BuildingSchema({ type }: { type: BuildingType }) {
  // Positions de base
  const ground = 180;
  const left = 80;
  const right = 320;
  const center = 200;
  
  // Hauteurs selon le type (normalisées pour le SVG)
  const getHeights = () => {
    switch (type) {
      case "SYM":
        return { leftH: 80, rightH: 80, faitageH: 40, faitageX: center };
      case "ASYM1":
      case "ASYM2":
        // Asymétrique: gauche plus haut, faîtage décalé vers la gauche
        return { leftH: 60, rightH: 100, faitageH: 30, faitageX: 140 };
      case "MONO":
        // Monopente: pas de faîtage central
        return { leftH: 100, rightH: 50, faitageH: 50, faitageX: right };
      case "VL_LEFT":
        return { leftH: 60, rightH: 90, faitageH: 60, faitageX: left };
      case "VL_RIGHT":
        return { leftH: 90, rightH: 60, faitageH: 60, faitageX: right };
      case "VL_DOUBLE":
        return { leftH: 90, rightH: 90, faitageH: 50, faitageX: center };
      case "PL":
        // Plat avec légère pente
        return { leftH: 70, rightH: 80, faitageH: 50, faitageX: center };
      default:
        return { leftH: 80, rightH: 80, faitageH: 40, faitageX: center };
    }
  };
  
  const h = getHeights();
  const isMono = type === "MONO";
  const isAsym = type === "ASYM1" || type === "ASYM2";
  
  return (
    <svg viewBox="0 0 400 220" className="w-full max-w-lg">
      {/* Sol */}
      <line x1="50" y1={ground} x2="350" y2={ground} stroke="#374151" strokeWidth="2" />
      
      {/* Poteau gauche */}
      <line x1={left} y1={ground} x2={left} y2={h.leftH} stroke="#3B82F6" strokeWidth="3" />
      <text x={left - 25} y={(ground + h.leftH) / 2} className="text-xs fill-blue-600" fontSize="10">
        H.Sab.G
      </text>
      
      {/* Poteau droit */}
      <line x1={right} y1={ground} x2={right} y2={h.rightH} stroke="#3B82F6" strokeWidth="3" />
      <text x={right + 5} y={(ground + h.rightH) / 2} className="text-xs fill-blue-600" fontSize="10">
        H.Sab.D
      </text>
      
      {/* Toiture */}
      {isMono ? (
        // Monopente: une seule ligne
        <line x1={left} y1={h.leftH} x2={right} y2={h.rightH} stroke="#EF4444" strokeWidth="2" />
      ) : (
        // Deux pans
        <>
          <line x1={left} y1={h.leftH} x2={h.faitageX} y2={h.faitageH} stroke="#EF4444" strokeWidth="2" />
          <line x1={h.faitageX} y1={h.faitageH} x2={right} y2={h.rightH} stroke="#EF4444" strokeWidth="2" />
          <circle cx={h.faitageX} cy={h.faitageH} r="4" fill="#EF4444" />
          <text x={h.faitageX + 5} y={h.faitageH - 5} className="text-xs fill-red-600" fontSize="10">
            Faîtage
          </text>
        </>
      )}
      
      {/* Poteau intermédiaire pour ASYM2 */}
      {type === "ASYM2" && (
        <>
          <line x1={center} y1={ground} x2={center} y2={65} stroke="#F59E0B" strokeWidth="2" strokeDasharray="4" />
          <text x={center - 20} y={ground + 15} className="text-xs fill-amber-600" fontSize="9">
            Poteau
          </text>
        </>
      )}
      
      {/* Position faîtage depuis la gauche pour ASYM */}
      {isAsym && (
        <>
          <line x1={left} y1={ground + 25} x2={h.faitageX} y2={ground + 25} stroke="#F97316" strokeWidth="1.5" />
          <polygon points={`${left},${ground + 22} ${left},${ground + 28} ${left + 5},${ground + 25}`} fill="#F97316" />
          <polygon points={`${h.faitageX},${ground + 22} ${h.faitageX},${ground + 28} ${h.faitageX - 5},${ground + 25}`} fill="#F97316" />
          <text x={(left + h.faitageX) / 2 - 25} y={ground + 40} className="text-xs fill-orange-600 font-semibold" fontSize="10">
            ← Position faîtage
          </text>
        </>
      )}
      
      {/* Largeur */}
      <line x1={left} y1={ground + 15} x2={right} y2={ground + 15} stroke="#6B7280" strokeWidth="1" />
      <polygon points={`${left},${ground + 12} ${left},${ground + 18} ${left + 5},${ground + 15}`} fill="#6B7280" />
      <polygon points={`${right},${ground + 12} ${right},${ground + 18} ${right - 5},${ground + 15}`} fill="#6B7280" />
      <text x={center - 20} y={ground + 30} className="text-xs fill-gray-600" fontSize="10">
        Largeur
      </text>
    </svg>
  );
}
