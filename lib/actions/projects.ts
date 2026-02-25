"use server";

import { createClient } from "@/lib/supabase/server";
import { createProjectSchema, updateProjectSchema } from "@/lib/validators/project";
import type { Project, ProjectListItem, StepsState } from "@/lib/types/project";
import { revalidatePath } from "next/cache";

type ActionResult<T> = 
  | { success: true; data: T }
  | { success: false; error: string };

// Récupérer le profil de l'utilisateur connecté
async function getUserProfile() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id, role")
    .eq("user_id", user.id)
    .single();

  if (!profile) {
    return null;
  }

  return { userId: user.id, orgId: profile.org_id, role: profile.role };
}

// Lister les projets de l'organisation
export async function getProjects(): Promise<ActionResult<ProjectListItem[]>> {
  try {
    const profile = await getUserProfile();
    if (!profile) {
      return { success: false, error: "Non authentifié" };
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("projects")
      .select("id, name, mode, status, created_at, updated_at")
      .eq("org_id", profile.orgId)
      .order("updated_at", { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data as ProjectListItem[] };
  } catch {
    return { success: false, error: "Erreur lors de la récupération des projets" };
  }
}

// Récupérer un projet par ID
export async function getProject(id: string): Promise<ActionResult<Project>> {
  try {
    const profile = await getUserProfile();
    if (!profile) {
      return { success: false, error: "Non authentifié" };
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("id", id)
      .eq("org_id", profile.orgId)
      .single();

    if (error) {
      return { success: false, error: "Projet non trouvé" };
    }

    return { success: true, data: data as Project };
  } catch {
    return { success: false, error: "Erreur lors de la récupération du projet" };
  }
}

// Créer un nouveau projet
export async function createProject(
  input: unknown
): Promise<ActionResult<Project>> {
  try {
    const profile = await getUserProfile();
    if (!profile) {
      return { success: false, error: "Non authentifié" };
    }

    // Validation Zod
    const parsed = createProjectSchema.safeParse(input);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0];
      return { success: false, error: firstError?.message ?? "Données invalides" };
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("projects")
      .insert({
        org_id: profile.orgId,
        name: parsed.data.name,
        mode: parsed.data.mode,
        status: "draft",
        created_by_role: profile.role === "client" ? "client" : "pro",
        owner_user_id: profile.userId,
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/projects");
    return { success: true, data: data as Project };
  } catch {
    return { success: false, error: "Erreur lors de la création du projet" };
  }
}

// Mettre à jour un projet
export async function updateProject(
  id: string,
  input: unknown
): Promise<ActionResult<Project>> {
  try {
    const profile = await getUserProfile();
    if (!profile) {
      return { success: false, error: "Non authentifié" };
    }

    // Validation Zod
    const parsed = updateProjectSchema.safeParse(input);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0];
      return { success: false, error: firstError?.message ?? "Données invalides" };
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("projects")
      .update(parsed.data)
      .eq("id", id)
      .eq("org_id", profile.orgId)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/projects");
    revalidatePath(`/projects/${id}`);
    return { success: true, data: data as Project };
  } catch {
    return { success: false, error: "Erreur lors de la mise à jour du projet" };
  }
}

// Archiver/Supprimer un projet (soft delete optionnel)
export async function deleteProject(id: string): Promise<ActionResult<null>> {
  try {
    const profile = await getUserProfile();
    if (!profile) {
      return { success: false, error: "Non authentifié" };
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from("projects")
      .delete()
      .eq("id", id)
      .eq("org_id", profile.orgId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/projects");
    return { success: true, data: null };
  } catch {
    return { success: false, error: "Erreur lors de la suppression du projet" };
  }
}

// ============================================================================
// WIZARD STATE
// ============================================================================

/**
 * Sauvegarde l'état du wizard stepper en DB (colonne wizard_state JSONB sur projects)
 */
export async function saveWizardState(
  projectId: string,
  state: StepsState,
): Promise<ActionResult<null>> {
  try {
    const profile = await getUserProfile();
    if (!profile) {
      return { success: false, error: "Non authentifié" };
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from("projects")
      .update({ wizard_state: state as unknown as Record<string, unknown> })
      .eq("id", projectId);

    if (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("[saveWizardState]", error);
      }
      return { success: false, error: error.message };
    }

    return { success: true, data: null };
  } catch {
    return { success: false, error: "Erreur sauvegarde wizard state" };
  }
}
