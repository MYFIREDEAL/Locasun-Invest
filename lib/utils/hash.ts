import { createHash } from "crypto";

/**
 * Génère un hash SHA-256 déterministe d'un objet JSON.
 * 
 * Garanties :
 *  - Même objet → même hash (JSON.stringify sur objet trié)
 *  - Exécution synchrone (Node crypto, server-only)
 *  - Préfixé "sha256_" pour identification
 */
export function sha256(input: unknown): string {
  const json = typeof input === "string" ? input : JSON.stringify(input);
  const digest = createHash("sha256").update(json).digest("hex");
  return `sha256_${digest}`;
}
