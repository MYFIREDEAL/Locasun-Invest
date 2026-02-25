import { notFound } from "next/navigation";
import { getProjectByShareToken } from "@/lib/actions/share";
import { SharedOffreClient } from "./components/shared-offre-client";

/**
 * Route publique : /share/[token]/offres
 * Aucune authentification requise — le token fait office de clé d'accès.
 */
export default async function SharedOffrePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const result = await getProjectByShareToken(token);

  if (!result.success) {
    notFound();
  }

  const { project, snapshot, buildingConfig } = result.data;

  return (
    <SharedOffreClient
      projectName={project.name}
      snapshot={snapshot}
      buildingConfig={buildingConfig}
    />
  );
}
