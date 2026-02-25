"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createClient } from "@/lib/supabase/client";
import { 
  loginSchema, 
  loginWithPasswordSchema,
  type LoginFormData,
  type LoginWithPasswordFormData 
} from "@/lib/validators/auth";

function LoginForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usePassword, setUsePassword] = useState(false);

  // Lire l'erreur depuis l'URL (retour du callback)
  useEffect(() => {
    const urlError = searchParams.get("error");
    if (urlError) {
      setError(decodeURIComponent(urlError));
    }
  }, [searchParams]);

  // Form pour magic link
  const magicLinkForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  // Form pour mot de passe
  const passwordForm = useForm<LoginWithPasswordFormData>({
    resolver: zodResolver(loginWithPasswordSchema),
  });

  const onMagicLinkSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email: data.email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        setError(error.message);
      } else {
        setEmailSent(true);
      }
    } catch {
      setError("Une erreur est survenue. Veuillez réessayer.");
    } finally {
      setIsLoading(false);
    }
  };

  const onPasswordSubmit = async (data: LoginWithPasswordFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (error) {
        setError(error.message);
      } else {
        router.push("/projects");
      }
    } catch {
      setError("Une erreur est survenue. Veuillez réessayer.");
    } finally {
      setIsLoading(false);
    }
  };

  if (emailSent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-lg">
          <div className="mb-6 text-center">
            <svg
              className="mx-auto h-12 w-12 text-green-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h1 className="mb-2 text-center text-2xl font-bold text-gray-900">
            Email envoyé !
          </h1>
          <p className="text-center text-gray-600">
            Vérifiez votre boîte mail et cliquez sur le lien pour vous connecter.
          </p>
        </div>
      </div>
    );
  }

  // Mode mot de passe
  if (usePassword) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-lg">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold text-gray-900">HANGAR3D</h1>
            <p className="mt-2 text-gray-600">Connexion avec mot de passe</p>
          </div>

          <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Adresse email
              </label>
              <input
                {...passwordForm.register("email")}
                id="email"
                type="email"
                autoComplete="email"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                placeholder="vous@exemple.com"
              />
              {passwordForm.formState.errors.email && (
                <p className="mt-1 text-sm text-red-600">{passwordForm.formState.errors.email.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Mot de passe
              </label>
              <input
                {...passwordForm.register("password")}
                id="password"
                type="password"
                autoComplete="current-password"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                placeholder="••••••••"
              />
              {passwordForm.formState.errors.password && (
                <p className="mt-1 text-sm text-red-600">{passwordForm.formState.errors.password.message}</p>
              )}
            </div>

            {error && (
              <div className="rounded-md bg-red-50 p-4">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? "Connexion..." : "Se connecter"}
            </button>
          </form>

          <button
            type="button"
            onClick={() => setUsePassword(false)}
            className="mt-4 w-full text-center text-sm text-blue-600 hover:text-blue-800"
          >
            ← Utiliser un lien magique
          </button>
        </div>
      </div>
    );
  }

  // Mode magic link (par défaut)
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-lg">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900">HANGAR3D</h1>
          <p className="mt-2 text-gray-600">Connexion sans mot de passe</p>
        </div>

        <form onSubmit={magicLinkForm.handleSubmit(onMagicLinkSubmit)} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Adresse email
            </label>
            <input
              {...magicLinkForm.register("email")}
              id="email"
              type="email"
              autoComplete="email"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
              placeholder="vous@exemple.com"
            />
            {magicLinkForm.formState.errors.email && (
              <p className="mt-1 text-sm text-red-600">{magicLinkForm.formState.errors.email.message}</p>
            )}
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? "Envoi en cours..." : "Recevoir mon lien"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => setUsePassword(true)}
          className="mt-4 w-full text-center text-sm text-blue-600 hover:text-blue-800"
        >
          Utiliser un mot de passe →
        </button>

        <p className="mt-6 text-center text-sm text-gray-500">
          Un email avec un lien magique vous sera envoyé pour vous connecter en toute
          sécurité.
        </p>
      </div>
    </div>
  );
}

function LoginFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-lg">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900">HANGAR3D</h1>
          <p className="mt-2 text-gray-600">Chargement...</p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginForm />
    </Suspense>
  );
}

