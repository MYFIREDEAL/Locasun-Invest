"use client";

import Link from "next/link";
import type { ProjectListItem } from "@/lib/types/project";

interface ProjectsListProps {
  projects: ProjectListItem[];
}

const statusLabels: Record<string, { label: string; color: string }> = {
  draft: { label: "Brouillon", color: "bg-gray-100 text-gray-800" },
  submitted: { label: "Soumis", color: "bg-blue-100 text-blue-800" },
  accepted: { label: "Accepté", color: "bg-green-100 text-green-800" },
  rejected: { label: "Refusé", color: "bg-red-100 text-red-800" },
  returned: { label: "Retourné", color: "bg-yellow-100 text-yellow-800" },
};

const modeLabels: Record<string, string> = {
  PRO_SERVICE: "Service Pro",
  CLIENT_SELF_SERVICE: "Self-Service",
};

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function ProjectsList({ projects }: ProjectsListProps) {
  if (projects.length === 0) {
    return (
      <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
        <svg
          className="mx-auto h-12 w-12 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"
          />
        </svg>
        <h3 className="mt-4 text-lg font-medium text-gray-900">
          Aucun projet
        </h3>
        <p className="mt-2 text-sm text-gray-500">
          Créez votre premier projet pour commencer.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Nom du projet
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Mode
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Statut
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Dernière modification
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {projects.map((project) => {
            const status = statusLabels[project.status] ?? { label: "Inconnu", color: "bg-gray-100 text-gray-800" };
            return (
              <tr key={project.id} className="hover:bg-gray-50">
                <td className="whitespace-nowrap px-6 py-4">
                  <Link
                    href={`/projects/${project.id}`}
                    className="font-medium text-blue-600 hover:text-blue-800"
                  >
                    {project.name}
                  </Link>
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                  {modeLabels[project.mode] ?? project.mode}
                </td>
                <td className="whitespace-nowrap px-6 py-4">
                  <span
                    className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${status.color}`}
                  >
                    {status.label}
                  </span>
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                  {formatDate(project.updated_at)}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-right text-sm">
                  <Link
                    href={`/projects/${project.id}`}
                    className="text-gray-600 hover:text-gray-900"
                  >
                    Ouvrir →
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
