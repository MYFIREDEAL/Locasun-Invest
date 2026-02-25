/**
 * API Route: POST /api/pvgis/calc
 * Calcule la production solaire via PVGIS (server-only)
 * 
 * Body: { projectId: string, forceRecalculate?: boolean }
 * Response: { success: true, data: PvgisResult } | { success: false, error: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { calculateProjectPvgis } from "@/lib/actions/pvgis";

// Schema de validation de la requête
const requestSchema = z.object({
  projectId: z.string().uuid("ID projet invalide"),
  forceRecalculate: z.boolean().optional().default(false),
});

export async function POST(request: NextRequest) {
  try {
    // Parser le body JSON
    const body = await request.json().catch(() => null);
    
    if (!body) {
      return NextResponse.json(
        { success: false, error: "Body JSON invalide" },
        { status: 400 }
      );
    }

    // Valider avec Zod
    const parsed = requestSchema.safeParse(body);
    
    if (!parsed.success) {
      const firstError = parsed.error.issues[0];
      return NextResponse.json(
        { success: false, error: firstError?.message ?? "Données invalides" },
        { status: 400 }
      );
    }

    // Appeler l'action server
    const result = await calculateProjectPvgis(parsed.data);

    if (!result.success) {
      // Déterminer le code HTTP approprié
      const status = result.error.includes("Non authentifié") ? 401 
        : result.error.includes("non trouvé") ? 404 
        : 400;
      
      return NextResponse.json(
        { success: false, error: result.error },
        { status }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data,
    });

  } catch (error) {
    // Erreur inattendue
    const message = error instanceof Error ? error.message : "Erreur serveur";
    
    // Ne pas exposer les détails en production
    const safeMessage = process.env.NODE_ENV === "production" 
      ? "Erreur serveur interne" 
      : message;

    return NextResponse.json(
      { success: false, error: safeMessage },
      { status: 500 }
    );
  }
}

// Désactiver les autres méthodes HTTP
export async function GET() {
  return NextResponse.json(
    { success: false, error: "Méthode non autorisée. Utilisez POST." },
    { status: 405 }
  );
}
