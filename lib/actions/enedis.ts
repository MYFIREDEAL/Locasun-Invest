/**
 * Server Actions pour le module Enedis.
 * Sauvegarde et récupération du contexte réseau Enedis d'un projet.
 */

"use server";

import { createClient } from "@/lib/supabase/server";
import type { EnedisContext } from "@/lib/types/enedis";
import { revalidatePath } from "next/cache";

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

// ============================================================================
// SAUVEGARDE DU CONTEXTE ENEDIS
// ============================================================================

/**
 * Sauvegarde le contexte réseau Enedis pour un projet.
 * Upsert dans la table building_configs (colonne enedis_context JSONB).
 */
export async function saveEnedisContext(
  projectId: string,
  context: EnedisContext
): Promise<ActionResult<{ saved: boolean }>> {
  try {
    const supabase = await createClient();

    // Vérifier l'authentification
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: "Non authentifié" };
    }

    // Vérifier que le projet existe
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .single();

    if (projectError || !project) {
      return { success: false, error: "Projet non trouvé" };
    }

    // Mettre à jour la config existante avec le contexte Enedis
    const { error } = await supabase
      .from("building_configs")
      .update({
        enedis_context: context,
        updated_at: new Date().toISOString(),
      })
      .eq("project_id", projectId);

    if (error) {
      console.error("[saveEnedisContext] Erreur update:", error);
      return { success: false, error: error.message };
    }

    revalidatePath(`/projects/${projectId}`);

    return { success: true, data: { saved: true } };
  } catch (e) {
    console.error("[saveEnedisContext] Exception:", e);
    return { success: false, error: "Erreur lors de la sauvegarde du contexte Enedis" };
  }
}

// ============================================================================
// LECTURE DU CONTEXTE ENEDIS
// ============================================================================

/**
 * Récupère le contexte Enedis sauvegardé pour un projet.
 */
export async function getEnedisContext(
  projectId: string
): Promise<ActionResult<EnedisContext | null>> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: "Non authentifié" };
    }

    const { data, error } = await supabase
      .from("building_configs")
      .select("enedis_context")
      .eq("project_id", projectId)
      .maybeSingle();

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      data: (data?.enedis_context as EnedisContext) ?? null,
    };
  } catch {
    return { success: false, error: "Erreur lors de la récupération du contexte Enedis" };
  }
}
