import { notFound } from "next/navigation";
import { getProject } from "@/lib/actions/projects";
import { getFinanceSnapshot } from "@/lib/actions/finance";
import { getBuildingConfig } from "@/lib/actions/building-configs";
import { OffresPageClient } from "./components/offres-page-client";

export default async function OffresPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [projectResult, snapshotResult, configResult] = await Promise.all([
    getProject(id),
    getFinanceSnapshot(id),
    getBuildingConfig(id),
  ]);

  if (!projectResult.success) {
    notFound();
  }

  const project = projectResult.data;
  const snapshot = snapshotResult.success ? snapshotResult.data : null;
  const buildingConfig =
    configResult.success && configResult.data
      ? { params: configResult.data.params, derived: configResult.data.derived }
      : null;

  return (
    <OffresPageClient
      project={project}
      snapshot={snapshot}
      buildingConfig={buildingConfig}
    />
  );
}
