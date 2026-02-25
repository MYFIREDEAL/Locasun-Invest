"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { BuildingType } from "@/lib/types/building";
import { ALL_SERIES_DEFAULT } from "@/lib/data/building-pricing";

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

// ============================================================================
// TYPES
// ============================================================================

export interface DbPricingRow {
  id: string;
  org_id: string | null;
  type: string;
  width: number;
  spacing: number;
  nb_spans: number;
  kwc: number;
  tarif: number;
}

export interface PricingSeriesData {
  type: BuildingType;
  width: number;
  spacing: number;
  entries: Array<{
    id?: string;        // DB id (undefined for new entries)
    nbSpans: number;
    kwc: number;
    tarif: number;
  }>;
}

// ============================================================================
// READ — Charger toute la grille tarifaire
// ============================================================================

export async function getPricingGrid(): Promise<PricingSeriesData[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("building_pricing")
    .select("*")
    .is("org_id", null)
    .order("type")
    .order("width")
    .order("nb_spans");

  if (error) {
    console.error("Erreur chargement pricing:", error);
    // Fallback sur les données statiques
    return ALL_SERIES_DEFAULT.map((s) => ({
      type: s.type,
      width: s.width,
      spacing: s.spacing,
      entries: s.entries.map((e) => ({
        nbSpans: e.nbSpans,
        kwc: e.kwc,
        tarif: e.tarif,
      })),
    }));
  }

  // Grouper par type+width
  const grouped = new Map<string, PricingSeriesData>();

  for (const row of data as DbPricingRow[]) {
    const key = `${row.type}_${row.width}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        type: row.type as BuildingType,
        width: row.width,
        spacing: row.spacing,
        entries: [],
      });
    }
    grouped.get(key)!.entries.push({
      id: row.id,
      nbSpans: row.nb_spans,
      kwc: row.kwc,
      tarif: row.tarif,
    });
  }

  // Si aucune donnée en base, fallback sur statique
  if (grouped.size === 0) {
    return ALL_SERIES_DEFAULT.map((s) => ({
      type: s.type,
      width: s.width,
      spacing: s.spacing,
      entries: s.entries.map((e) => ({
        nbSpans: e.nbSpans,
        kwc: e.kwc,
        tarif: e.tarif,
      })),
    }));
  }

  return Array.from(grouped.values());
}

// ============================================================================
// UPDATE — Modifier le tarif d'une entrée existante
// ============================================================================

export async function updatePricingEntry(
  id: string,
  tarif: number,
): Promise<ActionResult<null>> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("building_pricing")
    .update({ tarif, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    console.error("Erreur update pricing:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/admin/variants");
  return { success: true, data: null };
}

// ============================================================================
// UPSERT — Ajouter ou modifier une entrée (par type+width+nbSpans)
// ============================================================================

export async function upsertPricingEntry(
  type: BuildingType,
  width: number,
  nbSpans: number,
  kwc: number,
  tarif: number,
  spacing: number = 7.5,
): Promise<ActionResult<null>> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("building_pricing")
    .upsert(
      {
        org_id: null,
        type,
        width,
        spacing,
        nb_spans: nbSpans,
        kwc,
        tarif,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "org_id,type,width,nb_spans" },
    );

  if (error) {
    console.error("Erreur upsert pricing:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/admin/variants");
  return { success: true, data: null };
}

// ============================================================================
// DELETE — Supprimer une entrée
// ============================================================================

export async function deletePricingEntry(
  id: string,
): Promise<ActionResult<null>> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("building_pricing")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Erreur delete pricing:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/admin/variants");
  return { success: true, data: null };
}

// ============================================================================
// RESET — Réinitialiser toute la grille aux valeurs par défaut
// ============================================================================

export async function resetPricingToDefault(): Promise<ActionResult<null>> {
  const supabase = await createClient();

  // Supprimer toutes les entrées globales
  const { error: deleteError } = await supabase
    .from("building_pricing")
    .delete()
    .is("org_id", null);

  if (deleteError) {
    console.error("Erreur delete all pricing:", deleteError);
    return { success: false, error: deleteError.message };
  }

  // Réinsérer les valeurs par défaut
  const rows = ALL_SERIES_DEFAULT.flatMap((s) =>
    s.entries.map((e) => ({
      org_id: null,
      type: s.type,
      width: s.width,
      spacing: s.spacing,
      nb_spans: e.nbSpans,
      kwc: e.kwc,
      tarif: e.tarif,
    })),
  );

  const { error: insertError } = await supabase
    .from("building_pricing")
    .insert(rows);

  if (insertError) {
    console.error("Erreur insert default pricing:", insertError);
    return { success: false, error: insertError.message };
  }

  revalidatePath("/admin/variants");
  return { success: true, data: null };
}
