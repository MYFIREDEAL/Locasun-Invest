import { z } from "zod";

// Common validators
export const emailSchema = z.string().email("Email invalide");
export const requiredString = z.string().min(1, "Ce champ est requis");
