import { getProjects } from "@/lib/actions/projects";
import { ProjectsList } from "./components/projects-list";
import { CreateProjectButton } from "./components/create-project-button";

export default async function ProjectsPage() {
  const result = await getProjects();

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projets</h1>
          <p className="mt-1 text-sm text-gray-600">
            Gérez vos projets de configuration solaire
          </p>
        </div>
        <CreateProjectButton />
      </div>

      {result.success ? (
        <ProjectsList projects={result.data} />
      ) : (
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-800">{result.error}</p>
        </div>
      )}
    </div>
  );
}
