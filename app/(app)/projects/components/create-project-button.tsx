"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createProject } from "@/lib/actions/projects";

export function CreateProjectButton() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"PRO_SERVICE" | "CLIENT_SELF_SERVICE">("PRO_SERVICE");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const result = await createProject({ name, mode });

    if (result.success) {
      setIsOpen(false);
      setName("");
      router.push(`/projects/${result.data.id}`);
    } else {
      setError(result.error);
    }

    setIsLoading(false);
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        <svg
          className="-ml-1 mr-2 h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 4v16m8-8H4"
          />
        </svg>
        Nouveau projet
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              Créer un nouveau projet
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="name"
                  className="block text-sm font-medium text-gray-700"
                >
                  Nom du projet
                </label>
                <input
                  type="text"
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                  placeholder="Mon projet solaire"
                  required
                  minLength={3}
                />
              </div>

              <div>
                <label
                  htmlFor="mode"
                  className="block text-sm font-medium text-gray-700"
                >
                  Mode
                </label>
                <select
                  id="mode"
                  value={mode}
                  onChange={(e) =>
                    setMode(e.target.value as "PRO_SERVICE" | "CLIENT_SELF_SERVICE")
                  }
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                >
                  <option value="PRO_SERVICE">Service Pro</option>
                  <option value="CLIENT_SELF_SERVICE">Self-Service Client</option>
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  {mode === "PRO_SERVICE"
                    ? "Le professionnel gère le projet, le client consulte."
                    : "Le client crée et modifie son projet, le pro valide."}
                </p>
              </div>

              {error && (
                <div className="rounded-md bg-red-50 p-3">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    setError(null);
                    setName("");
                  }}
                  className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isLoading ? "Création..." : "Créer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
