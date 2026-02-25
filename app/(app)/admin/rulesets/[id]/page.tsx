import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getRuleset } from "@/lib/actions/rulesets";
import { RulesetEditor } from "./components/ruleset-editor";

export default async function RulesetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Vérifier l'authentification et le rôle admin/pro
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (!profile || (profile.role !== "admin" && profile.role !== "pro")) {
    redirect("/projects");
  }

  const result = await getRuleset(id);

  if (!result.success) {
    notFound();
  }

  const ruleset = result.data;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b border-gray-200 bg-white">
        <div className="px-8 py-4">
          <Link
            href="/admin/rulesets"
            className="mb-2 inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
          >
            ← Retour aux rulesets
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {ruleset.name} <span className="text-gray-400">v{ruleset.version}</span>
              </h1>
              <div className="mt-1 flex items-center gap-3">
                {ruleset.is_active ? (
                  <span className="inline-flex rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-800">
                    Actif
                  </span>
                ) : (
                  <span className="inline-flex rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-600">
                    Inactif
                  </span>
                )}
                <span className="text-sm text-gray-500">
                  {ruleset.org_id ? "Organisation" : "Global"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-8">
        <RulesetEditor ruleset={ruleset} />
      </div>
    </div>
  );
}
