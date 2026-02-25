"use server";

/**
 * Actions PVGIS - Server-only
 * Orchestration du calcul PVGIS avec cache DB per-pan (SHA-256)
 */

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { 
  PvgisResult,
  PvgisResultRow,
  PvgisInputsSnapshot,
  PvgisPanResult,
  PvgisPanParams,
} from "@/lib/types/pvgis";
import { computeInputHash, canonicalizePanParams } from "@/lib/types/pvgis";
import { computePanParamsHash } from "@/lib/utils/pvgis-hash";
import { 
  createInputsSnapshot,
  callPvgisForPan,
  type PanInput,
} from "@/server/services/pvgis";
import type { BuildingConfigRow } from "@/lib/types/building";
import { TYPE_CONSTRAINTS } from "@/lib/types/building";

// ============================================================================
// TYPES
// ============================================================================

type ActionResult<T> = 
  | { success: true; data: T }
  | { success: false; error: string };

// Schema Zod pour l'input du calcul PVGIS
const calculatePvgisSchema = z.object({
  projectId: z.string().uuid("ID projet invalide"),
  forceRecalculate: z.boolean().optional().default(false),
});

export type CalculatePvgisInput = z.infer<typeof calculatePvgisSchema>;

// ============================================================================
// HELPERS
// ============================================================================

async function getUserProfile() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("user_id, org_id, role")
    .eq("user_id", user.id)
    .single();

  if (profileError) {
    // En dev, créer un profil temporaire si manquant
    if (process.env.NODE_ENV === "development") {
      return { id: user.id, org_id: null, role: "pro" as const };
    }
    return null;
  }

  return { id: profile.user_id, org_id: profile.org_id, role: profile.role };
}

// ============================================================================
// LECTURE RÉSULTAT PVGIS
// ============================================================================

/**
 * Récupère le dernier résultat PVGIS pour un projet
 */
export async function getPvgisResult(
  projectId: string
): Promise<ActionResult<PvgisResult | null>> {
  try {
    const profile = await getUserProfile();
    if (!profile) {
      return { success: false, error: "Non authentifié" };
    }

    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from("pvgis_results")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return { success: false, error: error.message };
    }

    if (!data) {
      return { success: true, data: null };
    }

    // Le résultat est stocké en JSONB
    const row = data as PvgisResultRow;
    return { success: true, data: row.result };
  } catch {
    return { success: false, error: "Erreur lors de la récupération du résultat PVGIS" };
  }
}

// ============================================================================
// CACHE PER-PAN : getOrComputePvgis
// ============================================================================

/**
 * Cache-first PVGIS pour un pan donné.
 *
 * 1. Construit les PvgisPanParams canoniques
 * 2. Calcule le SHA-256
 * 3. Query DB par (project_id, pan) → si params_hash identique → cache hit
 * 4. Sinon → appel PVGIS API → upsert dans pvgis_cache → retourne résultat
 */
async function getOrComputePvgis(
  projectId: string,
  pan: PanInput,
  lat: number,
  lon: number,
  lossPercent: number,
): Promise<{ success: true; data: PvgisPanResult; recomputed: boolean } | { success: false; error: string }> {
  const supabase = await createClient();

  // 1. Params canoniques + hash
  const panParams: PvgisPanParams = canonicalizePanParams({
    lat,
    lon,
    azimuthDeg: pan.azimuthDeg,
    tiltDeg: pan.tiltDeg,
    kwc: pan.peakPowerKwc,
    lossPercent,
  });
  const hash = computePanParamsHash(panParams);

  // 2. Lookup cache DB
  const { data: cached } = await supabase
    .from("pvgis_cache")
    .select("params_hash, result_json")
    .eq("project_id", projectId)
    .eq("pan", pan.panId)
    .maybeSingle();

  if (cached && cached.params_hash === hash) {
    // Cache hit — même params → retourner directement
    return { success: true, data: cached.result_json as unknown as PvgisPanResult, recomputed: false };
  }

  // 3. Cache miss ou stale → appeler PVGIS
  const apiResult = await callPvgisForPan(
    { lat, lon, lossPercent },
    pan,
  );

  if (!apiResult.success) {
    return { success: false, error: apiResult.error };
  }

  const panResult = apiResult.data;

  // 4. Upsert dans pvgis_cache
  const { error: upsertError } = await supabase
    .from("pvgis_cache")
    .upsert(
      {
        project_id: projectId,
        pan: pan.panId,
        params_hash: hash,
        params_json: panParams as unknown as Record<string, unknown>,
        result_json: panResult as unknown as Record<string, unknown>,
        annual_kwh: panResult.annualKwh,
        specific_kwh_kwc: panResult.annualKwhPerKwc,
        monthly_kwh: panResult.monthlyKwh,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "project_id,pan" },
    );

  if (upsertError && process.env.NODE_ENV === "development") {
    console.error("Erreur upsert pvgis_cache:", upsertError);
  }

  return { success: true, data: panResult, recomputed: true };
}

// ============================================================================
// CALCUL PVGIS (refactoré — utilise getOrComputePvgis per-pan)
// ============================================================================

export type CalculatePvgisResult =
  | { success: true; data: PvgisResult; recomputed: boolean }
  | { success: false; error: string };

/**
 * Calcule la production PVGIS pour un projet
 * - Lit la config bâtiment et l'implantation
 * - Pour chaque pan, utilise getOrComputePvgis (cache SHA-256)
 * - Agrège les résultats
 * - Stocke aussi dans l'ancienne table pvgis_results (compatibilité)
 * - Retourne `recomputed: true` si au moins un pan a été recalculé (cache miss)
 */
export async function calculateProjectPvgis(
  input: unknown
): Promise<CalculatePvgisResult> {
  // Validation Zod
  const parsed = calculatePvgisSchema.safeParse(input);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    return { success: false, error: firstError?.message ?? "Données invalides" };
  }

  const { projectId } = parsed.data;

  try {
    const profile = await getUserProfile();
    if (!profile) {
      return { success: false, error: "Non authentifié" };
    }

    const supabase = await createClient();

    // 1. Récupérer la config du bâtiment
    const { data: config, error: configError } = await supabase
      .from("building_configs")
      .select("*")
      .eq("project_id", projectId)
      .single();

    if (configError || !config) {
      return { success: false, error: "Configuration bâtiment non trouvée" };
    }

    const buildingConfig = config as BuildingConfigRow;

    // 2. Vérifier que l'implantation est configurée
    if (!buildingConfig.centroid_lat || !buildingConfig.centroid_lon) {
      return { success: false, error: "Implantation géographique non configurée" };
    }

    if (buildingConfig.azimuth_pan_a_deg === null) {
      return { success: false, error: "Orientation du bâtiment non configurée" };
    }

    // 3. Extraire les données nécessaires
    const lat = buildingConfig.centroid_lat;
    const lon = buildingConfig.centroid_lon;
    const params = buildingConfig.params;
    const derived = buildingConfig.derived;

    // Vérifier le type pour savoir si on a 1 ou 2 pans
    const constraints = TYPE_CONSTRAINTS[params.type];
    const hasTwoPans = constraints.hasTwoPans;

    // 4. Construire les inputs pour chaque pan PV
    const pans: PanInput[] = [];

    // Pan A (toujours présent si PV)
    const kwcPanA = derived.powerKwcPanA ?? 0;
    if (kwcPanA > 0) {
      pans.push({
        panId: "A",
        azimuthDeg: buildingConfig.azimuth_pan_a_deg,
        tiltDeg: derived.slopeAngle,
        peakPowerKwc: kwcPanA,
      });
    }

    // Pan B (si 2 pans et PV sur ce pan)
    if (hasTwoPans && buildingConfig.azimuth_pan_b_deg !== null) {
      const kwcPanB = derived.powerKwcPanB ?? 0;
      if (kwcPanB > 0) {
        pans.push({
          panId: "B",
          azimuthDeg: buildingConfig.azimuth_pan_b_deg,
          tiltDeg: derived.slopeAngle,
          peakPowerKwc: kwcPanB,
        });
      }
    }

    if (pans.length === 0) {
      return { success: false, error: "Aucun pan PV configuré (kWc = 0)" };
    }

    const lossPercent = 14; // Pertes système standard

    // 5. Pour chaque pan, cache-first via getOrComputePvgis
    const panResults: PvgisPanResult[] = [];
    let anyRecomputed = false;

    for (const pan of pans) {
      const panRes = await getOrComputePvgis(
        projectId,
        pan,
        lat,
        lon,
        lossPercent,
      );

      if (!panRes.success) {
        return {
          success: false,
          error: `Erreur PVGIS pour pan ${pan.panId}: ${panRes.error}`,
        };
      }

      panResults.push(panRes.data);
      if (panRes.recomputed) anyRecomputed = true;
    }

    // 6. Agréger les résultats
    const totalAnnualKwh = panResults.reduce((s, p) => s + p.annualKwh, 0);
    const totalPeakPowerKwc = panResults.reduce((s, p) => s + p.peakPowerKwc, 0);
    const monthlyKwh: number[] = [];
    for (let i = 0; i < 12; i++) {
      monthlyKwh.push(panResults.reduce((s, p) => s + (p.monthlyKwh[i] ?? 0), 0));
    }

    const result: PvgisResult = {
      projectId,
      calculatedAt: new Date().toISOString(),
      location: { lat, lon },
      pans: panResults,
      totals: {
        annualKwh: totalAnnualKwh,
        peakPowerKwc: totalPeakPowerKwc,
        annualKwhPerKwc: totalPeakPowerKwc > 0
          ? Math.round(totalAnnualKwh / totalPeakPowerKwc)
          : 0,
        monthlyKwh,
      },
    };

    // 7. Stocker aussi dans l'ancienne table pvgis_results (compatibilité Synthèse)
    const inputsSnapshot = createInputsSnapshot({ lat, lon, pans, lossPercent });
    const inputHash = computeInputHash(inputsSnapshot);

    const { error: upsertError } = await supabase
      .from("pvgis_results")
      .upsert({
        project_id: projectId,
        input_hash: inputHash,
        inputs: inputsSnapshot as unknown as Record<string, unknown>,
        result: result as unknown as Record<string, unknown>,
      }, {
        onConflict: "project_id,input_hash",
      });

    if (upsertError && process.env.NODE_ENV === "development") {
      console.error("Erreur stockage pvgis_results:", upsertError);
    }

    revalidatePath(`/projects/${projectId}`);

    return { success: true, data: result, recomputed: anyRecomputed };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    return { success: false, error: `Erreur calcul PVGIS: ${message}` };
  }
}

// ============================================================================
// INVALIDATION CACHE
// ============================================================================

/**
 * Invalide le cache PVGIS pour un projet
 * À appeler quand la config ou l'implantation change
 */
export async function invalidatePvgisCache(
  projectId: string
): Promise<ActionResult<{ deleted: number }>> {
  try {
    const profile = await getUserProfile();
    if (!profile) {
      return { success: false, error: "Non authentifié" };
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from("pvgis_results")
      .delete()
      .eq("project_id", projectId)
      .select("id");

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: { deleted: data?.length ?? 0 } };
  } catch {
    return { success: false, error: "Erreur lors de l'invalidation du cache" };
  }
}
