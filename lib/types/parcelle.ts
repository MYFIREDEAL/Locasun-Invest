/**
 * Types pour le module d'identification parcellaire
 * Cadastre (APICarto), Zone urbanisme (GPU), Natura 2000, Géorisques
 */

// ============================================================================
// CADASTRE (APICarto /cadastre/parcelle)
// ============================================================================

/** Propriétés d'une parcelle cadastrale */
export interface CadastreProperties {
  /** ID interne */
  gid: number;
  /** Numéro de parcelle (ex: "0519") */
  numero: string;
  /** Numéro de feuille */
  feuille: number;
  /** Section cadastrale (ex: "0D") */
  section: string;
  /** Code département (ex: "40") */
  code_dep: string;
  /** Nom de la commune (ex: "Le Vignau") */
  nom_com: string;
  /** Code commune (ex: "329") */
  code_com: string;
  /** Code commune absorbée */
  com_abs: string;
  /** Identifiant unique parcelle (ex: "403290000D0519") */
  idu: string;
  /** Surface en m² */
  contenance: number;
  /** Code INSEE (ex: "40329") */
  code_insee: string;
}

/** Feature GeoJSON d'une parcelle cadastrale */
export interface CadastreFeature {
  type: "Feature";
  geometry: GeoJSON.MultiPolygon;
  properties: CadastreProperties;
}

// ============================================================================
// GPU / ZONE URBANISME (APICarto /gpu/zone-urba)
// ============================================================================

/**
 * Type de zone urbanisme PLU/POS/CC
 * U = Urbaine, AU = À Urbaniser, A = Agricole, N = Naturelle
 * AUc = AU contrainte, AUs = AU strict
 */
export type TypeZone = "U" | "AU" | "AUc" | "AUs" | "A" | "N" | "Nh" | string;

/** Propriétés d'une zone d'urbanisme */
export interface ZoneUrbaProperties {
  /** ID interne */
  gid: number;
  /** Libellé court (ex: "A", "N", "Ua", "2AU") */
  libelle: string;
  /** Libellé long (ex: "Zone agricole") */
  libelong: string;
  /** Type de zone (ex: "A", "N", "U", "AUc") */
  typezone: TypeZone;
  /** Destination dominante */
  destdomi: string | null;
  /** Partition du document */
  partition: string;
  /** Identifiant document urbanisme */
  idurba: string | null;
  /** Nom du fichier règlement */
  nomfic: string;
  /** URL vers le règlement / sommaire du document d'urbanisme */
  urlfic: string | null;
}

/** Feature GeoJSON d'une zone urbanisme */
export interface ZoneUrbaFeature {
  type: "Feature";
  geometry: GeoJSON.MultiPolygon;
  properties: ZoneUrbaProperties;
}

// ============================================================================
// NATURA 2000 (APICarto /nature/natura-habitat)
// ============================================================================

/** Propriétés d'un site Natura 2000 */
export interface Natura2000Properties {
  /** Identifiant du site */
  sitecode: string;
  /** Nom du site */
  sitename: string;
  /** Type de site (SIC, ZPS, etc.) */
  sitetype: string;
}

/** Feature GeoJSON Natura 2000 */
export interface Natura2000Feature {
  type: "Feature";
  geometry: GeoJSON.MultiPolygon | GeoJSON.Polygon;
  properties: Natura2000Properties;
}

// ============================================================================
// GEORISQUES (/gaspar/risques)
// ============================================================================

/** Détail d'un risque Géorisques */
export interface RisqueDetail {
  /** Numéro du risque */
  num_risque: string;
  /** Libellé long (ex: "Mouvement de terrain", "Séisme") */
  libelle_risque_long: string;
  /** Zone de sismicité (null si non applicable) */
  zone_sismicite: string | null;
}

/** Réponse Géorisques pour une commune */
export interface GeorisquesData {
  /** Détails des risques */
  risques_detail: RisqueDetail[];
  /** Code INSEE de la commune */
  code_insee: string;
  /** Nom de la commune */
  libelle_commune: string;
}

// ============================================================================
// MAIRIE (API Annuaire service-public.fr)
// ============================================================================

/** Plage horaire d'ouverture de la mairie */
export interface MairieHoraire {
  /** Ex: "Lundi" */
  jourDebut: string;
  /** Ex: "Lundi" (souvent identique) */
  jourFin: string;
  /** Ex: "08:30" */
  heureDebut1: string;
  /** Ex: "12:00" */
  heureFin1: string;
  /** Ex: "14:00" (ou vide si pas de 2e plage) */
  heureDebut2: string;
  /** Ex: "17:00" (ou vide) */
  heureFin2: string;
  /** Commentaire libre */
  commentaire: string;
}

/** Informations de la mairie de la commune */
export interface MairieInfo {
  /** Nom (ex: "Mairie - Le Vignau") */
  nom: string;
  /** Numéro(s) de téléphone */
  telephones: string[];
  /** Email de contact */
  email: string | null;
  /** Adresse postale (ex: "117 avenue de Chalampé, 40270 Le Vignau") */
  adresse: string | null;
  /** URL du site internet */
  siteInternet: string | null;
  /** URL fiche lannuaire.service-public.fr */
  urlServicePublic: string | null;
  /** Horaires d'ouverture */
  horaires: MairieHoraire[];
}

// ============================================================================
// RÉSULTAT COMBINÉ
// ============================================================================

/** Résultat combiné de toutes les API parcellaires */
export interface ParcelleInfo {
  /** Données cadastrales (parcelle principale — sous le centroïde du bâtiment) */
  cadastre: CadastreProperties | null;
  /** Géométrie de la parcelle cadastrale (pour affichage sur la carte) */
  cadastreGeometry: GeoJSON.MultiPolygon | null;
  /** Parcelles secondaires (coins du bâtiment sur d'autres parcelles) */
  parcellesSecondaires: {
    cadastre: CadastreProperties;
    geometry: GeoJSON.MultiPolygon;
    /** Zone urbanisme de la parcelle secondaire (pour détection conflit de zones) */
    zoneUrba: ZoneUrbaProperties | null;
  }[];
  /** Zone urbanisme PLU/POS (première zone trouvée) */
  zoneUrba: ZoneUrbaProperties | null;
  /** Géométrie de la zone urbanisme */
  zoneUrbaGeometry: GeoJSON.MultiPolygon | null;
  /** Sites Natura 2000 intersectés */
  natura2000: Natura2000Properties[];
  /** Risques Géorisques de la commune */
  risques: RisqueDetail[];
  /** Nom commune Géorisques */
  communeRisques: string | null;

  // --- Adresse (BAN reverse geocoding / Nominatim fallback) ---

  /** Adresse complète (ex: "18 Rue de la République 69002 Lyon") */
  adresseLabel: string | null;
  /** Nom de la rue / voie */
  adresseRue: string | null;
  /** Code postal */
  adresseCodePostal: string | null;

  // --- Données environnementales ---

  /** Altitude du site en mètres (Open Elevation API) */
  altitudeM: number | null;
  /** Distance à la côte océanique la plus proche en km (Overpass API) */
  distanceOceanKm: number | null;
  /** true si le site est à moins de 3 km de l'océan → surcoût galvanisation +15€/m² */
  isProximiteOcean: boolean;
  /** Zone vent Eurocode EN 1991-1-4 (1 à 4) */
  zoneVent: number | null;
  /** Vitesse de base Vb0 en m/s */
  ventVb0Ms: number | null;
  /** Vitesse de base Vb0 en km/h */
  ventVb0Kmh: number | null;

  // --- Mairie (Annuaire service-public.fr) ---

  /** Informations de la mairie de la commune d'implantation */
  mairie: MairieInfo | null;
}

/** Réponse API /api/parcelle */
export interface ParcelleApiResponse {
  data: ParcelleInfo;
  timestamp: string;
}

/** Labels lisibles pour les types de zone */
export const ZONE_TYPE_LABELS: Record<string, string> = {
  U: "🏘️ Urbaine",
  AU: "🏗️ À Urbaniser",
  AUc: "🏗️ À Urbaniser (contrainte)",
  AUs: "🏗️ À Urbaniser (strict)",
  A: "🌾 Agricole",
  N: "🌳 Naturelle",
  Nh: "🏡 Naturelle (habitat)",
};

/**
 * Retourne un label lisible pour un type de zone PLU
 */
export function getZoneLabel(typezone: string): string {
  return ZONE_TYPE_LABELS[typezone] ?? typezone;
}
