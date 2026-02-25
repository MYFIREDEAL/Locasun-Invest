import { notFound } from "next/navigation";
import { getProject } from "@/lib/actions/projects";
import { ProjectWizard } from "./components/project-wizard";
import type { StepId } from "@/lib/types/project";

const VALID_STEPS = new Set<string>(["batiment", "carte", "finance", "synthese"]);

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ step?: string }>;
}) {
  const { id } = await params;
  const { step } = await searchParams;
  
  const result = await getProject(id);

  if (!result.success) {
    notFound();
  }

  const project = result.data;
  const initialStep: StepId | undefined =
    step && VALID_STEPS.has(step) ? (step as StepId) : undefined;

  return <ProjectWizard project={project} initialStep={initialStep} />;
}
