/**
 * API Route: GET /api/enedis/network
 * Récupère le réseau électrique Enedis autour d'un point (postes, lignes BT/HTA).
 *
 * Query params:
 * - lat: latitude (obligatoire)
 * - lon: longitude (obligatoire)
 * - radius: rayon en mètres (optionnel, défaut 2000, max 5000)
 *
 * Response: EnedisNetworkResponse | EnedisNetworkError
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { fetchEnedisNetwork } from "@/server/services/enedis";

// Schema de validation des query params
const querySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().min(100).max(5000).default(2000),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;

    const parsed = querySchema.safeParse({
      lat: searchParams.get("lat"),
      lon: searchParams.get("lon"),
      radius: searchParams.get("radius") ?? undefined,
    });

    if (!parsed.success) {
      const firstError = parsed.error.issues[0];
      return NextResponse.json(
        {
          success: false,
          error: `Paramètres invalides: ${firstError?.message ?? "vérifiez lat, lon, radius"}`,
        },
        { status: 400 }
      );
    }

    const { lat, lon, radius } = parsed.data;

    const networkData = await fetchEnedisNetwork(lat, lon, radius);

    // Si toutes les requêtes ont échoué, renvoyer un warning mais pas une erreur
    if (
      networkData.postes.length === 0 &&
      networkData.lignesBt.length === 0 &&
      networkData.lignesHta.length === 0 &&
      networkData.errors.length > 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Impossible de récupérer les données réseau Enedis. Le service est peut-être temporairement indisponible.",
          isUpstreamError: true,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        postes: networkData.postes,
        lignesBt: networkData.lignesBt,
        lignesHta: networkData.lignesHta,
        bbox: networkData.bbox,
        timestamp: networkData.timestamp,
        ...(networkData.errors.length > 0 ? { warnings: networkData.errors } : {}),
      },
    });
  } catch (err) {
    console.error("[API /api/enedis/network] Erreur:", err);
    return NextResponse.json(
      {
        success: false,
        error: "Erreur serveur lors de la récupération du réseau Enedis",
        isUpstreamError: true,
      },
      { status: 500 }
    );
  }
}
