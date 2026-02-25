"use server";

import { createClient } from "@/lib/supabase/server";
import { 
  buildingParamsSchema, 
  buildingDerivedSchema,
  type BuildingParams,
  type BuildingDerived,
  type BuildingConfigRow,
} from "@/lib/types/building";
import { lookupBuildingCost } from "@/lib/data/building-pricing";
import type { ParcelleInfo } from "@/lib/types/parcelle";
import { revalidatePath } from "next/cache";

type ActionResult<T> = 
  | { success: true; data: T }
  | { success: false; error: string };

// Récupérer le profil de l'utilisateur connecté
async function getUserProfile() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError) {
    console.error("Auth error:", authError);
    return null;
  }
  
  if (!user) {
    console.log("No user session found");
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("user_id, org_id, role")
    .eq("user_id", user.id)
    .single();

  if (profileError) {
    console.error("Profile error:", profileError);
    // En dev, créer un profil temporaire si manquant
    if (process.env.NODE_ENV === "development") {
      console.log("DEV MODE: Returning mock profile for user", user.id);
      return { id: user.id, org_id: null, role: "pro" as const };
    }
    return null;
  }

  return { id: profile.user_id, org_id: profile.org_id, role: profile.role };
}

// ============================================================================
// LECTURE
// ============================================================================

/**
 * Récupère la configuration d'un projet
 */
export async function getBuildingConfig(
  projectId: string
): Promise<ActionResult<BuildingConfigRow | null>> {
  try {
    const profile = await getUserProfile();
    if (!profile) {
      return { success: false, error: "Non authentifié" };
    }

    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from("building_configs")
      .select("*")
      .eq("project_id", projectId)
      .maybeSingle();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data as BuildingConfigRow | null };
  } catch {
    return { success: false, error: "Erreur lors de la récupération de la config" };
  }
}

// ============================================================================
// ÉCRITURE
// ============================================================================

/**
 * Sauvegarde ou met à jour la configuration d'un projet
 */
export async function saveBuildingConfig(
  projectId: string,
  params: BuildingParams,
  derived: BuildingDerived
): Promise<ActionResult<BuildingConfigRow>> {
  try {
    const supabase = await createClient();
    
    // Vérifier l'authentification
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: "Non authentifié - veuillez vous connecter" };
    }

    // Valider les params avec Zod
    const paramsResult = buildingParamsSchema.safeParse(params);
    if (!paramsResult.success) {
      return { 
        success: false, 
        error: `Paramètres invalides: ${paramsResult.error.issues.map(e => e.message).join(", ")}` 
      };
    }

    // Valider les derived avec Zod
    const derivedResult = buildingDerivedSchema.safeParse(derived);
    if (!derivedResult.success) {
      return { 
        success: false, 
        error: `Valeurs dérivées invalides: ${derivedResult.error.issues.map(e => e.message).join(", ")}` 
      };
    }

    // Vérifier que le projet existe
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, status, org_id")
      .eq("id", projectId)
      .single();

    if (projectError || !project) {
      return { success: false, error: "Projet non trouvé" };
    }

    // Vérifier le statut du projet
    if (project.status !== "draft" && project.status !== "returned") {
      return { 
        success: false, 
        error: "Le projet ne peut pas être modifié dans son statut actuel" 
      };
    }

    // Upsert la config (insert ou update)
    const { data, error } = await supabase
      .from("building_configs")
      .upsert({
        project_id: projectId,
        params: paramsResult.data,
        derived: derivedResult.data,
      }, {
        onConflict: "project_id",
      })
      .select()
      .single();

    if (error) {
      console.error("Erreur upsert building_configs:", error);
      return { success: false, error: error.message };
    }

    // ── Mettre à jour les coûts bâtiment dans finance_state si elle existe ──
    try {
      const { data: proj } = await supabase
        .from("projects")
        .select("finance_state")
        .eq("id", projectId)
        .single();

      if (proj?.finance_state) {
        const fs = proj.finance_state as Record<string, unknown>;
        const costs = fs.costs as Record<string, number> | undefined;
        if (costs) {
          const costResult = lookupBuildingCost(
            paramsResult.data.type,
            paramsResult.data.width,
            paramsResult.data.nbSpans,
          );
          if (costResult) {
            const charpente = Math.round(costResult.tarif * 0.5);
            const couverture = Math.round(costResult.tarif * 0.25);
            const fondations = costResult.tarif - charpente - couverture;
            // Mettre à jour aussi installation + fraisCommerciaux selon kWc
            const kwc = derivedResult.data.powerKwc;
            const updatedCosts = {
              ...costs,
              charpente,
              couverture,
              fondations,
              installation: Math.round(500 * kwc),
              fraisCommerciaux: Math.round(50 * kwc),
            };
            await supabase
              .from("projects")
              .update({ finance_state: { ...fs, costs: updatedCosts } })
              .eq("id", projectId);
          }
        }
      }
    } catch (e) {
      // Non-bloquant : si la mise à jour finance échoue, on ne bloque pas le save bâtiment
      console.warn("[saveBuildingConfig] Mise à jour finance_state échouée:", e);
    }

    revalidatePath(`/projects/${projectId}`);
    
    return { success: true, data: data as BuildingConfigRow };
  } catch (e) {
    console.error("Exception saveBuildingConfig:", e);
    return { success: false, error: "Erreur lors de la sauvegarde de la config" };
  }
}

// ============================================================================
// LOCALISATION / IMPLANTATION
// ============================================================================

interface LocationData {
  centroidLat: number;
  centroidLon: number;
  orientationDeg: number;
  azimuthPanADeg: number;
  azimuthPanBDeg: number | null;
  polygon: { type: "Polygon"; coordinates: [number, number][][] };
}

/**
 * Sauvegarde la localisation et l'orientation du bâtiment
 */
export async function saveBuildingLocation(
  projectId: string,
  location: LocationData
): Promise<ActionResult<{ updated: boolean }>> {
  try {
    const profile = await getUserProfile();
    if (!profile) {
      return { success: false, error: "Non authentifié" };
    }

    const supabase = await createClient();

    // Vérifier que le projet existe et appartient à l'org
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, status")
      .eq("id", projectId)
      .single();

    if (projectError || !project) {
      return { success: false, error: "Projet non trouvé" };
    }

    // Vérifier le statut du projet
    if (project.status !== "draft" && project.status !== "returned") {
      return { 
        success: false, 
        error: "Le projet ne peut pas être modifié dans son statut actuel" 
      };
    }

    // Mettre à jour la config existante
    const { error } = await supabase
      .from("building_configs")
      .update({
        centroid_lat: location.centroidLat,
        centroid_lon: location.centroidLon,
        orientation_deg: location.orientationDeg,
        azimuth_pan_a_deg: location.azimuthPanADeg,
        azimuth_pan_b_deg: location.azimuthPanBDeg,
        polygon: location.polygon,
        updated_at: new Date().toISOString(),
      })
      .eq("project_id", projectId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath(`/projects/${projectId}`);
    
    return { success: true, data: { updated: true } };
  } catch {
    return { success: false, error: "Erreur lors de la sauvegarde de la localisation" };
  }
}

// ============================================================================
// SAUVEGARDE DES DONNÉES PARCELLAIRES (CACHE)
// ============================================================================

/**
 * Sauvegarde les données parcellaires dans building_configs.parcelle_data.
 * Appelé depuis la carte après le chargement parcellaire,
 * pour que la synthèse puisse les lire directement sans rappeler les API.
 */
export async function saveParcelleData(
  projectId: string,
  parcelleData: ParcelleInfo,
): Promise<ActionResult<{ updated: boolean }>> {
  try {
    const profile = await getUserProfile();
    if (!profile) {
      return { success: false, error: "Non authentifié" };
    }

    const supabase = await createClient();

    const { error } = await supabase
      .from("building_configs")
      .update({
        parcelle_data: parcelleData as unknown as Record<string, unknown>,
        updated_at: new Date().toISOString(),
      })
      .eq("project_id", projectId);

    if (error) {
      console.error("[saveParcelleData] Erreur:", error);
      return { success: false, error: error.message };
    }

    return { success: true, data: { updated: true } };
  } catch (e) {
    console.error("[saveParcelleData] Exception:", e);
    return { success: false, error: "Erreur lors de la sauvegarde des données parcellaires" };
  }
}
