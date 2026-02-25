"use server";

/**
 * Server actions pour le partage public des offres.
 *
 * - generateShareToken(projectId) → génère un token unique si absent, le retourne
 * - getProjectByShareToken(token) → lecture publique (sans auth) pour la route /share/[token]
 */

import { createClient } from "@/lib/supabase/server";
import type { Project } from "@/lib/types/project";
import type { FinanceSnapshot } from "@/lib/types/finance";
import type { BuildingConfig } from "@/lib/types/building";

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

// ============================================================================
// HELPERS
// ============================================================================

/** Génère un token aléatoire base62 de 12 caractères */
function randomToken(length = 12): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

// ============================================================================
// GENERATE TOKEN (authentifié)
// ============================================================================

/**
 * Génère un token de partage pour un projet.
 * Si le projet a déjà un token, le retourne sans en créer un nouveau.
 * Requiert l'authentification (le user doit avoir accès au projet).
 */
export async function generateShareToken(
  projectId: string,
): Promise<ActionResult<string>> {
  try {
    const supabase = await createClient();

    // Vérifier l'auth
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: "Non authentifié" };
    }

    // Lire le projet (vérifie l'accès)
    const { data: project, error: fetchError } = await supabase
      .from("projects")
      .select("id, share_token")
      .eq("id", projectId)
      .single();

    if (fetchError || !project) {
      return { success: false, error: "Projet non trouvé" };
    }

    // Déjà un token ? Le retourner
    if (project.share_token) {
      return { success: true, data: project.share_token };
    }

    // Générer un nouveau token
    const token = randomToken();
    const { error: updateError } = await supabase
      .from("projects")
      .update({ share_token: token })
      .eq("id", projectId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    return { success: true, data: token };
  } catch {
    return { success: false, error: "Erreur lors de la génération du token" };
  }
}

// ============================================================================
// LECTURE PUBLIQUE PAR TOKEN (sans auth)
// ============================================================================

export interface SharedProjectData {
  project: Pick<Project, "id" | "name">;
  snapshot: FinanceSnapshot | null;
  buildingConfig: BuildingConfig | null;
}

/**
 * Charge les données d'un projet par son share_token.
 * Pas d'authentification requise — c'est le point d'entrée public.
 * Ne retourne que les données nécessaires au rendu de l'offre.
 */
export async function getProjectByShareToken(
  token: string,
): Promise<ActionResult<SharedProjectData>> {
  try {
    const supabase = await createClient();

    // Appeler la fonction SECURITY DEFINER qui bypass le RLS
    // → fonctionne même sans session (navigation privée, lien partagé)
    const { data, error } = await supabase.rpc("get_shared_project", {
      p_token: token,
    });

    if (error || !data) {
      return { success: false, error: "Lien invalide ou expiré" };
    }

    const result = data as {
      project: { id: string; name: string };
      snapshot: FinanceSnapshot | null;
      building_config: { params: BuildingConfig["params"]; derived: BuildingConfig["derived"] } | null;
    };

    return {
      success: true,
      data: {
        project: result.project,
        snapshot: result.snapshot,
        buildingConfig: result.building_config as BuildingConfig | null,
      },
    };
  } catch {
    return { success: false, error: "Erreur lors du chargement" };
  }
}
