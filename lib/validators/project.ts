import { z } from "zod";

// Schéma pour créer un projet
export const createProjectSchema = z.object({
  name: z
    .string()
    .min(3, "Le nom doit contenir au moins 3 caractères")
    .max(100, "Le nom ne peut pas dépasser 100 caractères"),
  mode: z.enum(["PRO_SERVICE", "CLIENT_SELF_SERVICE"]).default("PRO_SERVICE"),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;

// Schéma pour mettre à jour un projet
export const updateProjectSchema = z.object({
  name: z
    .string()
    .min(3, "Le nom doit contenir au moins 3 caractères")
    .max(100, "Le nom ne peut pas dépasser 100 caractères")
    .optional(),
  status: z
    .enum(["draft", "submitted", "accepted", "rejected", "returned"])
    .optional(),
});

export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

// Schéma pour les décisions (pro accepte/refuse)
export const projectDecisionSchema = z.object({
  status: z.enum(["accepted", "rejected", "returned"]),
  decision_reason_code: z.string().min(1, "Code raison requis"),
  decision_comment: z.string().optional(),
});

export type ProjectDecisionInput = z.infer<typeof projectDecisionSchema>;
