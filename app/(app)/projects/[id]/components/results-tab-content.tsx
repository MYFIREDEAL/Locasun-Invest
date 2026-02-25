"use client";

/**
 * Composant d'affichage des résultats PVGIS
 * Affiche: kWh/an, kWh/kWc, tableau mensuel par pan
 */

import { useState, useEffect, useCallback } from "react";
import type { Project } from "@/lib/types/project";
import type { PvgisResult } from "@/lib/types/pvgis";
import { getPvgisResult } from "@/lib/actions/pvgis";
import { getBuildingConfig } from "@/lib/actions/building-configs";

interface ResultsTabContentProps {
  project: Project;
}

const MONTHS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
];

export function ResultsTabContent({ project }: ResultsTabContentProps) {
  const [result, setResult] = useState<PvgisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLocation, setHasLocation] = useState(false);
  const [hasConfig, setHasConfig] = useState(false);

  // Charger le résultat existant
  const loadResult = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    // Vérifier si la config existe
    const configResult = await getBuildingConfig(project.id);
    if (!configResult.success || !configResult.data) {
      setHasConfig(false);
      setLoading(false);
      return;
    }
    
    setHasConfig(true);
    
    // Vérifier si l'implantation est configurée
    const config = configResult.data;
    if (!config.centroid_lat || !config.centroid_lon) {
      setHasLocation(false);
      setLoading(false);
      return;
    }
    
    setHasLocation(true);
    
    // Charger le résultat PVGIS
    const pvgisResult = await getPvgisResult(project.id);
    if (pvgisResult.success && pvgisResult.data) {
      setResult(pvgisResult.data);
    }
    
    setLoading(false);
  }, [project.id]);

  useEffect(() => {
    loadResult();
  }, [loadResult]);

  // Lancer le calcul PVGIS
  const handleCalculate = async (forceRecalculate = false) => {
    setCalculating(true);
    setError(null);
    
    try {
      const response = await fetch("/api/pvgis/calc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          projectId: project.id,
          forceRecalculate,
        }),
      });
      
      const data = await response.json();
      
      if (!data.success) {
        setError(data.error || "Erreur lors du calcul");
      } else {
        setResult(data.data);
      }
    } catch {
      setError("Erreur de connexion au serveur");
    } finally {
      setCalculating(false);
    }
  };

  // État de chargement
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Chargement des résultats...</div>
      </div>
    );
  }

  // Pas de configuration
  if (!hasConfig) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
        <div className="text-4xl mb-4">⚙️</div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Configuration requise
        </h3>
        <p className="text-sm text-gray-500">
          Configurez d&apos;abord le bâtiment dans l&apos;onglet Configuration.
        </p>
      </div>
    );
  }

  // Pas d'implantation
  if (!hasLocation) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
        <div className="text-4xl mb-4">🗺️</div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Implantation requise
        </h3>
        <p className="text-sm text-gray-500">
          Placez le bâtiment sur la carte dans l&apos;onglet Carte pour calculer la production solaire.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header avec bouton calcul */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Production solaire (PVGIS)
          </h2>
          <p className="text-sm text-gray-500">
            Estimation basée sur les données de l&apos;API européenne PVGIS
          </p>
        </div>
        <div className="flex gap-2">
          {result && (
            <button
              onClick={() => handleCalculate(true)}
              disabled={calculating}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {calculating ? "Calcul..." : "Recalculer"}
            </button>
          )}
          {!result && (
            <button
              onClick={() => handleCalculate(false)}
              disabled={calculating}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {calculating ? "Calcul en cours..." : "Calculer la production"}
            </button>
          )}
        </div>
      </div>

      {/* Erreur */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Pas de résultat encore */}
      {!result && !calculating && !error && (
        <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
          <div className="text-4xl mb-4">☀️</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Prêt pour le calcul
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            Cliquez sur &quot;Calculer la production&quot; pour lancer la simulation PVGIS.
          </p>
        </div>
      )}

      {/* Résultats */}
      {result && (
        <>
          {/* KPIs principaux */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-green-200 bg-green-50 p-6">
              <p className="text-3xl font-bold text-green-700">
                {formatNumber(result.totals.annualKwh)}
              </p>
              <p className="text-sm text-green-600">Production annuelle (kWh)</p>
            </div>
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-6">
              <p className="text-3xl font-bold text-blue-700">
                {result.totals.peakPowerKwc.toFixed(1)}
              </p>
              <p className="text-sm text-blue-600">Puissance installée (kWc)</p>
            </div>
            <div className="rounded-lg border border-purple-200 bg-purple-50 p-6">
              <p className="text-3xl font-bold text-purple-700">
                {result.totals.annualKwhPerKwc}
              </p>
              <p className="text-sm text-purple-600">Rendement (kWh/kWc)</p>
            </div>
          </div>

          {/* Détail par pan */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h3 className="text-md font-semibold text-gray-900 mb-4">
              Production par pan de toiture
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              {result.pans.map((pan) => (
                <div 
                  key={pan.panId}
                  className={`rounded-lg p-4 ${
                    pan.panId === "A" 
                      ? "bg-blue-50 border border-blue-200" 
                      : "bg-orange-50 border border-orange-200"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold">{pan.label}</span>
                    <span className="text-sm text-gray-500">
                      {pan.peakPowerKwc.toFixed(1)} kWc
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-gray-500">Production:</span>
                      <span className="ml-1 font-medium">{formatNumber(pan.annualKwh)} kWh/an</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Rendement:</span>
                      <span className="ml-1 font-medium">{pan.annualKwhPerKwc} kWh/kWc</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Azimut:</span>
                      <span className="ml-1 font-medium">{pan.inputAzimuthDeg}°</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Inclinaison:</span>
                      <span className="ml-1 font-medium">{pan.tiltDeg.toFixed(1)}°</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tableau mensuel */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h3 className="text-md font-semibold text-gray-900 mb-4">
              Production mensuelle
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Mois
                    </th>
                    {result.pans.map((pan) => (
                      <th 
                        key={pan.panId}
                        className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        {pan.label}
                      </th>
                    ))}
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {MONTHS.map((month, idx) => (
                    <tr key={month} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                        {month}
                      </td>
                      {result.pans.map((pan) => (
                        <td 
                          key={pan.panId}
                          className="px-4 py-2 whitespace-nowrap text-sm text-right text-gray-500"
                        >
                          {formatNumber(pan.monthlyKwh[idx] ?? 0)}
                        </td>
                      ))}
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                        {formatNumber(result.totals.monthlyKwh[idx] ?? 0)}
                      </td>
                    </tr>
                  ))}
                  {/* Ligne total */}
                  <tr className="bg-gray-100 font-semibold">
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                      Total annuel
                    </td>
                    {result.pans.map((pan) => (
                      <td 
                        key={pan.panId}
                        className="px-4 py-2 whitespace-nowrap text-sm text-right text-gray-900"
                      >
                        {formatNumber(pan.annualKwh)}
                      </td>
                    ))}
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-right text-gray-900">
                      {formatNumber(result.totals.annualKwh)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Infos de calcul */}
          <div className="text-xs text-gray-400 text-right">
            Calculé le {new Date(result.calculatedAt).toLocaleString("fr-FR")} • 
            Position: {result.location.lat.toFixed(4)}°, {result.location.lon.toFixed(4)}°
          </div>
        </>
      )}
    </div>
  );
}

// Helper pour formater les nombres
function formatNumber(n: number): string {
  return n.toLocaleString("fr-FR", { maximumFractionDigits: 0 });
}
