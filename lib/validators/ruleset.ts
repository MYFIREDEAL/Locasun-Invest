import { z } from "zod";

// ============================================================================
// STRUCTURE DU RULESET
// Un ruleset définit les valeurs possibles pour configurer un bâtiment
// ============================================================================

// Options pour un paramètre de type liste
const rulesetOptionSchema = z.object({
  value: z.union([z.string(), z.number()]),
  label: z.string(),
  default: z.boolean().optional(),
});

// Paramètre de configuration
const rulesetParamSchema = z.object({
  id: z.string(),
  label: z.string(),
  type: z.enum(["select", "number", "boolean"]),
  required: z.boolean().optional(),
  options: z.array(rulesetOptionSchema).optional(), // Pour type "select"
  min: z.number().optional(), // Pour type "number"
  max: z.number().optional(), // Pour type "number"
  step: z.number().optional(), // Pour type "number"
  unit: z.string().optional(), // Ex: "m", "°", "kWc"
  defaultValue: z.union([z.string(), z.number(), z.boolean()]).optional(),
});

// Famille de bâtiment (hangar_agricole, maison_individuelle, etc.)
const rulesetFamilySchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string().optional(),
  params: z.array(rulesetParamSchema),
});

// Structure complète d'un ruleset
export const rulesetJsonSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  families: z.array(rulesetFamilySchema),
});

export type RulesetJson = z.infer<typeof rulesetJsonSchema>;
export type RulesetFamily = z.infer<typeof rulesetFamilySchema>;
export type RulesetParam = z.infer<typeof rulesetParamSchema>;
export type RulesetOption = z.infer<typeof rulesetOptionSchema>;

// ============================================================================
// ENTITÉ RULESET (table rulesets)
// ============================================================================

export interface Ruleset {
  id: string;
  org_id: string | null;
  version: string;
  name?: string;
  json: RulesetJson;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RulesetListItem {
  id: string;
  org_id: string | null;
  version: string;
  name?: string;
  is_active: boolean;
  created_at: string;
}

// ============================================================================
// SCHÉMAS DE VALIDATION POUR LES ACTIONS
// ============================================================================

// Créer un nouveau ruleset
export const createRulesetSchema = z.object({
  name: z.string().min(1, "Nom requis"),
  json: rulesetJsonSchema,
});

export type CreateRulesetInput = z.infer<typeof createRulesetSchema>;

// Dupliquer un ruleset (crée version+1)
export const duplicateRulesetSchema = z.object({
  sourceId: z.string().uuid(),
});

export type DuplicateRulesetInput = z.infer<typeof duplicateRulesetSchema>;

// Mettre à jour le JSON d'un ruleset
export const updateRulesetJsonSchema = z.object({
  json: rulesetJsonSchema,
});

export type UpdateRulesetJsonInput = z.infer<typeof updateRulesetJsonSchema>;
