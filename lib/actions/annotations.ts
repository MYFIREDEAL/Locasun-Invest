"use server";

import { createClient } from "@/lib/supabase/server";
import type {
  MapAnnotationRow,
  CreatePointInput,
  CreateLineInput,
  CreateAnchorInput,
  UpdatePointPositionInput,
  UpdateLineGeometryInput,
  UpdateAnnotationMetadataInput,
} from "@/lib/types/annotations";
import {
  createPointAnnotationSchema,
  createLineAnnotationSchema,
  createAnchorAnnotationSchema,
  updatePointPositionSchema,
  updateLineGeometrySchema,
  updateAnnotationMetadataSchema,
} from "@/lib/validators/annotation";

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

// ============================================================================
// LECTURE
// ============================================================================

/**
 * Récupère toutes les annotations d'un projet.
 */
export async function getAnnotations(
  projectId: string
): Promise<ActionResult<MapAnnotationRow[]>> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: "Non authentifié" };
    }

    const { data, error } = await supabase
      .from("map_annotations")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: (data ?? []) as MapAnnotationRow[] };
  } catch {
    return { success: false, error: "Erreur lors de la récupération des annotations" };
  }
}

// ============================================================================
// CRÉATION
// ============================================================================

/**
 * Crée un point d'annotation (icône technique).
 */
export async function createPointAnnotation(
  input: CreatePointInput
): Promise<ActionResult<MapAnnotationRow>> {
  try {
    const parsed = createPointAnnotationSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues.map((e) => e.message).join(", "),
      };
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: "Non authentifié" };
    }

    const { data, error } = await supabase
      .from("map_annotations")
      .insert({
        project_id: parsed.data.projectId,
        type: "point" as const,
        subtype: parsed.data.subtype,
        geometry: {
          type: "Point",
          coordinates: [parsed.data.lng, parsed.data.lat],
        },
        metadata: parsed.data.metadata ?? null,
      })
      .select("*")
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data as MapAnnotationRow };
  } catch {
    return { success: false, error: "Erreur lors de la création du point" };
  }
}

/**
 * Crée une ligne d'annotation (câble).
 */
export async function createLineAnnotation(
  input: CreateLineInput
): Promise<ActionResult<MapAnnotationRow>> {
  try {
    const parsed = createLineAnnotationSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues.map((e) => e.message).join(", "),
      };
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: "Non authentifié" };
    }

    const { data, error } = await supabase
      .from("map_annotations")
      .insert({
        project_id: parsed.data.projectId,
        type: "line" as const,
        subtype: "cable" as const,
        geometry: {
          type: "LineString",
          coordinates: parsed.data.coordinates,
        },
        linked_start_id: parsed.data.linkedStartId,
        linked_end_id: parsed.data.linkedEndId,
        metadata: parsed.data.metadata ?? null,
      })
      .select("*")
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data as MapAnnotationRow };
  } catch {
    return { success: false, error: "Erreur lors de la création de la ligne" };
  }
}

/**
 * Crée ou met à jour l'ancre bâtiment pour un projet.
 * Upsert: si une ancre existe déjà, on met à jour sa géométrie.
 */
export async function upsertBuildingAnchor(
  input: CreateAnchorInput
): Promise<ActionResult<MapAnnotationRow>> {
  try {
    const parsed = createAnchorAnnotationSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues.map((e) => e.message).join(", "),
      };
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: "Non authentifié" };
    }

    // Check if anchor already exists
    const { data: existing } = await supabase
      .from("map_annotations")
      .select("id")
      .eq("project_id", parsed.data.projectId)
      .eq("type", "anchor")
      .eq("subtype", "batiment")
      .maybeSingle();

    const geometry = {
      type: "Point" as const,
      coordinates: [parsed.data.lng, parsed.data.lat] as [number, number],
    };

    if (existing) {
      // Update existing anchor
      const { data, error } = await supabase
        .from("map_annotations")
        .update({ geometry })
        .eq("id", existing.id)
        .select("*")
        .single();

      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true, data: data as MapAnnotationRow };
    }

    // Create new anchor
    const { data, error } = await supabase
      .from("map_annotations")
      .insert({
        project_id: parsed.data.projectId,
        type: "anchor" as const,
        subtype: "batiment" as const,
        geometry,
      })
      .select("*")
      .single();

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true, data: data as MapAnnotationRow };
  } catch {
    return { success: false, error: "Erreur lors de la création de l'ancre" };
  }
}

// ============================================================================
// MISE À JOUR
// ============================================================================

/**
 * Déplace un point d'annotation.
 */
export async function updatePointPosition(
  input: UpdatePointPositionInput
): Promise<ActionResult<MapAnnotationRow>> {
  try {
    const parsed = updatePointPositionSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues.map((e) => e.message).join(", "),
      };
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: "Non authentifié" };
    }

    const { data, error } = await supabase
      .from("map_annotations")
      .update({
        geometry: {
          type: "Point",
          coordinates: [parsed.data.lng, parsed.data.lat],
        },
      })
      .eq("id", parsed.data.id)
      .select("*")
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data as MapAnnotationRow };
  } catch {
    return { success: false, error: "Erreur lors du déplacement du point" };
  }
}

/**
 * Met à jour la géométrie d'une ligne.
 */
export async function updateLineGeometry(
  input: UpdateLineGeometryInput
): Promise<ActionResult<MapAnnotationRow>> {
  try {
    const parsed = updateLineGeometrySchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues.map((e) => e.message).join(", "),
      };
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: "Non authentifié" };
    }

    const { data, error } = await supabase
      .from("map_annotations")
      .update({
        geometry: {
          type: "LineString",
          coordinates: parsed.data.coordinates,
        },
      })
      .eq("id", parsed.data.id)
      .select("*")
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data as MapAnnotationRow };
  } catch {
    return { success: false, error: "Erreur lors de la mise à jour de la ligne" };
  }
}

/**
 * Met à jour les metadata (note) d'une annotation.
 */
export async function updateAnnotationMetadata(
  input: UpdateAnnotationMetadataInput
): Promise<ActionResult<MapAnnotationRow>> {
  try {
    const parsed = updateAnnotationMetadataSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues.map((e) => e.message).join(", "),
      };
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: "Non authentifié" };
    }

    const { data, error } = await supabase
      .from("map_annotations")
      .update({ metadata: parsed.data.metadata })
      .eq("id", parsed.data.id)
      .select("*")
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data as MapAnnotationRow };
  } catch {
    return { success: false, error: "Erreur lors de la mise à jour des metadata" };
  }
}

// ============================================================================
// SUPPRESSION
// ============================================================================

/**
 * Supprime une annotation (sauf anchor building).
 */
export async function deleteAnnotation(
  id: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: "Non authentifié" };
    }

    // Vérifier que ce n'est pas une ancre bâtiment
    const { data: annotation } = await supabase
      .from("map_annotations")
      .select("type, subtype")
      .eq("id", id)
      .single();

    if (annotation?.type === "anchor" && annotation?.subtype === "batiment") {
      return { success: false, error: "L'ancre bâtiment ne peut pas être supprimée" };
    }

    const { error } = await supabase
      .from("map_annotations")
      .delete()
      .eq("id", id);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: { id } };
  } catch {
    return { success: false, error: "Erreur lors de la suppression" };
  }
}

/**
 * Met à jour les extrémités des lignes connectées à un point
 * quand ce point est déplacé. Appellé côté client après updatePointPosition.
 */
export async function updateLinkedLines(
  annotationId: string,
  newLng: number,
  newLat: number
): Promise<ActionResult<MapAnnotationRow[]>> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: "Non authentifié" };
    }

    // Find all lines linked to this annotation
    const { data: linkedLines, error: fetchError } = await supabase
      .from("map_annotations")
      .select("*")
      .eq("type", "line")
      .or(`linked_start_id.eq.${annotationId},linked_end_id.eq.${annotationId}`);

    if (fetchError) {
      return { success: false, error: fetchError.message };
    }

    if (!linkedLines || linkedLines.length === 0) {
      return { success: true, data: [] };
    }

    const updated: MapAnnotationRow[] = [];

    for (const line of linkedLines) {
      const geom = line.geometry as { type: string; coordinates: [number, number][] };
      if (geom.type !== "LineString" || !geom.coordinates || geom.coordinates.length < 2) continue;

      const coords = [...geom.coordinates];

      if (line.linked_start_id === annotationId) {
        coords[0] = [newLng, newLat];
      }
      if (line.linked_end_id === annotationId) {
        coords[coords.length - 1] = [newLng, newLat];
      }

      const { data: updatedLine, error: updateError } = await supabase
        .from("map_annotations")
        .update({
          geometry: { type: "LineString", coordinates: coords },
        })
        .eq("id", line.id)
        .select("*")
        .single();

      if (!updateError && updatedLine) {
        updated.push(updatedLine as MapAnnotationRow);
      }
    }

    return { success: true, data: updated };
  } catch {
    return { success: false, error: "Erreur lors de la mise à jour des lignes liées" };
  }
}
