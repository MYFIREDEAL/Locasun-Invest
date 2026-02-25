"use server";

import { createClient } from "@/lib/supabase/server";
import type { FinanceState, FinanceSnapshot } from "@/lib/types/finance";

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

// ─── helpers ───

async function getUserProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id, role")
    .eq("user_id", user.id)
    .single();

  if (!profile) return null;
  return { userId: user.id, orgId: profile.org_id, role: profile.role };
}

// ============================================================================
// GET — charger finance_state depuis projects.finance_state (JSONB)
// ============================================================================

export async function getFinanceState(
  projectId: string,
): Promise<ActionResult<FinanceState | null>> {
  try {
    const profile = await getUserProfile();
    if (!profile) return { success: false, error: "Non authentifié" };

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("projects")
      .select("finance_state")
      .eq("id", projectId)
      .eq("org_id", profile.orgId)
      .single();

    if (error) return { success: false, error: error.message };

    return { success: true, data: (data.finance_state as FinanceState) ?? null };
  } catch {
    return { success: false, error: "Erreur lecture finance_state" };
  }
}

// ============================================================================
// SAVE — persister finance_state en JSONB sur projects
// ============================================================================

export async function saveFinanceState(
  projectId: string,
  state: FinanceState,
): Promise<ActionResult<null>> {
  try {
    const profile = await getUserProfile();
    if (!profile) return { success: false, error: "Non authentifié" };

    const supabase = await createClient();
    const { error } = await supabase
      .from("projects")
      .update({ finance_state: state as unknown as Record<string, unknown> })
      .eq("id", projectId)
      .eq("org_id", profile.orgId);

    if (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("[saveFinanceState]", error);
      }
      return { success: false, error: error.message };
    }

    return { success: true, data: null };
  } catch {
    return { success: false, error: "Erreur sauvegarde finance_state" };
  }
}

// ============================================================================
// SAVE SNAPSHOT — persister le snapshot figé à la validation
// ============================================================================

export async function saveFinanceSnapshot(
  projectId: string,
  snapshot: FinanceSnapshot,
): Promise<ActionResult<null>> {
  try {
    const profile = await getUserProfile();
    if (!profile) return { success: false, error: "Non authentifié" };

    const supabase = await createClient();
    const { error } = await supabase
      .from("projects")
      .update({ finance_snapshot: snapshot as unknown as Record<string, unknown> })
      .eq("id", projectId)
      .eq("org_id", profile.orgId);

    if (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("[saveFinanceSnapshot]", error);
      }
      return { success: false, error: error.message };
    }

    return { success: true, data: null };
  } catch {
    return { success: false, error: "Erreur sauvegarde finance_snapshot" };
  }
}

// ============================================================================
// GET SNAPSHOT — charger le snapshot figé (pour la synthèse)
// ============================================================================

export async function getFinanceSnapshot(
  projectId: string,
): Promise<ActionResult<FinanceSnapshot | null>> {
  try {
    const profile = await getUserProfile();
    if (!profile) return { success: false, error: "Non authentifié" };

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("projects")
      .select("finance_snapshot")
      .eq("id", projectId)
      .eq("org_id", profile.orgId)
      .single();

    if (error) return { success: false, error: error.message };

    return { success: true, data: (data.finance_snapshot as FinanceSnapshot) ?? null };
  } catch {
    return { success: false, error: "Erreur lecture finance_snapshot" };
  }
}

// ============================================================================
// CLEAR SNAPSHOT — invalider le snapshot quand les données techniques changent
// ============================================================================

/**
 * Met finance_snapshot à null en DB.
 * Appelé quand kWc ou productible changent (stale propagation).
 */
export async function clearFinanceSnapshot(
  projectId: string,
): Promise<ActionResult<null>> {
  try {
    const profile = await getUserProfile();
    if (!profile) return { success: false, error: "Non authentifié" };

    const supabase = await createClient();
    const { error } = await supabase
      .from("projects")
      .update({ finance_snapshot: null })
      .eq("id", projectId)
      .eq("org_id", profile.orgId);

    if (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("[clearFinanceSnapshot]", error);
      }
      return { success: false, error: error.message };
    }

    return { success: true, data: null };
  } catch {
    return { success: false, error: "Erreur suppression finance_snapshot" };
  }
}
