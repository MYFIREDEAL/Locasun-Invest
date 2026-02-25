/**
 * Zones vent Eurocode EN 1991-1-4 (NF EN 1991-1-4/NA)
 * Valeur de base Vb0 à 10 m – terrain catégorie II – période de retour 50 ans
 *
 * Zone 1 → 22 m/s (~79 km/h)
 * Zone 2 → 24 m/s (~86 km/h)
 * Zone 3 → 26 m/s (~94 km/h)
 * Zone 4 → 28 m/s (~101 km/h)
 */

export type ZoneVent = 1 | 2 | 3 | 4;

export interface ZoneVentInfo {
  zone: ZoneVent;
  vb0Ms: number;   // Vitesse de base en m/s
  vb0Kmh: number;  // Vitesse de base en km/h
  label: string;   // Label lisible
}

/** Correspondance zone → vitesse de base */
const ZONE_VENT_DATA: Record<ZoneVent, Omit<ZoneVentInfo, "zone">> = {
  1: { vb0Ms: 22, vb0Kmh: 79, label: "Zone 1 — 22 m/s (79 km/h)" },
  2: { vb0Ms: 24, vb0Kmh: 86, label: "Zone 2 — 24 m/s (86 km/h)" },
  3: { vb0Ms: 26, vb0Kmh: 94, label: "Zone 3 — 26 m/s (94 km/h)" },
  4: { vb0Ms: 28, vb0Kmh: 101, label: "Zone 4 — 28 m/s (101 km/h)" },
};

/**
 * Correspondance département (code 2 chiffres) → zone vent Eurocode
 * Source : Annexe Nationale NF EN 1991-1-4/NA (carte des zones de vent France)
 */
const DEPT_TO_ZONE: Record<string, ZoneVent> = {
  // Zone 1 — Intérieur, zones abritées
  "01": 1, // Ain
  "03": 1, // Allier
  "05": 1, // Hautes-Alpes
  "07": 1, // Ardèche
  "12": 1, // Aveyron
  "15": 1, // Cantal
  "19": 1, // Corrèze
  "21": 1, // Côte-d'Or
  "23": 1, // Creuse
  "24": 1, // Dordogne
  "25": 1, // Doubs
  "26": 1, // Drôme
  "38": 1, // Isère
  "39": 1, // Jura
  "42": 1, // Loire
  "43": 1, // Haute-Loire
  "46": 1, // Lot
  "48": 1, // Lozère
  "52": 1, // Haute-Marne
  "54": 1, // Meurthe-et-Moselle
  "55": 1, // Meuse
  "57": 1, // Moselle
  "58": 1, // Nièvre
  "63": 1, // Puy-de-Dôme
  "67": 1, // Bas-Rhin
  "68": 1, // Haut-Rhin
  "69": 1, // Rhône
  "70": 1, // Haute-Saône
  "71": 1, // Saône-et-Loire
  "73": 1, // Savoie
  "74": 1, // Haute-Savoie
  "87": 1, // Haute-Vienne
  "88": 1, // Vosges
  "90": 1, // Territoire de Belfort

  // Zone 2 — Centre, transition
  "02": 2, // Aisne
  "04": 2, // Alpes-de-Haute-Provence
  "06": 2, // Alpes-Maritimes
  "08": 2, // Ardennes
  "09": 2, // Ariège
  "10": 2, // Aube
  "16": 2, // Charente
  "18": 2, // Cher
  "27": 2, // Eure
  "28": 2, // Eure-et-Loir
  "31": 2, // Haute-Garonne
  "32": 2, // Gers
  "33": 2, // Gironde
  "36": 2, // Indre
  "37": 2, // Indre-et-Loire
  "40": 2, // Landes
  "41": 2, // Loir-et-Cher
  "45": 2, // Loiret
  "47": 2, // Lot-et-Garonne
  "49": 2, // Maine-et-Loire
  "51": 2, // Marne
  "53": 2, // Mayenne
  "59": 2, // Nord
  "60": 2, // Oise
  "61": 2, // Orne
  "62": 2, // Pas-de-Calais
  "64": 2, // Pyrénées-Atlantiques
  "65": 2, // Hautes-Pyrénées
  "72": 2, // Sarthe
  "75": 2, // Paris
  "77": 2, // Seine-et-Marne
  "78": 2, // Yvelines
  "79": 2, // Deux-Sèvres
  "81": 2, // Tarn
  "82": 2, // Tarn-et-Garonne
  "84": 2, // Vaucluse
  "86": 2, // Vienne
  "89": 2, // Yonne
  "91": 2, // Essonne
  "92": 2, // Hauts-de-Seine
  "93": 2, // Seine-Saint-Denis
  "94": 2, // Val-de-Marne
  "95": 2, // Val-d'Oise

  // Zone 3 — Côtes atlantiques, Méditerranée, couloir rhodanien
  "11": 3, // Aude
  "13": 3, // Bouches-du-Rhône
  "14": 3, // Calvados
  "17": 3, // Charente-Maritime
  "22": 3, // Côtes-d'Armor
  "29": 3, // Finistère
  "30": 3, // Gard
  "34": 3, // Hérault
  "35": 3, // Ille-et-Vilaine
  "44": 3, // Loire-Atlantique
  "50": 3, // Manche
  "56": 3, // Morbihan
  "66": 3, // Pyrénées-Orientales
  "76": 3, // Seine-Maritime
  "80": 3, // Somme
  "83": 3, // Var
  "85": 3, // Vendée

  // Zone 4 — Littoral exposé, couloir du Rhône sud
  "20": 4, // Corse (2A/2B)
  "2A": 4, // Corse-du-Sud
  "2B": 4, // Haute-Corse

  // DOM-TOM (zone 4 par défaut — cyclones)
  "971": 4, // Guadeloupe
  "972": 4, // Martinique
  "973": 3, // Guyane
  "974": 4, // La Réunion
  "976": 4, // Mayotte
};

/**
 * Retourne les infos de zone vent Eurocode à partir du code département.
 * Fallback en zone 2 si le département n'est pas trouvé.
 */
export function getZoneVent(codeDep: string): ZoneVentInfo {
  // Normaliser : "2A", "2B", ou numéro à 2-3 chiffres
  const normalized = codeDep.trim().toUpperCase();
  const zone = DEPT_TO_ZONE[normalized] ?? DEPT_TO_ZONE[codeDep.replace(/^0+/, "")] ?? 2;
  const data = ZONE_VENT_DATA[zone];
  return { zone, ...data };
}

/**
 * Couleur CSS pour la zone vent
 */
export function getZoneVentColor(zone: ZoneVent): string {
  switch (zone) {
    case 1: return "text-green-600";
    case 2: return "text-blue-600";
    case 3: return "text-orange-600";
    case 4: return "text-red-600";
  }
}
