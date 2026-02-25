"use client";

/**
 * OffreAgriTemplate — Page d'offre commerciale pour agriculteur / particulier
 *
 * Sections :
 *   0) Bâtiment : vue 3D + infos clés (type, dimensions, superficie, panneaux)
 *   1) Header metrics : Capital investi, Gain 20 ans, Gain 30 ans
 *   2) Performance KPIs : TRI, DSCR, ROI sans/avec ACC
 *   3) Trésorerie année 1 : CA, charges, EBE, annuité, tréso nette
 *   4) Besoin trésorerie : tableau des déficits + réserve recommandée
 *   5) Message stratégique
 *   6) 3 offres : Investisseur / Crédit (recommandée) / LLD
 *   7) CTA téléchargement BP
 *
 * Toutes les données viennent de OffreAgriData (pas de hardcodé).
 * Aucune dépendance shadcn/ui — HTML + Tailwind uniquement.
 */

import type { OffreAgriData } from "@/lib/types/offre";
import type { BuildingConfig } from "@/lib/types/building";
import { BUILDING_TYPE_LABELS } from "@/lib/types/building";
import dynamic from "next/dynamic";

const Building3DView = dynamic(
  () => import("../../components/building-3d-view").then((m) => m.Building3DView),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full bg-gradient-to-b from-blue-50 to-gray-100 rounded-lg text-gray-400 text-sm">
        Chargement 3D…
      </div>
    ),
  },
);

// ============================================================================
// HELPERS
// ============================================================================

function formatEUR(value: number): string {
  const parts = Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, "\u202f"); // narrow no-break space
  return `${parts} €`;
}

function formatK(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(2)} M€`;
  if (Math.abs(value) >= 1_000) return `${Math.round(value / 1_000)} k€`;
  return formatEUR(value);
}

// ============================================================================
// PROPS
// ============================================================================

interface OffreAgriTemplateProps {
  data: OffreAgriData;
  /** Nom du projet (affiché en haut) */
  projectName?: string;
  /** Config bâtiment (pour vue 3D + infos) */
  buildingConfig?: BuildingConfig | null;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function OffreAgriTemplate({ data, projectName, buildingConfig }: OffreAgriTemplateProps) {
  const tresoPositive = data.tresoNetteAnnee1 >= 0;
  const hasDeficits = data.nbAnneesDeficit > 0;
  const engagementInitial = 450; // fixe commercial

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto space-y-10">

        {/* Titre optionnel */}
        {projectName && (
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900">{projectName}</h1>
            <p className="text-sm text-gray-500 mt-1">Offre d&apos;investissement — Hangar photovoltaïque</p>
          </div>
        )}

        {/* ============================================================ */}
        {/* SECTION 0 : BATIMENT — Vue 3D + infos clés                     */}
        {/* ============================================================ */}
        {buildingConfig && (
          <div className="rounded-2xl shadow-lg bg-white overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-2">
              {/* Vue 3D */}
              <div className="min-h-[300px] md:min-h-[360px] bg-gradient-to-b from-blue-50 to-gray-100">
                <Building3DView config={buildingConfig} />
              </div>

              {/* Infos bâtiment */}
              <div className="p-8 flex flex-col justify-center space-y-5">
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  🏗️ Votre bâtiment
                </h2>

                <div className="space-y-3 text-sm">
                  <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                    <span className="text-gray-500">Type</span>
                    <span className="font-semibold text-gray-900">
                      {BUILDING_TYPE_LABELS[buildingConfig.params.type]}
                    </span>
                  </div>
                  <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                    <span className="text-gray-500">Dimensions</span>
                    <span className="font-semibold text-gray-900">
                      {buildingConfig.params.width} m × {buildingConfig.derived.length} m
                    </span>
                  </div>
                  <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                    <span className="text-gray-500">Surface au sol</span>
                    <span className="font-semibold text-gray-900">
                      {Math.round(buildingConfig.params.width * buildingConfig.derived.length).toLocaleString("fr-FR")} m²
                    </span>
                  </div>
                  <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                    <span className="text-gray-500">Surface toiture</span>
                    <span className="font-semibold text-gray-900">
                      {Math.round(buildingConfig.derived.surfaceTotal).toLocaleString("fr-FR")} m²
                    </span>
                  </div>
                  <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                    <span className="text-gray-500">Panneaux</span>
                    <span className="font-semibold text-gray-900">
                      {buildingConfig.derived.nbPanels} panneaux
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Puissance crête</span>
                    <span className="font-semibold text-emerald-700 text-base">
                      {buildingConfig.derived.powerKwc.toFixed(1)} kWc
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* HEADER METRICS                                                 */}
        {/* ============================================================ */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="rounded-2xl shadow-lg bg-gradient-to-r from-slate-800 to-slate-700 text-white p-6 text-center">
            <p className="text-sm opacity-80">Capital investi</p>
            <p className="text-3xl font-bold">{formatK(data.capitalInvesti)}</p>
          </div>

          <div className="rounded-2xl shadow-lg bg-gradient-to-r from-emerald-700 to-emerald-600 text-white p-6 text-center">
            <p className="text-sm opacity-80">Gain net exploitation 20 ans</p>
            <p className="text-3xl font-bold">
              {data.gainNet20ans >= 0 ? "+" : ""}{formatK(data.gainNet20ans)}
            </p>
            <p className="text-sm">×{data.multiplicateur20.toFixed(1)}</p>
          </div>

          <div className="rounded-2xl shadow-lg bg-gradient-to-r from-emerald-800 to-emerald-700 text-white p-6 text-center">
            <p className="text-sm opacity-80">Gain net exploitation 30 ans</p>
            <p className="text-3xl font-bold">
              {data.gainNet30ans >= 0 ? "+" : ""}{formatK(data.gainNet30ans)}
            </p>
            <p className="text-sm">×{data.multiplicateur30.toFixed(1)}</p>
          </div>
        </div>

        {/* ============================================================ */}
        {/* PERFORMANCE KPIs                                               */}
        {/* ============================================================ */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="rounded-2xl shadow bg-green-50 p-6 text-center">
            <p className="text-3xl font-bold text-green-700">
              {data.triProjetPct !== null ? `${data.triProjetPct.toFixed(2)} %` : "—"}
            </p>
            <p className="text-sm text-gray-600">TRI Projet</p>
          </div>

          <div className="rounded-2xl shadow bg-green-50 p-6 text-center">
            <p className="text-3xl font-bold text-green-700">{data.dscrMoyen.toFixed(2)}</p>
            <p className="text-sm text-gray-600">DSCR Moyen</p>
          </div>

          <div className="rounded-2xl shadow bg-amber-50 p-6 text-center">
            <p className="text-3xl font-bold text-amber-700">
              {data.roiSansAccYears !== null ? `${data.roiSansAccYears.toFixed(1)} ans` : "—"}
            </p>
            <p className="text-sm text-gray-600">ROI sans ACC</p>
          </div>

          <div className="rounded-2xl shadow bg-amber-50 p-6 text-center">
            <p className="text-3xl font-bold text-amber-700">
              {data.roiAvecAccYears !== null ? `${data.roiAvecAccYears.toFixed(1)} ans` : "—"}
            </p>
            <p className="text-sm text-gray-600">ROI avec ACC</p>
          </div>
        </div>

        {/* ============================================================ */}
        {/* TRESORERIE ANNEE 1                                             */}
        {/* ============================================================ */}
        <div className="rounded-2xl shadow-lg bg-white p-8 space-y-6">
          <h2 className="text-2xl font-semibold">💰 Trésorerie année 1</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <p>
                Chiffre d&apos;affaires : <strong>{formatEUR(data.caAnnee1)}</strong>
              </p>
              <p>
                Charges d&apos;exploitation : <strong>- {formatEUR(data.chargesAnnee1)}</strong>
              </p>
              <p className="text-green-700 font-semibold">= EBE : {formatEUR(data.ebeAnnee1)}</p>
            </div>
            <div className="space-y-2">
              <p>
                Remboursement crédit : <strong>- {formatEUR(data.annuiteAnnee1)}</strong>
              </p>
              <p className={`text-xl font-bold ${tresoPositive ? "text-green-700" : "text-red-600"}`}>
                Trésorerie nette : {tresoPositive ? "" : "- "}{formatEUR(Math.abs(data.tresoNetteAnnee1))}
              </p>
            </div>
          </div>

          <div className="bg-blue-50 p-6 rounded-2xl text-sm text-gray-700">
            {tresoPositive ? (
              <p>
                <strong>Bonne nouvelle :</strong> vos revenus solaires couvrent toutes les charges
                ET le remboursement du crédit dès la première année. Vous n&apos;avez aucun argent à sortir de votre poche.
              </p>
            ) : (
              <p>
                Le résultat net comptable ({formatEUR(data.tresoNetteAnnee1)}) est négatif, mais ce n&apos;est pas une perte réelle.
                Votre hangar génère <strong>{formatEUR(data.ebeAnnee1)} par an</strong> de trésorerie brute.
                {data.anneeEquilibre !== null
                  ? ` Dès l'année ${data.anneeEquilibre}, la trésorerie devient positive.`
                  : ""}
              </p>
            )}
          </div>
        </div>

        {/* ============================================================ */}
        {/* BESOIN TRESORERIE                                              */}
        {/* ============================================================ */}
        {hasDeficits && (
          <div className="rounded-2xl shadow-lg border-2 border-emerald-400 bg-white p-8 space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-semibold">🏦 Combien prévoir de côté ?</h2>
              <span className="text-2xl font-bold text-emerald-700">{formatEUR(data.reserveTotal)}</span>
            </div>

            <p className="text-gray-700">
              Les {data.nbAnneesDeficit} premières années, le remboursement du crédit est légèrement supérieur aux revenus.
              Le manque total sur cette période est de <strong>{formatEUR(data.reserveTotal)}</strong>.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Année</th>
                    <th className="text-right py-2">À sortir</th>
                    <th className="text-right py-2">Reste en réserve</th>
                  </tr>
                </thead>
                <tbody>
                  {data.deficits.map((d) => (
                    <tr key={d.year} className="border-b last:border-0">
                      <td>An {d.year}</td>
                      <td className="text-right text-red-600">{formatEUR(d.deficit)}</td>
                      <td className="text-right">{formatEUR(d.resteReserve)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* MESSAGE STRATEGIQUE                                            */}
        {/* ============================================================ */}
        <div className="rounded-2xl shadow-xl bg-gradient-to-r from-emerald-700 to-emerald-600 text-white p-10 text-center space-y-6">
          {hasDeficits ? (
            <>
              <h2 className="text-3xl font-bold">
                {formatEUR(data.reserveTotal)} pour générer {formatK(data.gainNet30ans)}
              </h2>
              <p className="text-lg opacity-90">
                Avec seulement <strong>{formatEUR(data.reserveTotal)}</strong> de trésorerie de sécurité, vous enclenchez un actif capable de générer{" "}
                <strong>{data.gainNet30ans >= 0 ? "+" : ""}{formatK(data.gainNet30ans)}</strong> sur 30 ans.
              </p>

              {data.downPayment > 0 && data.downPayment > data.reserveTotal && (
                <div className="bg-white p-6 rounded-2xl shadow-lg border-2 border-emerald-300 text-gray-800">
                  <p className="font-bold text-emerald-700 text-lg">💡 Astuce optimisation apport</p>
                  <p className="text-sm mt-3 leading-relaxed">
                    Vous disposez d&apos;un apport de <strong>{formatEUR(data.downPayment)}</strong> ? N&apos;utilisez pas tout pour le projet. Conservez{" "}
                    <strong>{formatEUR(data.reserveTotal)}</strong> sur un Livret A pour couvrir les premières années et laissez le reste travailler intelligemment.
                  </p>
                </div>
              )}
            </>
          ) : (
            <>
              <h2 className="text-3xl font-bold">
                Un investissement autofinancé dès le jour 1
              </h2>
              <p className="text-lg opacity-90">
                Votre hangar photovoltaïque génère <strong>{formatK(data.gainNet30ans)}</strong> de gain net sur 30 ans,
                sans aucun argent à sortir de votre poche.
              </p>
            </>
          )}
        </div>

        {/* ============================================================ */}
        {/* OFFRES EN 3 COLONNES                                           */}
        {/* ============================================================ */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* OFFRE INVESTISSEUR */}
          <div className="rounded-2xl shadow-2xl border-2 border-slate-800 bg-gradient-to-br from-slate-900 to-slate-700 text-white p-8 text-center space-y-6">
            <h2 className="text-2xl font-bold">🤝 Offre Investisseur</h2>
            <p className="text-sm text-slate-200">0 € investi. Bâtiment financé par un tiers investisseur.</p>
            <ul className="text-sm text-slate-200 space-y-2">
              <li>✔ Aucune dette</li>
              <li>✔ Sécurité maximale</li>
              <li>✔ Revenus contractuels</li>
            </ul>
            <button className="rounded-2xl px-8 py-4 w-full bg-white text-slate-900 hover:bg-slate-200 font-semibold transition-colors">
              Lancer l&apos;appel d&apos;offre
            </button>
          </div>

          {/* OFFRE CREDIT (RECOMMANDEE) */}
          <div className="rounded-2xl shadow-2xl border-2 border-emerald-600 bg-emerald-50 relative p-8 text-center space-y-6">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-700 text-white text-xs px-4 py-1 rounded-full">
              Recommandée
            </div>
            <h2 className="text-2xl font-bold">🏦 Offre Crédit</h2>
            <p className="text-sm text-gray-700">Vous êtes propriétaire du bâtiment et de la centrale.</p>
            <ul className="text-sm text-gray-600 space-y-2">
              <li>✔ Actif amortissable</li>
              <li>✔ Création de patrimoine</li>
              <li>✔ Rentabilité maximale long terme</li>
            </ul>

            <div className="bg-white border border-emerald-300 rounded-xl p-4 text-sm text-gray-700">
              🔒 Engagement initial : <strong>{formatEUR(engagementInitial)}</strong>
              <div className="mt-1">Permet de bloquer le financement et lancer l&apos;étude bancaire.</div>
              <span className="block mt-2 text-emerald-600 font-semibold">Remboursable si le financement n&apos;est pas validé.</span>
            </div>

            <button className="rounded-2xl px-8 py-4 w-full bg-emerald-700 text-white hover:bg-emerald-800 font-semibold transition-colors">
              Réserver le financement ({formatEUR(engagementInitial)})
            </button>
          </div>

          {/* OFFRE LLD */}
          <div className="rounded-2xl shadow-lg bg-orange-100 border-2 border-orange-300 p-8 text-center space-y-6">
            <h2 className="text-2xl font-bold">📄 Offre LLD</h2>
            <p className="text-sm text-gray-700">Pas d&apos;endettement. Loyer fixe. Optimisation fiscale et option d&apos;achat en fin de contrat.</p>
            <ul className="text-sm text-gray-600 space-y-2">
              <li>✔ Pas d&apos;apport important</li>
              <li>✔ Impact bilan maîtrisé</li>
              <li>✔ Souplesse financière</li>
            </ul>
            <button className="rounded-2xl px-8 py-4 w-full bg-orange-500 text-white hover:bg-orange-600 font-semibold transition-colors">
              Étudier la LLD
            </button>
          </div>
        </div>

        {/* ============================================================ */}
        {/* CTA TELECHARGEMENT                                             */}
        {/* ============================================================ */}
        <div className="text-center pt-10">
          <button className="rounded-2xl px-10 py-6 text-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 font-semibold transition-colors">
            Télécharger le Business Plan complet
          </button>
        </div>

        {/* ============================================================ */}
        {/* METADONNEES                                                    */}
        {/* ============================================================ */}
        <div className="flex items-center justify-between text-[10px] text-gray-400 pb-8">
          <span>
            {data.kwc.toFixed(1)} kWc · {data.productionAnnuelleKwh.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} kWh/an
          </span>
          <span>
            Calculé le {new Date(data.validatedAt).toLocaleDateString("fr-FR", {
              day: "numeric", month: "long", year: "numeric",
            })}
          </span>
        </div>
      </div>
    </div>
  );
}
