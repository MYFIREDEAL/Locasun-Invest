/**
 * Grille tarifaire bâtiment (fondations + charpente + couverture bac acier 75/100ème)
 * Source : grille Nelson Énergies 2025 (PDF)
 *
 * Clé = `${type}_${widthCode}` où widthCode correspond à la largeur du PDF
 * arrondie au code interne (ex: 22.35m PDF → 22.3 dans le code).
 *
 * Chaque entrée contient un tableau de { nbSpans, kwc, tarif }.
 * Le tarif est le "Tarif sans PV" = fondations + charpente + couverture.
 */

import type { BuildingType } from "@/lib/types/building";

// ============================================================================
// TYPES
// ============================================================================

export interface PricingEntry {
  nbSpans: number;   // Nombre de travées (longueur / spacing)
  kwc: number;       // kWc correspondant (pour vérification)
  tarif: number;     // Tarif sans PV en € (fondations + charpente + couverture)
}

export interface PricingSeries {
  type: BuildingType;
  width: number;      // Largeur code interne (ex: 16.4, 20, 25.5…)
  widthPdf: number;   // Largeur exacte PDF (ex: 22.35)
  spacing: number;    // Entraxe (toujours 7.5m dans cette grille)
  entries: PricingEntry[];
}

// ============================================================================
// DONNÉES — Séries O (ASYM1)
// ============================================================================

/** O 01-13 — ASYM1 16.4m, sablière 4m, faîtage 7.42m */
const ASYM1_16_4: PricingSeries = {
  type: "ASYM1",
  width: 16.4,
  widthPdf: 16.4,
  spacing: 7.5,
  entries: [
    { nbSpans: 4,  kwc: 96,  tarif: 57_288 },
    { nbSpans: 5,  kwc: 126, tarif: 68_777 },
    { nbSpans: 6,  kwc: 151, tarif: 80_452 },
    { nbSpans: 7,  kwc: 175, tarif: 92_127 },
    { nbSpans: 8,  kwc: 199, tarif: 103_630 },
    { nbSpans: 9,  kwc: 229, tarif: 115_305 },
    { nbSpans: 10, kwc: 253, tarif: 127_820 },
    { nbSpans: 11, kwc: 278, tarif: 139_495 },
    { nbSpans: 12, kwc: 302, tarif: 150_985 },
    { nbSpans: 13, kwc: 332, tarif: 162_488 },
    { nbSpans: 14, kwc: 356, tarif: 176_705 },
    { nbSpans: 15, kwc: 380, tarif: 188_380 },
    { nbSpans: 16, kwc: 405, tarif: 200_055 },
  ],
};

/** O 14-26 — ASYM1 20m, sablière 4m, faîtage 8.4m */
const ASYM1_20: PricingSeries = {
  type: "ASYM1",
  width: 20,
  widthPdf: 20,
  spacing: 7.5,
  entries: [
    { nbSpans: 4,  kwc: 120, tarif: 69_598 },
    { nbSpans: 5,  kwc: 156, tarif: 83_948 },
    { nbSpans: 6,  kwc: 186, tarif: 98_469 },
    { nbSpans: 7,  kwc: 215, tarif: 113_659 },
    { nbSpans: 8,  kwc: 245, tarif: 128_366 },
    { nbSpans: 9,  kwc: 282, tarif: 142_888 },
    { nbSpans: 10, kwc: 312, tarif: 157_238 },
    { nbSpans: 11, kwc: 342, tarif: 171_759 },
    { nbSpans: 12, kwc: 372, tarif: 186_109 },
    { nbSpans: 13, kwc: 409, tarif: 200_816 },
    { nbSpans: 14, kwc: 438, tarif: 217_969 },
    { nbSpans: 15, kwc: 468, tarif: 233_159 },
    { nbSpans: 16, kwc: 498, tarif: 247_680 },
  ],
};

// ============================================================================
// DONNÉES — Séries C (ASYM2)
// ============================================================================

/** C 1-9 — ASYM2 25.5m, sablière 4m, faîtage 8.9m, poteau 13m */
const ASYM2_25_5: PricingSeries = {
  type: "ASYM2",
  width: 25.5,
  widthPdf: 25.5,
  spacing: 7.5,
  entries: [
    { nbSpans: 4,  kwc: 169, tarif: 80_756 },
    { nbSpans: 5,  kwc: 214, tarif: 97_152 },
    { nbSpans: 6,  kwc: 255, tarif: 113_905 },
    { nbSpans: 7,  kwc: 296, tarif: 130_657 },
    { nbSpans: 8,  kwc: 338, tarif: 148_250 },
    { nbSpans: 9,  kwc: 388, tarif: 165_002 },
    { nbSpans: 10, kwc: 429, tarif: 181_583 },
    { nbSpans: 11, kwc: 470, tarif: 198_336 },
    { nbSpans: 12, kwc: 511, tarif: 215_088 },
  ],
};

/** C 10-16 — ASYM2 29m (code: 29.1), sablière 4m, faîtage 9.8m, poteau 13m */
const ASYM2_29_1: PricingSeries = {
  type: "ASYM2",
  width: 29.1,
  widthPdf: 29,
  spacing: 7.5,
  entries: [
    { nbSpans: 4,  kwc: 193, tarif: 92_159 },
    { nbSpans: 5,  kwc: 244, tarif: 111_617 },
    { nbSpans: 6,  kwc: 290, tarif: 132_086 },
    { nbSpans: 7,  kwc: 337, tarif: 151_901 },
    { nbSpans: 8,  kwc: 386, tarif: 171_359 },
    { nbSpans: 9,  kwc: 441, tarif: 190_988 },
    { nbSpans: 10, kwc: 488, tarif: 210_803 },
  ],
};

// ============================================================================
// DONNÉES — Séries H (SYM)
// ============================================================================

/** H 1-13 — SYM 15m, sablière 5.5m, faîtage 6.82m */
const SYM_15: PricingSeries = {
  type: "SYM",
  width: 15,
  widthPdf: 15,
  spacing: 7.5,
  entries: [
    { nbSpans: 4,  kwc: 96,  tarif: 55_086 },
    { nbSpans: 5,  kwc: 119, tarif: 65_962 },
    { nbSpans: 6,  kwc: 145, tarif: 76_838 },
    { nbSpans: 7,  kwc: 167, tarif: 87_885 },
    { nbSpans: 8,  kwc: 193, tarif: 98_761 },
    { nbSpans: 9,  kwc: 219, tarif: 109_994 },
    { nbSpans: 10, kwc: 241, tarif: 120_870 },
    { nbSpans: 11, kwc: 267, tarif: 131_747 },
    { nbSpans: 12, kwc: 290, tarif: 143_634 },
    { nbSpans: 13, kwc: 316, tarif: 154_510 },
    { nbSpans: 14, kwc: 338, tarif: 167_731 },
    { nbSpans: 15, kwc: 364, tarif: 178_608 },
    { nbSpans: 16, kwc: 386, tarif: 189_655 },
  ],
};

/** H 14-26 — SYM 18.6m, sablière 5.5m, faîtage 7.14m */
const SYM_18_6: PricingSeries = {
  type: "SYM",
  width: 18.6,
  widthPdf: 18.6,
  spacing: 7.5,
  entries: [
    { nbSpans: 4,  kwc: 120, tarif: 64_229 },
    { nbSpans: 5,  kwc: 148, tarif: 78_093 },
    { nbSpans: 6,  kwc: 181, tarif: 91_771 },
    { nbSpans: 7,  kwc: 209, tarif: 105_806 },
    { nbSpans: 8,  kwc: 241, tarif: 120_325 },
    { nbSpans: 9,  kwc: 274, tarif: 134_188 },
    { nbSpans: 10, kwc: 302, tarif: 147_867 },
    { nbSpans: 11, kwc: 334, tarif: 161_730 },
    { nbSpans: 12, kwc: 362, tarif: 175_765 },
    { nbSpans: 13, kwc: 395, tarif: 189_444 },
    { nbSpans: 14, kwc: 423, tarif: 205_799 },
    { nbSpans: 15, kwc: 455, tarif: 219_478 },
    { nbSpans: 16, kwc: 483, tarif: 234_353 },
  ],
};

/** H 27-37 — SYM 22.3m (PDF: 22.35m), sablière 5.5m, faîtage 7.47m */
const SYM_22_3: PricingSeries = {
  type: "SYM",
  width: 22.3,
  widthPdf: 22.35,
  spacing: 7.5,
  entries: [
    { nbSpans: 4,  kwc: 145, tarif: 73_649 },
    { nbSpans: 5,  kwc: 178, tarif: 88_889 },
    { nbSpans: 6,  kwc: 217, tarif: 104_130 },
    { nbSpans: 7,  kwc: 251, tarif: 120_395 },
    { nbSpans: 8,  kwc: 290, tarif: 135_636 },
    { nbSpans: 9,  kwc: 329, tarif: 150_876 },
    { nbSpans: 10, kwc: 362, tarif: 166_302 },
    { nbSpans: 11, kwc: 401, tarif: 181_542 },
    { nbSpans: 12, kwc: 435, tarif: 196_782 },
    { nbSpans: 13, kwc: 474, tarif: 212_208 },
    { nbSpans: 14, kwc: 507, tarif: 231_049 },
  ],
};

/** H 38-46 — SYM 26m (PDF: 26.05m), sablière 5.5m, faîtage 7.80m */
const SYM_26: PricingSeries = {
  type: "SYM",
  width: 26,
  widthPdf: 26.05,
  spacing: 7.5,
  entries: [
    { nbSpans: 4,  kwc: 169, tarif: 86_673 },
    { nbSpans: 5,  kwc: 214, tarif: 104_883 },
    { nbSpans: 6,  kwc: 255, tarif: 123_918 },
    { nbSpans: 7,  kwc: 296, tarif: 142_113 },
    { nbSpans: 8,  kwc: 338, tarif: 160_494 },
    { nbSpans: 9,  kwc: 388, tarif: 178_689 },
    { nbSpans: 10, kwc: 429, tarif: 197_069 },
    { nbSpans: 11, kwc: 470, tarif: 215_093 },
    { nbSpans: 12, kwc: 511, tarif: 234_314 },
  ],
};

/** H 47-54 — SYM 29.8m (PDF: 29.75m), sablière 5.5m, faîtage 8.12m */
const SYM_29_8: PricingSeries = {
  type: "SYM",
  width: 29.8,
  widthPdf: 29.75,
  spacing: 7.5,
  entries: [
    { nbSpans: 4,  kwc: 193, tarif: 101_561 },
    { nbSpans: 5,  kwc: 238, tarif: 124_076 },
    { nbSpans: 6,  kwc: 290, tarif: 145_580 },
    { nbSpans: 7,  kwc: 334, tarif: 167_255 },
    { nbSpans: 8,  kwc: 386, tarif: 188_759 },
    { nbSpans: 9,  kwc: 438, tarif: 211_275 },
    { nbSpans: 10, kwc: 483, tarif: 232_950 },
    { nbSpans: 11, kwc: 535, tarif: 254_454 },
  ],
};

/** H 55-61 — SYM 33.5m (PDF: 33.46m), sablière 5.5m, faîtage 8.45m */
const SYM_33_5: PricingSeries = {
  type: "SYM",
  width: 33.5,
  widthPdf: 33.46,
  spacing: 7.5,
  entries: [
    { nbSpans: 4,  kwc: 217, tarif: 118_675 },
    { nbSpans: 5,  kwc: 273, tarif: 144_950 },
    { nbSpans: 6,  kwc: 326, tarif: 171_053 },
    { nbSpans: 7,  kwc: 377, tarif: 197_329 },
    { nbSpans: 8,  kwc: 435, tarif: 224_273 },
    { nbSpans: 9,  kwc: 494, tarif: 250_376 },
    { nbSpans: 10, kwc: 546, tarif: 276_651 },
  ],
};

// ============================================================================
// INDEX PAR TYPE + LARGEUR
// ============================================================================

/** Toutes les séries indexées par `${type}_${width}` */
export const ALL_SERIES_DEFAULT: PricingSeries[] = [
  // ASYM1
  ASYM1_16_4,
  ASYM1_20,
  // ASYM2
  ASYM2_25_5,
  ASYM2_29_1,
  // SYM
  SYM_15,
  SYM_18_6,
  SYM_22_3,
  SYM_26,
  SYM_29_8,
  SYM_33_5,
];

/**
 * Map rapide : clé = `${type}_${width}` (largeur code interne)
 */
const SERIES_MAP = new Map<string, PricingSeries>(
  ALL_SERIES_DEFAULT.map((s) => [`${s.type}_${s.width}`, s]),
);

// ============================================================================
// LOOKUP
// ============================================================================

export interface BuildingCostResult {
  /** Tarif total (fondations + charpente + couverture) en € */
  tarif: number;
  /** kWc de référence dans la grille (pour vérification) */
  kwcGrid: number;
  /** true si c'est un match exact dans la grille */
  exact: boolean;
  /** true si c'est une interpolation entre 2 lignes */
  interpolated: boolean;
}

/**
 * Recherche le coût bâtiment (fondations + charpente + couverture) dans la grille tarifaire.
 *
 * @param type   — Type de bâtiment (ASYM1, ASYM2, SYM…)
 * @param width  — Largeur du bâtiment (m) — largeur code interne
 * @param nbSpans — Nombre de travées
 * @returns Le résultat du lookup, ou null si pas dans la grille
 */
export function lookupBuildingCost(
  type: BuildingType,
  width: number,
  nbSpans: number,
): BuildingCostResult | null {
  const key = `${type}_${width}`;
  const series = SERIES_MAP.get(key);

  if (!series) return null;

  // Match exact
  const exact = series.entries.find((e) => e.nbSpans === nbSpans);
  if (exact) {
    return {
      tarif: exact.tarif,
      kwcGrid: exact.kwc,
      exact: true,
      interpolated: false,
    };
  }

  // Interpolation linéaire si nbSpans entre deux lignes
  const sorted = [...series.entries].sort((a, b) => a.nbSpans - b.nbSpans);
  if (sorted.length === 0) return null;

  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;

  if (nbSpans < first.nbSpans || nbSpans > last.nbSpans) {
    // Hors grille : prendre la ligne la plus proche
    const closest = nbSpans < first.nbSpans ? first : last;
    return {
      tarif: closest.tarif,
      kwcGrid: closest.kwc,
      exact: false,
      interpolated: false,
    };
  }

  // Trouver les deux lignes encadrantes
  let lower: PricingEntry = first;
  let upper: PricingEntry = last;
  for (const entry of sorted) {
    if (entry.nbSpans <= nbSpans) lower = entry;
  }
  for (const entry of sorted) {
    if (entry.nbSpans >= nbSpans) {
      upper = entry;
      break;
    }
  }

  if (lower.nbSpans === upper.nbSpans) {
    return {
      tarif: lower.tarif,
      kwcGrid: lower.kwc,
      exact: true,
      interpolated: false,
    };
  }

  // Interpolation linéaire
  const ratio =
    (nbSpans - lower.nbSpans) / (upper.nbSpans - lower.nbSpans);
  const tarif = Math.round(lower.tarif + ratio * (upper.tarif - lower.tarif));
  const kwcInterp = Math.round(lower.kwc + ratio * (upper.kwc - lower.kwc));

  return {
    tarif,
    kwcGrid: kwcInterp,
    exact: false,
    interpolated: true,
  };
}

/**
 * Vérifie si une combinaison type+largeur a une grille tarifaire.
 */
export function hasPricingGrid(type: BuildingType, width: number): boolean {
  return SERIES_MAP.has(`${type}_${width}`);
}

/**
 * Retourne toutes les séries disponibles (pour admin/debug).
 */
export function getAllPricingSeries(): PricingSeries[] {
  return ALL_SERIES_DEFAULT;
}
