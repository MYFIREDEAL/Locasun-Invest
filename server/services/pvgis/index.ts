/**
 * Service PVGIS - Server-only
 * Appelle l'API PVGIS européenne pour calculer la production solaire
 * 
 * Documentation API: https://re.jrc.ec.europa.eu/pvg_tools/en/
 * Endpoint: https://re.jrc.ec.europa.eu/api/v5_3/PVcalc
 */

import type {
  PvgisInput,
  PvgisRawResponse,
  PvgisPanResult,
  PvgisResult,
  PvgisInputsSnapshot,
} from "@/lib/types/pvgis";
import {
  azimuthToAspect,
  getPanLabel,
} from "@/lib/types/pvgis";

// ============================================================================
// CONFIGURATION
// ============================================================================

const PVGIS_API_URL = "https://re.jrc.ec.europa.eu/api/v5_3/PVcalc";
const DEFAULT_LOSS_PERCENT = 14; // Pertes système standard (câblage, onduleur, etc.)
const REQUEST_TIMEOUT_MS = 30000; // 30s timeout

// ============================================================================
// TYPES INTERNES
// ============================================================================

export interface PanInput {
  panId: "A" | "B";
  azimuthDeg: number;      // Notre convention: 0=Nord
  tiltDeg: number;         // Inclinaison en degrés
  peakPowerKwc: number;    // Puissance crête du pan
}

export interface PvgisCalcInput {
  lat: number;
  lon: number;
  pans: PanInput[];
  lossPercent?: number;
}

export interface PvgisCalcResult {
  success: true;
  result: PvgisResult;
}

export interface PvgisCalcError {
  success: false;
  error: string;
  details?: string;
}

export type PvgisCalcResponse = PvgisCalcResult | PvgisCalcError;

// ============================================================================
// APPEL API PVGIS
// ============================================================================

/**
 * Appelle l'API PVGIS pour un pan donné
 */
async function callPvgisApi(input: PvgisInput): Promise<PvgisRawResponse> {
  const params = new URLSearchParams({
    lat: input.lat.toFixed(5),
    lon: input.lon.toFixed(5),
    peakpower: input.peakpower.toFixed(2),
    angle: input.angle.toFixed(1),
    aspect: input.aspect.toFixed(1),
    loss: input.loss.toFixed(0),
    outputformat: "json",
    pvtechchoice: input.pvtechchoice,
  });

  const url = `${PVGIS_API_URL}?${params.toString()}`;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: {
        "Accept": "application/json",
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      throw new Error(`PVGIS API error ${response.status}: ${errorText}`);
    }

    const data = await response.json() as PvgisRawResponse;
    return data;
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        throw new Error("PVGIS API timeout (30s)");
      }
      throw error;
    }
    throw new Error("PVGIS API unknown error");
  }
}

/**
 * Parse la réponse PVGIS brute en résultat structuré pour un pan
 */
function parsePvgisResponse(
  raw: PvgisRawResponse,
  panInput: PanInput
): PvgisPanResult {
  const totals = raw.outputs.totals.fixed;
  const monthly = raw.outputs.monthly.fixed;

  // Extraire les productions mensuelles (index 0 = janvier)
  const monthlyKwh = monthly
    .sort((a, b) => a.month - b.month)
    .map(m => Math.round(m.E_m));

  const monthlyIrradiation = monthly
    .sort((a, b) => a.month - b.month)
    .map(m => Math.round(m["H(i)_m"] * 10) / 10);

  const annualKwh = Math.round(totals.E_y);
  const annualKwhPerKwc = Math.round(totals.E_y / panInput.peakPowerKwc);

  return {
    panId: panInput.panId,
    label: `Pan ${panInput.panId} (${getPanLabel(panInput.azimuthDeg)})`,
    inputAzimuthDeg: panInput.azimuthDeg,
    pvgisAspect: azimuthToAspect(panInput.azimuthDeg),
    tiltDeg: panInput.tiltDeg,
    peakPowerKwc: panInput.peakPowerKwc,
    annualKwh,
    annualKwhPerKwc,
    monthlyKwh,
    monthlyIrradiation,
  };
}

// ============================================================================
// FONCTION PRINCIPALE
// ============================================================================

// ============================================================================
// APPEL PVGIS POUR UN PAN (utilisé par getOrComputePvgis)
// ============================================================================

interface CallPvgisForPanContext {
  lat: number;
  lon: number;
  lossPercent: number;
}

type CallPvgisForPanResult =
  | { success: true; data: PvgisPanResult }
  | { success: false; error: string };

/**
 * Appelle l'API PVGIS pour un seul pan et retourne le PvgisPanResult.
 * Conçu pour être utilisé par le cache per-pan (getOrComputePvgis).
 */
export async function callPvgisForPan(
  ctx: CallPvgisForPanContext,
  pan: PanInput,
): Promise<CallPvgisForPanResult> {
  try {
    const pvgisInput: PvgisInput = {
      lat: ctx.lat,
      lon: ctx.lon,
      peakpower: pan.peakPowerKwc,
      angle: pan.tiltDeg,
      aspect: azimuthToAspect(pan.azimuthDeg),
      loss: ctx.lossPercent,
      outputformat: "json",
      pvtechchoice: "crystSi",
    };

    const rawResponse = await callPvgisApi(pvgisInput);
    const panResult = parsePvgisResponse(rawResponse, pan);
    return { success: true, data: panResult };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erreur inconnue";
    return { success: false, error: msg };
  }
}

// ============================================================================
// FONCTION PRINCIPALE (legacy — conservée pour compatibilité)
// ============================================================================

/**
 * Calcule la production solaire via PVGIS pour tous les pans d'un projet
 * 
 * @param input - Coordonnées et configuration des pans
 * @returns Résultat PVGIS complet ou erreur
 */
export async function calculatePvgisProduction(
  input: PvgisCalcInput,
  projectId: string
): Promise<PvgisCalcResponse> {
  const { lat, lon, pans, lossPercent = DEFAULT_LOSS_PERCENT } = input;

  // Validation des inputs
  if (pans.length === 0) {
    return {
      success: false,
      error: "Aucun pan PV configuré",
    };
  }

  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return {
      success: false,
      error: "Coordonnées GPS invalides",
    };
  }

  // Filtrer les pans avec puissance > 0
  const activePans = pans.filter(p => p.peakPowerKwc > 0);
  
  if (activePans.length === 0) {
    return {
      success: false,
      error: "Aucun pan avec puissance PV > 0",
    };
  }

  try {
    // Appeler PVGIS pour chaque pan (séquentiellement pour éviter rate limiting)
    const panResults: PvgisPanResult[] = [];
    const rawResponses: Record<string, PvgisRawResponse> = {};

    for (const pan of activePans) {
      const pvgisInput: PvgisInput = {
        lat,
        lon,
        peakpower: pan.peakPowerKwc,
        angle: pan.tiltDeg,
        aspect: azimuthToAspect(pan.azimuthDeg),
        loss: lossPercent,
        outputformat: "json",
        pvtechchoice: "crystSi",
      };

      const rawResponse = await callPvgisApi(pvgisInput);
      rawResponses[pan.panId] = rawResponse;

      const panResult = parsePvgisResponse(rawResponse, pan);
      panResults.push(panResult);
    }

    // Calculer les totaux agrégés
    const totalAnnualKwh = panResults.reduce((sum, p) => sum + p.annualKwh, 0);
    const totalPeakPowerKwc = panResults.reduce((sum, p) => sum + p.peakPowerKwc, 0);
    
    // Agréger les productions mensuelles
    const monthlyKwh: number[] = [];
    for (let i = 0; i < 12; i++) {
      monthlyKwh.push(
        panResults.reduce((sum, p) => sum + (p.monthlyKwh[i] ?? 0), 0)
      );
    }

    const result: PvgisResult = {
      projectId,
      calculatedAt: new Date().toISOString(),
      location: { lat, lon },
      pans: panResults,
      totals: {
        annualKwh: totalAnnualKwh,
        peakPowerKwc: totalPeakPowerKwc,
        annualKwhPerKwc: totalPeakPowerKwc > 0 
          ? Math.round(totalAnnualKwh / totalPeakPowerKwc)
          : 0,
        monthlyKwh,
      },
      rawResponses,
    };

    return {
      success: true,
      result,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Erreur inconnue";
    return {
      success: false,
      error: "Erreur lors de l'appel PVGIS",
      details: errorMessage,
    };
  }
}

// ============================================================================
// HELPER: Créer le snapshot d'inputs pour le cache
// ============================================================================

export function createInputsSnapshot(input: PvgisCalcInput): PvgisInputsSnapshot {
  return {
    lat: input.lat,
    lon: input.lon,
    lossPercent: input.lossPercent ?? DEFAULT_LOSS_PERCENT,
    pans: input.pans
      .filter(p => p.peakPowerKwc > 0)
      .map(p => ({
        panId: p.panId,
        azimuthDeg: p.azimuthDeg,
        tiltDeg: p.tiltDeg,
        kwc: p.peakPowerKwc,
      })),
  };
}
