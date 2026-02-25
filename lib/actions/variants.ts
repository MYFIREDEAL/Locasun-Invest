"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { BuildingType } from "@/lib/types/building";
import type { BuildingVariant } from "@/lib/types/building-variants";
import { DEFAULT_VARIANTS, getVariantKey, type VariantKey } from "@/lib/types/building-variants";

// Type pour les variantes en base
interface DbVariant {
  id: string;
  org_id: string | null;
  type: string;
  width: number;
  height_sabliere_left: number;
  height_sabliere_right: number;
  height_faitage: number;
  faitage_position: number | null;
  poteau_position: number | null;
  zone_left: number | null;
  zone_right: number | null;
}

// Convertir DB -> BuildingVariant
function dbToVariant(db: DbVariant): BuildingVariant {
  return {
    type: db.type as BuildingType,
    width: db.width,
    heightSabliereLeft: db.height_sabliere_left,
    heightSabliereRight: db.height_sabliere_right,
    heightFaitage: db.height_faitage,
    faitagePositionFromLeft: db.faitage_position ?? undefined,
    poteauPositionFromLeft: db.poteau_position ?? undefined,
    zoneLeft: db.zone_left ?? undefined,
    zoneRight: db.zone_right ?? undefined,
  };
}

// Convertir BuildingVariant -> DB insert format
function variantToDb(variant: BuildingVariant, orgId: string | null = null) {
  return {
    org_id: orgId,
    type: variant.type,
    width: variant.width,
    height_sabliere_left: variant.heightSabliereLeft,
    height_sabliere_right: variant.heightSabliereRight,
    height_faitage: variant.heightFaitage,
    faitage_position: variant.faitagePositionFromLeft ?? null,
    poteau_position: variant.poteauPositionFromLeft ?? null,
    zone_left: variant.zoneLeft ?? null,
    zone_right: variant.zoneRight ?? null,
  };
}

/**
 * Récupérer toutes les variantes (globales + org)
 */
export async function getVariants(): Promise<Record<VariantKey, BuildingVariant>> {
  const supabase = await createClient();
  
  // Récupérer les variantes globales et de l'org de l'utilisateur
  const { data, error } = await supabase
    .from("building_variants")
    .select("*")
    .order("type", { ascending: true })
    .order("width", { ascending: true });
  
  if (error) {
    console.error("Erreur chargement variantes:", error);
    // Fallback sur les variantes par défaut
    return { ...DEFAULT_VARIANTS };
  }
  
  // Convertir en Record<VariantKey, BuildingVariant>
  const variants: Record<VariantKey, BuildingVariant> = { ...DEFAULT_VARIANTS };
  
  for (const row of data as DbVariant[]) {
    const key = getVariantKey(row.type as BuildingType, row.width);
    variants[key] = dbToVariant(row);
  }
  
  return variants;
}

/**
 * Récupérer une variante spécifique
 */
export async function getVariantFromDb(
  type: BuildingType, 
  width: number
): Promise<BuildingVariant | null> {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from("building_variants")
    .select("*")
    .eq("type", type)
    .eq("width", width)
    .maybeSingle();
  
  if (error || !data) {
    // Fallback sur DEFAULT_VARIANTS
    const key = getVariantKey(type, width);
    return DEFAULT_VARIANTS[key] ?? null;
  }
  
  return dbToVariant(data as DbVariant);
}

/**
 * Mettre à jour ou créer une variante
 */
export async function upsertVariant(
  variant: BuildingVariant
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  
  // Pour l'instant, on met à jour les variantes globales (org_id = NULL)
  // TODO: gérer les variantes par organisation
  
  const { error } = await supabase
    .from("building_variants")
    .upsert(
      variantToDb(variant, null),
      { onConflict: "org_id,type,width" }
    );
  
  if (error) {
    console.error("Erreur sauvegarde variante:", error);
    return { success: false, error: error.message };
  }
  
  revalidatePath("/admin/variants");
  return { success: true };
}

/**
 * Mettre à jour plusieurs variantes
 */
export async function upsertVariants(
  variants: BuildingVariant[]
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  
  const dbVariants = variants.map((v) => variantToDb(v, null));
  
  const { error } = await supabase
    .from("building_variants")
    .upsert(dbVariants, { onConflict: "org_id,type,width" });
  
  if (error) {
    console.error("Erreur sauvegarde variantes:", error);
    return { success: false, error: error.message };
  }
  
  revalidatePath("/admin/variants");
  return { success: true };
}

/**
 * Réinitialiser les variantes globales aux valeurs par défaut
 */
export async function resetVariantsToDefault(): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  
  // Supprimer toutes les variantes globales
  const { error: deleteError } = await supabase
    .from("building_variants")
    .delete()
    .is("org_id", null);
  
  if (deleteError) {
    console.error("Erreur suppression variantes:", deleteError);
    return { success: false, error: deleteError.message };
  }
  
  // Réinsérer les variantes par défaut
  const defaultVariants = Object.values(DEFAULT_VARIANTS);
  const dbVariants = defaultVariants.map((v) => variantToDb(v, null));
  
  const { error: insertError } = await supabase
    .from("building_variants")
    .insert(dbVariants);
  
  if (insertError) {
    console.error("Erreur réinsertion variantes:", insertError);
    return { success: false, error: insertError.message };
  }
  
  revalidatePath("/admin/variants");
  return { success: true };
}
