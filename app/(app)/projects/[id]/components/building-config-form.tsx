"use client";

import { useState, useEffect } from "react";
import type { RulesetJson, RulesetFamily, RulesetParam } from "@/lib/validators/ruleset";
import type { Project } from "@/lib/types/project";

interface BuildingConfigFormProps {
  project: Project;
  ruleset: RulesetJson;
  rulesetVersion: string;
  initialConfig?: Record<string, unknown>;
  onSave?: (config: Record<string, unknown>) => void;
}

export function BuildingConfigForm({ 
  project, 
  ruleset, 
  rulesetVersion,
  initialConfig = {},
  onSave 
}: BuildingConfigFormProps) {
  const [selectedFamily, setSelectedFamily] = useState<string>(
    ruleset.families[0]?.id ?? ""
  );
  const [config, setConfig] = useState<Record<string, unknown>>(initialConfig);
  const [isSaving, setIsSaving] = useState(false);

  const family = ruleset.families.find(f => f.id === selectedFamily);

  // Initialiser les valeurs par défaut quand la famille change
  useEffect(() => {
    if (family && Object.keys(config).length === 0) {
      const defaults: Record<string, unknown> = {};
      family.params.forEach(param => {
        if (param.type === "select" && param.options) {
          const defaultOption = param.options.find(o => o.default);
          defaults[param.id] = defaultOption?.value ?? param.options[0]?.value;
        } else if (param.type === "boolean") {
          defaults[param.id] = param.defaultValue ?? false;
        } else if (param.type === "number") {
          defaults[param.id] = param.defaultValue ?? param.min ?? 0;
        }
      });
      setConfig(prev => ({ ...prev, ...defaults }));
    }
  }, [family, config]);

  const handleChange = (key: string, value: unknown) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!onSave) return;
    setIsSaving(true);
    await onSave({
      family_type: selectedFamily,
      params: config,
      derived: {
        ruleset_version: rulesetVersion,
      },
    });
    setIsSaving(false);
  };

  const isReadOnly = project.status !== "draft" && project.status !== "returned";

  return (
    <div className="space-y-6">
      {/* Info ruleset */}
      <div className="flex items-center justify-between rounded-md bg-blue-50 p-3">
        <span className="text-sm text-blue-700">
          📋 Ruleset: <strong>{ruleset.name}</strong> (v{rulesetVersion})
        </span>
      </div>

      {/* Sélection de la famille de bâtiment */}
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Type de bâtiment
        </label>
        <select
          value={selectedFamily}
          onChange={(e) => {
            setSelectedFamily(e.target.value);
            setConfig({}); // Reset config when family changes
          }}
          disabled={isReadOnly}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 disabled:bg-gray-100"
        >
          {ruleset.families.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </select>
        {family?.description && (
          <p className="mt-1 text-sm text-gray-500">{family.description}</p>
        )}
      </div>

      {/* Paramètres de la famille */}
      {family && (
        <div className="grid gap-4 sm:grid-cols-2">
          {family.params.map((param) => (
            <ParamInput
              key={param.id}
              param={param}
              value={config[param.id]}
              onChange={(value) => handleChange(param.id, value)}
              disabled={isReadOnly}
            />
          ))}
        </div>
      )}

      {/* Récapitulatif */}
      <div className="rounded-md bg-gray-50 p-4">
        <h4 className="text-sm font-medium text-gray-700">Récapitulatif</h4>
        <pre className="mt-2 text-xs text-gray-600 overflow-auto">
          {JSON.stringify({ family_type: selectedFamily, ...config }, null, 2)}
        </pre>
      </div>

      {/* Bouton de sauvegarde */}
      {!isReadOnly && onSave && (
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isSaving ? "Sauvegarde..." : "💾 Sauvegarder la configuration"}
          </button>
        </div>
      )}

      {isReadOnly && (
        <div className="rounded-md bg-yellow-50 p-3">
          <p className="text-sm text-yellow-800">
            ⚠️ Le projet est en statut &quot;{project.status}&quot; - la configuration ne peut pas être modifiée.
          </p>
        </div>
      )}
    </div>
  );
}

interface ParamInputProps {
  param: RulesetParam;
  value: unknown;
  onChange: (value: unknown) => void;
  disabled?: boolean;
}

function ParamInput({ param, value, onChange, disabled }: ParamInputProps) {
  const id = `param-${param.id}`;

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700">
        {param.label}
        {param.unit && <span className="text-gray-400"> ({param.unit})</span>}
      </label>

      {param.type === "select" && param.options && (
        <select
          id={id}
          value={String(value ?? "")}
          onChange={(e) => {
            const opt = param.options?.find(o => String(o.value) === e.target.value);
            onChange(opt?.value);
          }}
          disabled={disabled}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 disabled:bg-gray-100"
        >
          {param.options.map((opt) => (
            <option key={String(opt.value)} value={String(opt.value)}>
              {opt.label}
            </option>
          ))}
        </select>
      )}

      {param.type === "number" && (
        <input
          type="number"
          id={id}
          value={typeof value === "number" ? value : ""}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          min={param.min}
          max={param.max}
          step={param.step}
          disabled={disabled}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 disabled:bg-gray-100"
        />
      )}

      {param.type === "boolean" && (
        <div className="mt-2">
          <label className="inline-flex items-center">
            <input
              type="checkbox"
              id={id}
              checked={Boolean(value)}
              onChange={(e) => onChange(e.target.checked)}
              disabled={disabled}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
            />
            <span className="ml-2 text-sm text-gray-600">
              {value ? "Oui" : "Non"}
            </span>
          </label>
        </div>
      )}
    </div>
  );
}
