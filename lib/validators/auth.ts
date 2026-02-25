import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Adresse email invalide"),
});

export const loginWithPasswordSchema = z.object({
  email: z.string().email("Adresse email invalide"),
  password: z.string().min(6, "Mot de passe requis (min 6 caractères)"),
});

export type LoginFormData = z.infer<typeof loginSchema>;
export type LoginWithPasswordFormData = z.infer<typeof loginWithPasswordSchema>;
