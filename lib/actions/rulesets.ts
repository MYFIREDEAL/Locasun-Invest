"use server";

import { createClient } from "@/lib/supabase/server";
import { 
  rulesetJsonSchema,
  type Ruleset, 
  type RulesetListItem,
  type RulesetJson,
  type UpdateRulesetJsonInput
} from "@/lib/validators/ruleset";
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

// Vérifier si l'utilisateur est admin
async function requireAdmin() {
  const profile = await getUserProfile();
  if (!profile) {
    return { error: "Non authentifié", profile: null };
  }
  if (profile.role !== "admin" && profile.role !== "pro") {
    return { error: "Accès réservé aux administrateurs", profile: null };
  }
  return { error: null, profile };
}

// ============================================================================
// LECTURE
// ============================================================================

/**
 * Récupère le ruleset actif pour l'organisation ou le global
 * Priorité: ruleset org spécifique > ruleset global
 */
export async function getActiveRuleset(): Promise<ActionResult<Ruleset>> {
  try {
    const profile = await getUserProfile();
    if (!profile) {
      return { success: false, error: "Non authentifié" };
    }

    const supabase = await createClient();
    
    // D'abord chercher un ruleset spécifique à l'org
    let { data } = await supabase
      .from("rulesets")
      .select("*")
      .eq("org_id", profile.orgId)
      .eq("is_active", true)
      .order("version", { ascending: false })
      .limit(1)
      .single();

    // Si pas de ruleset org, chercher le global
    if (!data) {
      const { data: globalData } = await supabase
        .from("rulesets")
        .select("*")
        .is("org_id", null)
        .eq("is_active", true)
        .order("version", { ascending: false })
        .limit(1)
        .single();
      
      data = globalData;
    }

    if (!data) {
      return { success: false, error: "Aucun ruleset actif trouvé" };
    }

    // Valider le JSON avec Zod
    const jsonParsed = rulesetJsonSchema.safeParse(data.json);
    if (!jsonParsed.success) {
      return { success: false, error: "Ruleset JSON invalide" };
    }

    return { 
      success: true, 
      data: { ...data, json: jsonParsed.data } as Ruleset 
    };
  } catch {
    return { success: false, error: "Erreur lors de la récupération du ruleset" };
  }
}

/**
 * Liste tous les rulesets de l'organisation (+ globaux)
 */
export async function listRulesets(): Promise<ActionResult<RulesetListItem[]>> {
  try {
    const { error: authError, profile } = await requireAdmin();
    if (authError || !profile) {
      return { success: false, error: authError ?? "Non autorisé" };
    }

    const supabase = await createClient();
    
    // Récupérer rulesets de l'org + globaux
    const { data, error } = await supabase
      .from("rulesets")
      .select("id, org_id, version, is_active, created_at")
      .or(`org_id.eq.${profile.orgId},org_id.is.null`)
      .order("version", { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data as RulesetListItem[] };
  } catch {
    return { success: false, error: "Erreur lors de la récupération des rulesets" };
  }
}

/**
 * Récupère un ruleset par ID
 */
export async function getRuleset(id: string): Promise<ActionResult<Ruleset>> {
  try {
    const { error: authError } = await requireAdmin();
    if (authError) {
      return { success: false, error: authError };
    }

    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from("rulesets")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) {
      return { success: false, error: "Ruleset non trouvé" };
    }

    // Valider le JSON
    const jsonParsed = rulesetJsonSchema.safeParse(data.json);
    if (!jsonParsed.success) {
      return { success: false, error: "Ruleset JSON invalide" };
    }

    return { 
      success: true, 
      data: { ...data, json: jsonParsed.data } as Ruleset 
    };
  } catch {
    return { success: false, error: "Erreur lors de la récupération du ruleset" };
  }
}

// ============================================================================
// ÉCRITURE (admin uniquement)
// ============================================================================

/**
 * Duplique un ruleset existant avec version+1
 */
export async function duplicateRuleset(sourceId: string): Promise<ActionResult<Ruleset>> {
  try {
    const { error: authError, profile } = await requireAdmin();
    if (authError || !profile) {
      return { success: false, error: authError ?? "Non autorisé" };
    }

    const supabase = await createClient();
    
    // Récupérer le ruleset source
    const { data: source, error: sourceError } = await supabase
      .from("rulesets")
      .select("*")
      .eq("id", sourceId)
      .single();

    if (sourceError || !source) {
      return { success: false, error: "Ruleset source non trouvé" };
    }

    // Trouver la prochaine version pour ce nom
    const { data: versions } = await supabase
      .from("rulesets")
      .select("version")
      .eq("name", source.name)
      .eq("org_id", profile.orgId)
      .order("version", { ascending: false })
      .limit(1);

    const nextVersion = versions && versions.length > 0 
      ? (versions[0]?.version ?? 0) + 1 
      : source.version + 1;

    // Créer la nouvelle version (inactive par défaut)
    const { data: newRuleset, error: insertError } = await supabase
      .from("rulesets")
      .insert({
        org_id: profile.orgId, // Toujours créer pour l'org (pas global)
        version: nextVersion,
        name: source.name,
        json: source.json,
        is_active: false,
      })
      .select()
      .single();

    if (insertError) {
      return { success: false, error: insertError.message };
    }

    revalidatePath("/admin/rulesets");
    return { success: true, data: newRuleset as Ruleset };
  } catch {
    return { success: false, error: "Erreur lors de la duplication du ruleset" };
  }
}

/**
 * Met à jour le JSON d'un ruleset (non actif uniquement)
 */
export async function updateRulesetJson(
  id: string, 
  input: UpdateRulesetJsonInput
): Promise<ActionResult<Ruleset>> {
  try {
    const { error: authError, profile } = await requireAdmin();
    if (authError || !profile) {
      return { success: false, error: authError ?? "Non autorisé" };
    }

    // Valider le JSON
    const jsonParsed = rulesetJsonSchema.safeParse(input.json);
    if (!jsonParsed.success) {
      const firstError = jsonParsed.error.issues[0];
      return { success: false, error: firstError?.message ?? "JSON invalide" };
    }

    const supabase = await createClient();
    
    // Vérifier que le ruleset n'est pas actif
    const { data: existing } = await supabase
      .from("rulesets")
      .select("is_active, org_id")
      .eq("id", id)
      .single();

    if (!existing) {
      return { success: false, error: "Ruleset non trouvé" };
    }

    if (existing.is_active) {
      return { success: false, error: "Impossible de modifier un ruleset actif. Dupliquez-le d'abord." };
    }

    // Vérifier que c'est un ruleset de l'org (pas global)
    if (existing.org_id !== profile.orgId) {
      return { success: false, error: "Vous ne pouvez modifier que les rulesets de votre organisation" };
    }

    const { data, error } = await supabase
      .from("rulesets")
      .update({ json: jsonParsed.data })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/admin/rulesets");
    revalidatePath(`/admin/rulesets/${id}`);
    return { success: true, data: data as Ruleset };
  } catch {
    return { success: false, error: "Erreur lors de la mise à jour du ruleset" };
  }
}

/**
 * Active un ruleset (désactive les autres du même nom pour cette org)
 */
export async function activateRuleset(id: string): Promise<ActionResult<Ruleset>> {
  try {
    const { error: authError, profile } = await requireAdmin();
    if (authError || !profile) {
      return { success: false, error: authError ?? "Non autorisé" };
    }

    const supabase = await createClient();
    
    // Récupérer le ruleset à activer
    const { data: target } = await supabase
      .from("rulesets")
      .select("*")
      .eq("id", id)
      .single();

    if (!target) {
      return { success: false, error: "Ruleset non trouvé" };
    }

    // Désactiver tous les rulesets du même nom pour cette org
    await supabase
      .from("rulesets")
      .update({ is_active: false })
      .eq("name", target.name)
      .eq("org_id", profile.orgId);

    // Activer le ruleset cible
    const { data, error } = await supabase
      .from("rulesets")
      .update({ is_active: true })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/admin/rulesets");
    revalidatePath("/projects");
    return { success: true, data: data as Ruleset };
  } catch {
    return { success: false, error: "Erreur lors de l'activation du ruleset" };
  }
}

/**
 * Supprime un ruleset (non actif uniquement)
 */
export async function deleteRuleset(id: string): Promise<ActionResult<null>> {
  try {
    const { error: authError, profile } = await requireAdmin();
    if (authError || !profile) {
      return { success: false, error: authError ?? "Non autorisé" };
    }

    const supabase = await createClient();
    
    // Vérifier que le ruleset n'est pas actif et appartient à l'org
    const { data: existing } = await supabase
      .from("rulesets")
      .select("is_active, org_id")
      .eq("id", id)
      .single();

    if (!existing) {
      return { success: false, error: "Ruleset non trouvé" };
    }

    if (existing.is_active) {
      return { success: false, error: "Impossible de supprimer un ruleset actif" };
    }

    if (existing.org_id !== profile.orgId) {
      return { success: false, error: "Vous ne pouvez supprimer que les rulesets de votre organisation" };
    }

    const { error } = await supabase
      .from("rulesets")
      .delete()
      .eq("id", id);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/admin/rulesets");
    return { success: true, data: null };
  } catch {
    return { success: false, error: "Erreur lors de la suppression du ruleset" };
  }
}
