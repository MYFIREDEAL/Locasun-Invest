"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Ruleset, RulesetJson, RulesetFamily, RulesetParam, RulesetOption } from "@/lib/validators/ruleset";
import { updateRulesetJson, activateRuleset } from "@/lib/actions/rulesets";

interface RulesetEditorProps {
  ruleset: Ruleset;
}

export function RulesetEditor({ ruleset }: RulesetEditorProps) {
  const router = useRouter();
  const [json, setJson] = useState<RulesetJson>(ruleset.json);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isReadOnly = ruleset.is_active || !ruleset.org_id;

  const handleSave = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    const result = await updateRulesetJson(ruleset.id, { json });
    
    if (result.success) {
      setSuccess("Ruleset sauvegardé !");
      router.refresh();
    } else {
      setError(result.error);
    }
    
    setLoading(false);
  };

  const handleActivate = async () => {
    if (!confirm("Activer ce ruleset ? Il sera utilisé pour les nouvelles configurations.")) {
      return;
    }
    
    setLoading(true);
    setError(null);

    const result = await activateRuleset(ruleset.id);
    
    if (result.success) {
      setSuccess("Ruleset activé !");
      router.refresh();
    } else {
      setError(result.error);
    }
    
    setLoading(false);
  };

  const updateFamily = (familyIndex: number, updates: Partial<RulesetFamily>) => {
    const newFamilies = [...json.families];
    newFamilies[familyIndex] = { ...newFamilies[familyIndex], ...updates } as RulesetFamily;
    setJson({ ...json, families: newFamilies });
  };

  const updateParam = (familyIndex: number, paramIndex: number, updates: Partial<RulesetParam>) => {
    const newFamilies = [...json.families];
    const family = newFamilies[familyIndex];
    if (family) {
      const newParams = [...family.params];
      newParams[paramIndex] = { ...newParams[paramIndex], ...updates } as RulesetParam;
      newFamilies[familyIndex] = { ...family, params: newParams };
      setJson({ ...json, families: newFamilies });
    }
  };

  const updateOption = (
    familyIndex: number, 
    paramIndex: number, 
    optionIndex: number, 
    updates: Partial<RulesetOption>
  ) => {
    const newFamilies = [...json.families];
    const family = newFamilies[familyIndex];
    if (family) {
      const param = family.params[paramIndex];
      if (param?.options) {
        const newOptions = [...param.options];
        newOptions[optionIndex] = { ...newOptions[optionIndex], ...updates } as RulesetOption;
        updateParam(familyIndex, paramIndex, { options: newOptions });
      }
    }
  };

  const addOption = (familyIndex: number, paramIndex: number) => {
    const family = json.families[familyIndex];
    const param = family?.params[paramIndex];
    if (param?.options) {
      const newOptions = [...param.options, { value: 0, label: "Nouvelle option" }];
      updateParam(familyIndex, paramIndex, { options: newOptions });
    }
  };

  const removeOption = (familyIndex: number, paramIndex: number, optionIndex: number) => {
    const family = json.families[familyIndex];
    const param = family?.params[paramIndex];
    if (param?.options && param.options.length > 1) {
      const newOptions = param.options.filter((_, i) => i !== optionIndex);
      updateParam(familyIndex, paramIndex, { options: newOptions });
    }
  };

  return (
    <div className="space-y-6">
      {/* Messages */}
      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}
      {success && (
        <div className="rounded-md bg-green-50 p-4">
          <p className="text-sm text-green-800">{success}</p>
        </div>
      )}

      {/* Avertissement lecture seule */}
      {isReadOnly && (
        <div className="rounded-md bg-yellow-50 p-4">
          <p className="text-sm text-yellow-800">
            {ruleset.is_active 
              ? "⚠️ Ce ruleset est actif et ne peut pas être modifié. Dupliquez-le pour créer une nouvelle version."
              : "⚠️ Les rulesets globaux sont en lecture seule. Dupliquez-le pour créer une version modifiable."}
          </p>
        </div>
      )}

      {/* Infos générales */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Informations générales</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">Nom</label>
            <input
              type="text"
              value={json.name}
              onChange={(e) => setJson({ ...json, name: e.target.value })}
              disabled={isReadOnly}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 disabled:bg-gray-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Description</label>
            <input
              type="text"
              value={json.description ?? ""}
              onChange={(e) => setJson({ ...json, description: e.target.value })}
              disabled={isReadOnly}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 disabled:bg-gray-100"
            />
          </div>
        </div>
      </div>

      {/* Familles de bâtiments */}
      {json.families.map((family, familyIndex) => (
        <div key={family.id} className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{family.label}</h3>
              <p className="text-sm text-gray-500">{family.description}</p>
            </div>
            <span className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-600">
              {family.id}
            </span>
          </div>

          {/* Paramètres */}
          <div className="space-y-4">
            {family.params.map((param, paramIndex) => (
              <div key={param.id} className="rounded-md bg-gray-50 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-700">{param.label}</span>
                    {param.unit && (
                      <span className="text-sm text-gray-500">({param.unit})</span>
                    )}
                  </div>
                  <span className="rounded bg-blue-100 px-2 py-1 text-xs text-blue-600">
                    {param.type}
                  </span>
                </div>

                {/* Options pour type select */}
                {param.type === "select" && param.options && (
                  <div className="mt-2 space-y-2">
                    <p className="text-xs text-gray-500">Options :</p>
                    {param.options.map((option, optionIndex) => (
                      <div key={optionIndex} className="flex items-center gap-2">
                        <input
                          type="number"
                          value={typeof option.value === "number" ? option.value : 0}
                          onChange={(e) => 
                            updateOption(familyIndex, paramIndex, optionIndex, { 
                              value: parseFloat(e.target.value) || 0 
                            })
                          }
                          disabled={isReadOnly}
                          className="w-20 rounded border border-gray-300 px-2 py-1 text-sm disabled:bg-gray-100"
                        />
                        <input
                          type="text"
                          value={option.label}
                          onChange={(e) => 
                            updateOption(familyIndex, paramIndex, optionIndex, { 
                              label: e.target.value 
                            })
                          }
                          disabled={isReadOnly}
                          className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm disabled:bg-gray-100"
                        />
                        <label className="flex items-center gap-1 text-xs">
                          <input
                            type="checkbox"
                            checked={option.default ?? false}
                            onChange={(e) => 
                              updateOption(familyIndex, paramIndex, optionIndex, { 
                                default: e.target.checked 
                              })
                            }
                            disabled={isReadOnly}
                          />
                          Défaut
                        </label>
                        {!isReadOnly && (
                          <button
                            onClick={() => removeOption(familyIndex, paramIndex, optionIndex)}
                            className="text-red-500 hover:text-red-700"
                            title="Supprimer"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                    {!isReadOnly && (
                      <button
                        onClick={() => addOption(familyIndex, paramIndex)}
                        className="text-sm text-blue-600 hover:text-blue-800"
                      >
                        + Ajouter une option
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Boutons d'action */}
      {!isReadOnly && (
        <div className="flex justify-end gap-3">
          <button
            onClick={handleSave}
            disabled={loading}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Sauvegarde..." : "💾 Sauvegarder"}
          </button>
          <button
            onClick={handleActivate}
            disabled={loading}
            className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? "Activation..." : "✅ Activer ce ruleset"}
          </button>
        </div>
      )}
    </div>
  );
}
