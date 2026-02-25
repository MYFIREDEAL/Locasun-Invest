"use server";

import { createClient } from "@/lib/supabase/server";
import type { CadastreProperties, ZoneUrbaProperties } from "@/lib/types/parcelle";

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

// ============================================================================
// TYPES
// ============================================================================

/** Row shape from the owned_parcelles table */
export interface OwnedParcelleRow {
  id: string;
  project_id: string;
  idu: string;
  source: "manual" | "secondary";
  cadastre_props: CadastreProperties;
  geometry: GeoJSON.MultiPolygon | null;
  zone_urba: ZoneUrbaProperties | null;
  created_at: string;
}

/** Input for adding an owned parcelle */
export interface AddOwnedParcelleInput {
  idu: string;
  source: "manual" | "secondary";
  cadastreProps: CadastreProperties;
  geometry?: GeoJSON.MultiPolygon | null;
  zoneUrba?: ZoneUrbaProperties | null;
}

// ============================================================================
// LECTURE
// ============================================================================

/**
 * Récupère toutes les parcelles possédées d'un projet.
 */
export async function getOwnedParcelles(
  projectId: string
): Promise<ActionResult<OwnedParcelleRow[]>> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      // DEV MODE fallback
      if (process.env.NODE_ENV === "development") {
        console.log("[owned-parcelles] DEV MODE: no user, returning empty");
        return { success: true, data: [] };
      }
      return { success: false, error: "Non authentifié" };
    }

    const { data, error } = await supabase
      .from("owned_parcelles")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true });

    if (error) {
      // Si la table n'existe pas encore (migration pas jouée), retourner vide
      if (error.code === "42P01" || error.message?.includes("does not exist")) {
        console.warn("[owned-parcelles] Table not found, returning empty");
        return { success: true, data: [] };
      }
      return { success: false, error: error.message };
    }

    return { success: true, data: (data ?? []) as OwnedParcelleRow[] };
  } catch {
    return { success: false, error: "Erreur lors de la récupération des parcelles possédées" };
  }
}

// ============================================================================
// AJOUT
// ============================================================================

/**
 * Ajoute une parcelle possédée à un projet.
 * Utilise upsert pour éviter les doublons (contrainte unique project_id + idu).
 */
export async function addOwnedParcelle(
  projectId: string,
  input: AddOwnedParcelleInput
): Promise<ActionResult<OwnedParcelleRow>> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      if (process.env.NODE_ENV === "development") {
        console.log("[owned-parcelles] DEV MODE: no user, skipping save");
        return { success: false, error: "DEV MODE: pas de persistance sans auth" };
      }
      return { success: false, error: "Non authentifié" };
    }

    const { data, error } = await supabase
      .from("owned_parcelles")
      .upsert(
        {
          project_id: projectId,
          idu: input.idu,
          source: input.source,
          cadastre_props: input.cadastreProps,
          geometry: input.geometry ?? null,
          zone_urba: input.zoneUrba ?? null,
        },
        { onConflict: "project_id,idu" }
      )
      .select()
      .single();

    if (error) {
      console.error("[owned-parcelles] Erreur upsert:", error);
      return { success: false, error: error.message };
    }

    return { success: true, data: data as OwnedParcelleRow };
  } catch {
    return { success: false, error: "Erreur lors de l'ajout de la parcelle possédée" };
  }
}

// ============================================================================
// SUPPRESSION
// ============================================================================

/**
 * Retire une parcelle possédée d'un projet (par IDU).
 */
export async function removeOwnedParcelle(
  projectId: string,
  idu: string
): Promise<ActionResult<{ deleted: boolean }>> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      if (process.env.NODE_ENV === "development") {
        console.log("[owned-parcelles] DEV MODE: no user, skipping delete");
        return { success: false, error: "DEV MODE: pas de persistance sans auth" };
      }
      return { success: false, error: "Non authentifié" };
    }

    const { error } = await supabase
      .from("owned_parcelles")
      .delete()
      .eq("project_id", projectId)
      .eq("idu", idu);

    if (error) {
      console.error("[owned-parcelles] Erreur delete:", error);
      return { success: false, error: error.message };
    }

    return { success: true, data: { deleted: true } };
  } catch {
    return { success: false, error: "Erreur lors de la suppression de la parcelle possédée" };
  }
}
