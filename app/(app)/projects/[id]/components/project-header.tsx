import type { Project } from "@/lib/types/project";

interface ProjectHeaderProps {
  project: Project;
}

const statusLabels: Record<string, { label: string; color: string }> = {
  draft: { label: "Brouillon", color: "bg-gray-100 text-gray-800" },
  submitted: { label: "Soumis", color: "bg-blue-100 text-blue-800" },
  accepted: { label: "Accepté", color: "bg-green-100 text-green-800" },
  rejected: { label: "Refusé", color: "bg-red-100 text-red-800" },
  returned: { label: "Retourné", color: "bg-yellow-100 text-yellow-800" },
};

export function ProjectHeader({ project }: ProjectHeaderProps) {
  const status = statusLabels[project.status] ?? { label: "Inconnu", color: "bg-gray-100 text-gray-800" };

  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
        <div className="mt-1 flex items-center gap-3">
          <span
            className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${status.color}`}
          >
            {status.label}
          </span>
          <span className="text-sm text-gray-500">
            {project.mode === "PRO_SERVICE" ? "Service Pro" : "Self-Service"}
          </span>
        </div>
      </div>
    </div>
  );
}
