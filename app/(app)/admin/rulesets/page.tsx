import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { listRulesets } from "@/lib/actions/rulesets";
import { RulesetsTable } from "./components/rulesets-table";

export default async function AdminRulesetsPage() {
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

  const result = await listRulesets();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b border-gray-200 bg-white">
        <div className="px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Administration des Rulesets</h1>
            <p className="mt-1 text-sm text-gray-600">
              Gérez les règles de configuration des bâtiments
            </p>
          </div>
          <Link
            href="/admin/variants"
            className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
          >
            ⚙️ Configurer les variantes
          </Link>
        </div>
      </div>

      <div className="p-8">
        {result.success ? (
          <RulesetsTable rulesets={result.data} />
        ) : (
          <div className="rounded-md bg-red-50 p-4">
            <p className="text-sm text-red-800">{result.error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
