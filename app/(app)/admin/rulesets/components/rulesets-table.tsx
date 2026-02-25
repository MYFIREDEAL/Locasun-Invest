"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { RulesetListItem } from "@/lib/validators/ruleset";
import { duplicateRuleset, activateRuleset, deleteRuleset } from "@/lib/actions/rulesets";

interface RulesetsTableProps {
  rulesets: RulesetListItem[];
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function RulesetsTable({ rulesets }: RulesetsTableProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDuplicate = async (id: string) => {
    setLoading(id);
    setError(null);
    const result = await duplicateRuleset(id);
    if (result.success) {
      router.push(`/admin/rulesets/${result.data.id}`);
    } else {
      setError(result.error);
    }
    setLoading(null);
  };

  const handleActivate = async (id: string) => {
    setLoading(id);
    setError(null);
    const result = await activateRuleset(id);
    if (!result.success) {
      setError(result.error);
    }
    setLoading(null);
    router.refresh();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce ruleset ?")) {
      return;
    }
    setLoading(id);
    setError(null);
    const result = await deleteRuleset(id);
    if (!result.success) {
      setError(result.error);
    }
    setLoading(null);
    router.refresh();
  };

  if (rulesets.length === 0) {
    return (
      <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
        <h3 className="text-lg font-medium text-gray-900">Aucun ruleset</h3>
        <p className="mt-2 text-sm text-gray-500">
          Les rulesets définissent les options de configuration des bâtiments.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Nom
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Version
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Statut
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Créé le
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {rulesets.map((ruleset) => (
              <tr key={ruleset.id} className="hover:bg-gray-50">
                <td className="whitespace-nowrap px-6 py-4">
                  <button
                    onClick={() => router.push(`/admin/rulesets/${ruleset.id}`)}
                    className="font-medium text-blue-600 hover:text-blue-800"
                  >
                    {ruleset.name}
                  </button>
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                  v{ruleset.version}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                  {ruleset.org_id ? "Organisation" : "Global"}
                </td>
                <td className="whitespace-nowrap px-6 py-4">
                  {ruleset.is_active ? (
                    <span className="inline-flex rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-800">
                      Actif
                    </span>
                  ) : (
                    <span className="inline-flex rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-600">
                      Inactif
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                  {formatDate(ruleset.created_at)}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-right text-sm">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => handleDuplicate(ruleset.id)}
                      disabled={loading === ruleset.id}
                      className="text-blue-600 hover:text-blue-800 disabled:opacity-50"
                      title="Dupliquer (nouvelle version)"
                    >
                      📋 Dupliquer
                    </button>
                    {!ruleset.is_active && ruleset.org_id && (
                      <>
                        <button
                          onClick={() => handleActivate(ruleset.id)}
                          disabled={loading === ruleset.id}
                          className="text-green-600 hover:text-green-800 disabled:opacity-50"
                          title="Activer ce ruleset"
                        >
                          ✅ Activer
                        </button>
                        <button
                          onClick={() => handleDelete(ruleset.id)}
                          disabled={loading === ruleset.id}
                          className="text-red-600 hover:text-red-800 disabled:opacity-50"
                          title="Supprimer"
                        >
                          🗑️ Supprimer
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-md bg-blue-50 p-4">
        <h3 className="text-sm font-medium text-blue-800">💡 Comment ça marche ?</h3>
        <ul className="mt-2 text-sm text-blue-700 list-disc list-inside space-y-1">
          <li><strong>Dupliquer</strong> : Crée une copie modifiable (version +1)</li>
          <li><strong>Activer</strong> : Utilise ce ruleset pour les nouvelles configurations</li>
          <li>Les rulesets <strong>Globaux</strong> sont en lecture seule</li>
          <li>Seuls les rulesets <strong>inactifs</strong> peuvent être modifiés ou supprimés</li>
        </ul>
      </div>
    </div>
  );
}
