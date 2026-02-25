import { z } from "zod";
import { ANNOTATION_TYPES, POINT_SUBTYPES, LINE_SUBTYPES, ANCHOR_SUBTYPES } from "@/lib/types/annotations";

// All valid subtypes
const allSubtypes = [...POINT_SUBTYPES, ...LINE_SUBTYPES, ...ANCHOR_SUBTYPES] as const;

// ============================================================================
// GEOMETRY SCHEMAS
// ============================================================================

const geoJsonPointSchema = z.object({
  type: z.literal("Point"),
  coordinates: z.tuple([z.number(), z.number()]), // [lng, lat]
});

const geoJsonLineStringSchema = z.object({
  type: z.literal("LineString"),
  coordinates: z
    .array(z.tuple([z.number(), z.number()]))
    .min(2, "Une ligne doit avoir au moins 2 points"),
});

const annotationGeometrySchema = z.discriminatedUnion("type", [
  geoJsonPointSchema,
  geoJsonLineStringSchema,
]);

// ============================================================================
// CREATE SCHEMAS
// ============================================================================

export const createPointAnnotationSchema = z.object({
  projectId: z.string().uuid("project_id invalide"),
  subtype: z.enum(POINT_SUBTYPES),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const createLineAnnotationSchema = z.object({
  projectId: z.string().uuid("project_id invalide"),
  coordinates: z
    .array(z.tuple([z.number(), z.number()]))
    .min(2, "Une ligne doit avoir au moins 2 points"),
  linkedStartId: z.string().uuid().nullable(),
  linkedEndId: z.string().uuid().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const createAnchorAnnotationSchema = z.object({
  projectId: z.string().uuid("project_id invalide"),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

// ============================================================================
// UPDATE SCHEMAS
// ============================================================================

export const updatePointPositionSchema = z.object({
  id: z.string().uuid(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const updateLineGeometrySchema = z.object({
  id: z.string().uuid(),
  coordinates: z
    .array(z.tuple([z.number(), z.number()]))
    .min(2, "Une ligne doit avoir au moins 2 points"),
});

export const updateAnnotationMetadataSchema = z.object({
  id: z.string().uuid(),
  metadata: z.record(z.string(), z.unknown()),
});

// ============================================================================
// FULL ROW SCHEMA (for parsing DB results)
// ============================================================================

export const mapAnnotationRowSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  type: z.enum(ANNOTATION_TYPES),
  subtype: z.enum(allSubtypes),
  geometry: annotationGeometrySchema,
  linked_start_id: z.string().uuid().nullable(),
  linked_end_id: z.string().uuid().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  created_at: z.string(),
});
