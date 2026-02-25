import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const origin = requestUrl.origin;
  const error = requestUrl.searchParams.get("error");
  const errorDescription = requestUrl.searchParams.get("error_description");

  // Gestion des erreurs Supabase (ex: lien expiré)
  if (error) {
    const errorMessage = errorDescription || error;
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(errorMessage)}`
    );
  }

  if (code) {
    try {
      const supabase = await createClient();
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      
      if (exchangeError) {
        return NextResponse.redirect(
          `${origin}/login?error=${encodeURIComponent(exchangeError.message)}`
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur inconnue";
      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent(message)}`
      );
    }
  } else {
    // Pas de code fourni
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent("Lien invalide ou expiré")}`
    );
  }

  // Redirection vers /projects après connexion réussie
  return NextResponse.redirect(`${origin}/projects`);
}
