import { z } from "zod";
import type { BuildingType } from "./building";
import { BUILDING_TYPES } from "./building";

// ============================================================================
// VARIANTE = combinaison (type, largeur) avec hauteurs configurables
// ============================================================================

export const buildingVariantSchema = z.object({
  type: z.enum(BUILDING_TYPES),
  width: z.number(),
  heightSabliereLeft: z.number().min(2).max(15),   // Hauteur sablière gauche (m)
  heightSabliereRight: z.number().min(2).max(15),  // Hauteur sablière droite (m)
  heightFaitage: z.number().min(2).max(20),        // Hauteur faîtage (m)
  // Position du faîtage depuis la gauche (m) - pour ASYM1/ASYM2
  faitagePositionFromLeft: z.number().optional(),   // Distance faîtage depuis bord gauche (m)
  // Position du poteau intermédiaire depuis la gauche (m) - pour ASYM2, PL
  poteauPositionFromLeft: z.number().optional(),    // Distance poteau depuis bord gauche (m)
  // Zones pour types avec poteau intermédiaire (ASYM2, PL) - legacy, utilisé si poteauPosition non défini
  zoneLeft: z.number().optional(),                  // Largeur zone gauche (m)
  zoneRight: z.number().optional(),                 // Largeur zone droite (m)
});

export type BuildingVariant = z.infer<typeof buildingVariantSchema>;

// ============================================================================
// TABLE DE CONFIGURATION DES VARIANTES
// Clé = "TYPE_LARGEUR", ex: "SYM_15" ou "ASYM2_25.5"
// ============================================================================

export type VariantKey = `${BuildingType}_${number}`;

export function getVariantKey(type: BuildingType, width: number): VariantKey {
  return `${type}_${width}` as VariantKey;
}

// ============================================================================
// CONFIGURATION PAR DÉFAUT (basée sur les screenshots)
// Ces valeurs seront stockées en base et éditables via l'admin
// ============================================================================

export const DEFAULT_VARIANTS: Record<VariantKey, BuildingVariant> = {
  // Symétrique
  "SYM_15": { type: "SYM", width: 15, heightSabliereLeft: 5.5, heightSabliereRight: 5.5, heightFaitage: 6.8 },
  "SYM_18.6": { type: "SYM", width: 18.6, heightSabliereLeft: 5.5, heightSabliereRight: 5.5, heightFaitage: 7.1 },
  "SYM_22.3": { type: "SYM", width: 22.3, heightSabliereLeft: 5.5, heightSabliereRight: 5.5, heightFaitage: 7.5 },
  "SYM_26": { type: "SYM", width: 26, heightSabliereLeft: 5.5, heightSabliereRight: 5.5, heightFaitage: 7.8 },
  "SYM_29.8": { type: "SYM", width: 29.8, heightSabliereLeft: 5.5, heightSabliereRight: 5.5, heightFaitage: 8.1 },
  "SYM_33.5": { type: "SYM", width: 33.5, heightSabliereLeft: 5.5, heightSabliereRight: 5.5, heightFaitage: 8.5 },
  
  // Asymétrique 1 zone - sablière haute à gauche, basse à droite
  // Position faîtage calculée: Δh_gauche / tan(15°) = (faîtage - sab_gauche) / 0.2679
  // 16.4m: (7.4 - 6.4) / 0.2679 ≈ 3.73m depuis la gauche
  "ASYM1_16.4": { type: "ASYM1", width: 16.4, heightSabliereLeft: 6.4, heightSabliereRight: 4, heightFaitage: 7.4, faitagePositionFromLeft: 3.73 },
  // 20m: (8.4 - 7.2) / 0.2679 ≈ 4.48m depuis la gauche
  "ASYM1_20": { type: "ASYM1", width: 20, heightSabliereLeft: 7.2, heightSabliereRight: 4, heightFaitage: 8.4, faitagePositionFromLeft: 4.48 },
  
  // Asymétrique 2 zones - sablière haute à gauche (petit pan), basse à droite (grand pan)
  // Position faîtage ET poteau = (heightFaitage - heightSabliereLeft) / tan(15°)
  // 25.5m: faîtage/poteau à 6.55m, hauteurs 6.9m / 4m / faîtage 8.9m
  "ASYM2_25.5": { type: "ASYM2", width: 25.5, heightSabliereLeft: 6.9, heightSabliereRight: 4, heightFaitage: 8.9, faitagePositionFromLeft: 6.55, poteauPositionFromLeft: 6.55, zoneLeft: 6.55, zoneRight: 18.95 },
  // 29.1m: faîtage/poteau à 6.55m, hauteurs 7.9m / 4m / faîtage 9.8m  
  "ASYM2_29.1": { type: "ASYM2", width: 29.1, heightSabliereLeft: 7.9, heightSabliereRight: 4, heightFaitage: 9.8, faitagePositionFromLeft: 6.55, poteauPositionFromLeft: 6.55, zoneLeft: 6.55, zoneRight: 22.55 },
  
  // Monopente - côté gauche haut, côté droite bas (pente 15°, égout 4m)
  // 12.7m: hauteurs 7.4m (gauche haute) / 4m (droite basse)
  "MONO_12.7": { type: "MONO", width: 12.7, heightSabliereLeft: 7.4, heightSabliereRight: 4, heightFaitage: 7.4 },
  // 16.4m: hauteurs 8.4m (gauche haute) / 4m (droite basse)
  "MONO_16.4": { type: "MONO", width: 16.4, heightSabliereLeft: 8.4, heightSabliereRight: 4, heightFaitage: 8.4 },
  
  // Ombrière VL simple gauche - pente 10°
  // 6.9m: hauteurs 4.7m (gauche) / 3.7m (droite)
  "VL_LEFT_6.9": { type: "VL_LEFT", width: 6.9, heightSabliereLeft: 4.7, heightSabliereRight: 3.7, heightFaitage: 4.7 },
  
  // Ombrière VL simple droite - pente 10°
  // 6.9m: hauteurs 4.1m (gauche) / 2.9m (droite) - miroir inversé
  "VL_RIGHT_6.9": { type: "VL_RIGHT", width: 6.9, heightSabliereLeft: 4.1, heightSabliereRight: 2.9, heightFaitage: 4.1 },
  
  // Ombrière VL double - pente 10°, faîtage central
  // 9.1m: hauteurs 4.6m (gauche) / 3m (droite) - forme en V inversé
  "VL_DOUBLE_9.1": { type: "VL_DOUBLE", width: 9.1, heightSabliereLeft: 4.6, heightSabliereRight: 3, heightFaitage: 4.6 },
  // 11.3m: hauteurs 4.7m (gauche) / 2.8m (droite), faîtage visible 2.2m
  "VL_DOUBLE_11.3": { type: "VL_DOUBLE", width: 11.3, heightSabliereLeft: 4.7, heightSabliereRight: 2.8, heightFaitage: 4.7 },
  
  // Ombrière PL - pente 10°, forme symétrique avec faîtage central et poteau intermédiaire
  // 15.8m: zones 7.9m + 7.9m, hauteurs 7.9m (gauche) / 5.1m (droite)
  "PL_15.8": { type: "PL", width: 15.8, heightSabliereLeft: 7.9, heightSabliereRight: 5.1, heightFaitage: 7.9, zoneLeft: 7.9, zoneRight: 7.9 },
  // 20.2m: zones 10.1m + 10.1m, hauteurs 9.3m (gauche) / 5.7m (droite)
  "PL_20.2": { type: "PL", width: 20.2, heightSabliereLeft: 9.3, heightSabliereRight: 5.7, heightFaitage: 9.3, zoneLeft: 10.1, zoneRight: 10.1 },
  // 24.6m: zones 12.3m + 12.3m, hauteurs 9.3m (gauche) / 5m (droite)
  "PL_24.6": { type: "PL", width: 24.6, heightSabliereLeft: 9.3, heightSabliereRight: 5, heightFaitage: 9.3, zoneLeft: 12.3, zoneRight: 12.3 },
};

// ============================================================================
// REGISTRE DE VARIANTES (peut être surchargé par les données DB)
// ============================================================================

// Cache des variantes chargées depuis la DB
let variantsRegistry: Record<VariantKey, BuildingVariant> = { ...DEFAULT_VARIANTS };

/**
 * Met à jour le registre de variantes avec les données de la DB
 * Appelé côté client après chargement depuis Supabase
 */
export function setVariantsRegistry(variants: Record<VariantKey, BuildingVariant>): void {
  variantsRegistry = { ...DEFAULT_VARIANTS, ...variants };
}

/**
 * Récupère le registre actuel (pour debug)
 */
export function getVariantsRegistry(): Record<VariantKey, BuildingVariant> {
  return variantsRegistry;
}

/**
 * Réinitialise le registre aux valeurs par défaut
 */
export function resetVariantsRegistry(): void {
  variantsRegistry = { ...DEFAULT_VARIANTS };
}

// ============================================================================
// FONCTION POUR RÉCUPÉRER UNE VARIANTE
// ============================================================================

export function getVariant(type: BuildingType, width: number): BuildingVariant | null {
  const key = getVariantKey(type, width);
  return variantsRegistry[key] ?? DEFAULT_VARIANTS[key] ?? null;
}

export function getVariantOrDefault(type: BuildingType, width: number): BuildingVariant {
  const variant = getVariant(type, width);
  if (variant) return variant;
  
  // Fallback: calcul basé sur la pente
  const slope = 10; // degrés par défaut
  const slopeRad = (slope * Math.PI) / 180;
  const heightDelta = (width / 2) * Math.tan(slopeRad);
  const sabliere = 4;
  
  return {
    type,
    width,
    heightSabliereLeft: sabliere,
    heightSabliereRight: sabliere,
    heightFaitage: sabliere + heightDelta,
  };
}
