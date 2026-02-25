/**
 * API Route: GET /api/parcelle
 * Récupère les informations parcellaires autour d'un point :
 * - Cadastre (APICarto) : numéro de parcelle, section, commune, surface
 * - Zone urbanisme GPU (APICarto) : type de zone PLU/POS
 * - Natura 2000 (APICarto) : sites intersectés
 * - Géorisques : risques naturels de la commune
 *
 * Query params:
 * - lat: latitude (obligatoire)
 * - lng: longitude (obligatoire)
 *
 * Response: ParcelleApiResponse
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type {
  CadastreFeature,
  ZoneUrbaFeature,
  Natura2000Feature,
  GeorisquesData,
  ParcelleInfo,
  MairieInfo,
  MairieHoraire,
} from "@/lib/types/parcelle";
import { getZoneVent } from "@/lib/types/vent-eurocode";

const querySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

// Timeout pour les appels externes (10s)
const FETCH_TIMEOUT = 10_000;

async function fetchWithTimeout(url: string, timeoutMs: number = FETCH_TIMEOUT): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
}

/** Construit le paramètre geom GeoJSON Point pour APICarto */
function geomParam(lng: number, lat: number): string {
  return encodeURIComponent(JSON.stringify({ type: "Point", coordinates: [lng, lat] }));
}

/** Appelle APICarto cadastre/parcelle */
async function fetchCadastre(lng: number, lat: number): Promise<CadastreFeature | null> {
  try {
    const url = `https://apicarto.ign.fr/api/cadastre/parcelle?geom=${geomParam(lng, lat)}`;
    const res = await fetchWithTimeout(url);
    if (!res.ok) return null;
    const json = await res.json() as { features?: CadastreFeature[] };
    return json.features?.[0] ?? null;
  } catch {
    console.warn("[parcelle] Cadastre API failed");
    return null;
  }
}

/** Appelle APICarto GPU zone-urba */
async function fetchZoneUrba(lng: number, lat: number): Promise<ZoneUrbaFeature | null> {
  try {
    const url = `https://apicarto.ign.fr/api/gpu/zone-urba?geom=${geomParam(lng, lat)}`;
    const res = await fetchWithTimeout(url);
    if (!res.ok) return null;
    const json = await res.json() as { features?: ZoneUrbaFeature[] };
    return json.features?.[0] ?? null;
  } catch {
    console.warn("[parcelle] GPU zone-urba API failed");
    return null;
  }
}

/** Appelle APICarto nature/natura-habitat (Natura 2000) */
async function fetchNatura2000(lng: number, lat: number): Promise<Natura2000Feature[]> {
  try {
    const url = `https://apicarto.ign.fr/api/nature/natura-habitat?geom=${geomParam(lng, lat)}`;
    const res = await fetchWithTimeout(url);
    if (!res.ok) return [];
    const json = await res.json() as { features?: Natura2000Feature[] };
    return json.features ?? [];
  } catch {
    console.warn("[parcelle] Natura 2000 API failed");
    return [];
  }
}

/** Appelle Géorisques GASPAR /risques par code INSEE */
async function fetchGeorisques(codeInsee: string): Promise<GeorisquesData | null> {
  try {
    const url = `https://georisques.gouv.fr/api/v1/gaspar/risques?code_insee=${codeInsee}`;
    const res = await fetchWithTimeout(url);
    if (!res.ok) return null;
    const json = await res.json() as { data?: GeorisquesData[] };
    return json.data?.[0] ?? null;
  } catch {
    console.warn("[parcelle] Géorisques API failed");
    return null;
  }
}

// ============================================================================
// ALTITUDE (Open Elevation API)
// ============================================================================

/** Récupère l'altitude en mètres via Open Elevation API */
async function fetchAltitude(lat: number, lng: number): Promise<number | null> {
  try {
    const url = `https://api.open-elevation.com/api/v1/lookup?locations=${lat},${lng}`;
    const res = await fetchWithTimeout(url);
    if (!res.ok) return null;
    const json = await res.json() as { results?: { elevation: number }[] };
    return json.results?.[0]?.elevation ?? null;
  } catch {
    console.warn("[parcelle] Open Elevation API failed");
    return null;
  }
}

// ============================================================================
// ADRESSE (BAN reverse geocoding + fallback Nominatim)
// ============================================================================

interface AdresseResult {
  label: string;
  rue: string | null;
  codePostal: string | null;
}

/**
 * Reverse-geocode : essaie d'abord l'API BAN (data.gouv.fr).
 * Si aucun résultat (zone rurale), fallback sur Nominatim (OSM).
 */
async function fetchAdresse(lat: number, lng: number): Promise<AdresseResult | null> {
  // 1) Essai BAN
  try {
    const banUrl = `https://api-adresse.data.gouv.fr/reverse/?lon=${lng}&lat=${lat}&limit=1`;
    const banRes = await fetchWithTimeout(banUrl, 5_000);
    if (banRes.ok) {
      const banJson = await banRes.json() as {
        features?: {
          properties?: {
            label?: string;
            street?: string;
            name?: string;
            postcode?: string;
          };
        }[];
      };
      const props = banJson.features?.[0]?.properties;
      if (props?.label) {
        return {
          label: props.label,
          rue: props.street ?? props.name ?? null,
          codePostal: props.postcode ?? null,
        };
      }
    }
  } catch {
    console.warn("[parcelle] BAN reverse API failed");
  }

  // 2) Fallback Nominatim (OSM)
  try {
    const nomUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
    const nomRes = await fetchWithTimeout(nomUrl, 5_000);
    if (nomRes.ok) {
      const nomJson = await nomRes.json() as {
        display_name?: string;
        address?: {
          road?: string;
          postcode?: string;
          village?: string;
          town?: string;
          city?: string;
          hamlet?: string;
        };
      };
      if (nomJson.display_name) {
        const addr = nomJson.address;
        const rue = addr?.road ?? null;
        const commune = addr?.village ?? addr?.town ?? addr?.city ?? addr?.hamlet ?? null;
        const cp = addr?.postcode ?? null;
        // Construire un label plus propre que display_name (qui est très long)
        const parts: string[] = [];
        if (rue) parts.push(rue);
        if (cp) parts.push(cp);
        if (commune) parts.push(commune);
        const label = parts.length > 0 ? parts.join(", ") : nomJson.display_name;

        return { label, rue, codePostal: cp };
      }
    }
  } catch {
    console.warn("[parcelle] Nominatim reverse API failed");
  }

  return null;
}

// ============================================================================
// MAIRIE (API Annuaire service-public.fr)
// ============================================================================

/** Appelle l'API Annuaire service-public.fr pour récupérer les infos mairie */
async function fetchMairie(codeInsee: string): Promise<MairieInfo | null> {
  try {
    const where = encodeURIComponent(`pivot LIKE "mairie" AND code_insee_commune="${codeInsee}"`);
    const url = `https://api-lannuaire.service-public.fr/api/explore/v2.1/catalog/datasets/api-lannuaire-administration/records?where=${where}&limit=1`;
    const res = await fetchWithTimeout(url, 8_000);
    if (!res.ok) return null;

    const json = await res.json() as {
      results?: {
        nom?: string;
        telephone?: string;
        adresse_courriel?: string;
        adresse?: string;
        site_internet?: string;
        url_service_public?: string;
        plage_ouverture?: string;
      }[];
    };

    const record = json.results?.[0];
    if (!record) return null;

    // Parse téléphones (JSON array)
    let telephones: string[] = [];
    if (record.telephone) {
      try {
        const telArr = JSON.parse(record.telephone) as { valeur?: string }[];
        telephones = telArr.map(t => t.valeur ?? "").filter(Boolean);
      } catch { /* ignore */ }
    }

    // Parse adresse (JSON array → première adresse)
    let adresseStr: string | null = null;
    if (record.adresse) {
      try {
        const addrArr = JSON.parse(record.adresse) as {
          numero_voie?: string;
          code_postal?: string;
          nom_commune?: string;
        }[];
        const addr = addrArr[0];
        if (addr) {
          const parts = [addr.numero_voie, addr.code_postal, addr.nom_commune].filter(Boolean);
          adresseStr = parts.join(", ");
        }
      } catch { /* ignore */ }
    }

    // Parse site internet (JSON array)
    let siteInternet: string | null = null;
    if (record.site_internet) {
      try {
        const sites = JSON.parse(record.site_internet) as { valeur?: string }[];
        siteInternet = sites[0]?.valeur ?? null;
      } catch { /* ignore */ }
    }

    // Parse horaires (JSON array)
    let horaires: MairieHoraire[] = [];
    if (record.plage_ouverture) {
      try {
        const plages = JSON.parse(record.plage_ouverture) as {
          nom_jour_debut?: string;
          nom_jour_fin?: string;
          valeur_heure_debut_1?: string;
          valeur_heure_fin_1?: string;
          valeur_heure_debut_2?: string;
          valeur_heure_fin_2?: string;
          commentaire?: string;
        }[];
        horaires = plages.map(p => ({
          jourDebut: p.nom_jour_debut ?? "",
          jourFin: p.nom_jour_fin ?? "",
          heureDebut1: (p.valeur_heure_debut_1 ?? "").slice(0, 5),
          heureFin1: (p.valeur_heure_fin_1 ?? "").slice(0, 5),
          heureDebut2: (p.valeur_heure_debut_2 ?? "").slice(0, 5),
          heureFin2: (p.valeur_heure_fin_2 ?? "").slice(0, 5),
          commentaire: p.commentaire ?? "",
        }));
      } catch { /* ignore */ }
    }

    return {
      nom: record.nom ?? "Mairie",
      telephones,
      email: record.adresse_courriel ?? null,
      adresse: adresseStr,
      siteInternet,
      urlServicePublic: record.url_service_public ?? null,
      horaires,
    };
  } catch {
    console.warn("[parcelle] Mairie service-public API failed");
    return null;
  }
}

// ============================================================================
// DISTANCE OCÉAN (Overpass API – coastline)
// ============================================================================

/**
 * Calcule la distance Haversine entre deux points (en km)
 */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Rayon Terre km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Recherche les coastlines dans un rayon donné et retourne la distance min.
 * Utilise l'Overpass API (OSM). Cherche d'abord à 5km, puis 20km, puis 100km.
 * Si rien trouvé à 100km, retourne null (très loin de la côte).
 */
async function fetchDistanceOcean(lat: number, lng: number): Promise<number | null> {
  const radii = [5000, 20000, 100000]; // mètres

  for (const radius of radii) {
    try {
      const query = `[out:json];way[natural=coastline](around:${radius},${lat},${lng});out geom;`;
      const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
      const res = await fetchWithTimeout(url, 15_000);
      if (!res.ok) continue;
      const json = await res.json() as {
        elements?: {
          geometry?: { lat: number; lon: number }[];
        }[];
      };
      const elements = json.elements ?? [];
      if (elements.length === 0) continue;

      // Trouver le point de coastline le plus proche
      let minDist = Infinity;
      for (const way of elements) {
        for (const pt of way.geometry ?? []) {
          const d = haversineKm(lat, lng, pt.lat, pt.lon);
          if (d < minDist) minDist = d;
        }
      }
      return Math.round(minDist * 100) / 100; // arrondi 2 décimales
    } catch {
      console.warn(`[parcelle] Overpass coastline failed (radius ${radius}m)`);
    }
  }

  return null; // Pas de coastline trouvée à 100km → très loin
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;

    const parsed = querySchema.safeParse({
      lat: searchParams.get("lat"),
      lng: searchParams.get("lng"),
    });

    if (!parsed.success) {
      const firstError = parsed.error.issues[0];
      return NextResponse.json(
        { error: `Paramètres invalides: ${firstError?.message ?? "vérifiez lat, lng"}` },
        { status: 400 }
      );
    }

    const { lat, lng } = parsed.data;

    // Optionnel : coins du bâtiment pour détecter les parcelles secondaires
    // Format: JSON array of [lat, lng] pairs — ex: [[43.6,1.4],[43.61,1.41],...]
    const cornersParam = searchParams.get("corners");
    let buildingCorners: [number, number][] = [];
    if (cornersParam) {
      try {
        const parsed = JSON.parse(cornersParam) as [number, number][];
        if (Array.isArray(parsed) && parsed.every(c => Array.isArray(c) && c.length === 2)) {
          buildingCorners = parsed;
        }
      } catch { /* ignore malformed corners */ }
    }

    // Phase 1 : Cadastre + GPU + Natura + Altitude + Distance océan + Adresse en parallèle
    const [cadastreFeature, zoneUrbaFeature, natura2000Features, altitudeM, distanceOceanKm, adresse] = await Promise.all([
      fetchCadastre(lng, lat),
      fetchZoneUrba(lng, lat),
      fetchNatura2000(lng, lat),
      fetchAltitude(lat, lng),
      fetchDistanceOcean(lat, lng),
      fetchAdresse(lat, lng),
    ]);

    // Phase 1b : Parcelles secondaires — requêter le cadastre + zone-urba pour chaque coin du bâtiment
    const primaryIdu = cadastreFeature?.properties.idu ?? null;
    const parcellesSecondaires: { cadastre: CadastreFeature["properties"]; geometry: GeoJSON.MultiPolygon; zoneUrba: ZoneUrbaFeature["properties"] | null }[] = [];

    if (buildingCorners.length > 0 && primaryIdu) {
      const cornerResults = await Promise.all(
        buildingCorners.map(async ([cLat, cLng]) => {
          const [cadastre, zoneUrba] = await Promise.all([
            fetchCadastre(cLng, cLat),
            fetchZoneUrba(cLng, cLat),
          ]);
          return { cadastre, zoneUrba };
        })
      );
      const seenIdus = new Set<string>([primaryIdu]);
      for (const { cadastre: feature, zoneUrba } of cornerResults) {
        if (!feature) continue;
        const idu = feature.properties.idu;
        if (seenIdus.has(idu)) continue;
        seenIdus.add(idu);
        parcellesSecondaires.push({
          cadastre: feature.properties,
          geometry: feature.geometry,
          zoneUrba: zoneUrba?.properties ?? null,
        });
      }
    }

    // Phase 2 : Géorisques + Mairie nécessitent le code INSEE (trouvé via cadastre)
    const codeInsee = cadastreFeature?.properties.code_insee ?? null;
    const [georisquesData, mairieInfo] = codeInsee
      ? await Promise.all([fetchGeorisques(codeInsee), fetchMairie(codeInsee)])
      : [null, null];

    // Zone vent Eurocode : déterminée par le département
    const codeDep = cadastreFeature?.properties.code_dep ?? null;
    const zoneVentInfo = codeDep ? getZoneVent(codeDep) : null;

    const result: ParcelleInfo = {
      cadastre: cadastreFeature?.properties ?? null,
      cadastreGeometry: cadastreFeature?.geometry ?? null,
      parcellesSecondaires,
      zoneUrba: zoneUrbaFeature?.properties ?? null,
      zoneUrbaGeometry: zoneUrbaFeature?.geometry ?? null,
      natura2000: natura2000Features.map((f: Natura2000Feature) => f.properties),
      risques: georisquesData?.risques_detail ?? [],
      communeRisques: georisquesData?.libelle_commune ?? null,
      adresseLabel: adresse?.label ?? null,
      adresseRue: adresse?.rue ?? null,
      adresseCodePostal: adresse?.codePostal ?? null,
      altitudeM,
      distanceOceanKm,
      isProximiteOcean: distanceOceanKm !== null && distanceOceanKm < 3,
      zoneVent: zoneVentInfo?.zone ?? null,
      ventVb0Ms: zoneVentInfo?.vb0Ms ?? null,
      ventVb0Kmh: zoneVentInfo?.vb0Kmh ?? null,
      mairie: mairieInfo,
    };

    return NextResponse.json({
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[API /api/parcelle] Erreur:", err);
    return NextResponse.json(
      { error: "Erreur interne lors de la récupération des données parcellaires" },
      { status: 500 }
    );
  }
}
