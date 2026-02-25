/**
 * Fonctions pour dessiner les couches réseau Enedis sur la carte Leaflet.
 * Gère les postes (markers), lignes BT et HTA (polylines) avec les bons styles.
 *
 * Couleurs:
 * - Postes / transfos: rouge
 * - Lignes BT aérien: vert plein
 * - Lignes BT enterré: vert pointillé
 * - Lignes HTA aérien: bleu plein
 * - Lignes HTA enterré: bleu pointillé
 */

import L from "leaflet";
import type { EnedisPoste, EnedisLigne, EnedisLayerVisibility } from "@/lib/types/enedis";
import { ENEDIS_COLORS } from "@/lib/types/enedis";
import { formatDistance } from "@/lib/geometry/enedis-utils";

// ============================================================================
// LAYER GROUPS
// ============================================================================

export interface EnedisLayerGroups {
  postes: L.LayerGroup;
  lignesBt: L.LayerGroup;
  lignesHta: L.LayerGroup;
}

/**
 * Crée les groupes de couches Enedis.
 */
export function createEnedisLayerGroups(): EnedisLayerGroups {
  return {
    postes: L.layerGroup(),
    lignesBt: L.layerGroup(),
    lignesHta: L.layerGroup(),
  };
}

// ============================================================================
// POSTES (CIRCLE MARKERS)
// ============================================================================

/**
 * Dessine les postes sur la couche.
 * Clic -> popup avec type + distance au bâtiment.
 * bubblingMouseEvents permet au drag de fonctionner à travers les markers.
 */
export function drawPostes(
  layerGroup: L.LayerGroup,
  postes: EnedisPoste[]
): void {
  layerGroup.clearLayers();

  for (const poste of postes) {
    if (!poste.coordinates || poste.coordinates[0] === 0) continue;

    const marker = L.circleMarker(
      [poste.coordinates[1], poste.coordinates[0]], // [lat, lon]
      {
        radius: 8,
        color: "#fff",
        weight: 3,
        fillColor: ENEDIS_COLORS.poste,
        fillOpacity: 1,
        bubblingMouseEvents: true, // laisse passer le drag à la carte
      }
    );

    const distStr = poste.distanceM != null ? formatDistance(poste.distanceM) : "N/A";

    marker.bindPopup(
      `<div style="min-width: 180px">
        <div style="font-weight: bold; color: ${ENEDIS_COLORS.poste}; margin-bottom: 4px">
          ⚡ ${escapeHtml(poste.name)}
        </div>
        <div style="font-size: 12px; color: #666; margin-bottom: 6px">
          ${escapeHtml(poste.subtype)}
        </div>
        <div style="font-size: 13px; font-weight: 600; color: #333">
          📏 Distance: ${distStr}
        </div>
        <div style="font-size: 11px; color: #999; margin-top: 4px">
          ${poste.coordinates[1].toFixed(6)}, ${poste.coordinates[0].toFixed(6)}
        </div>
      </div>`
    );

    marker.addTo(layerGroup);
  }
}

// ============================================================================
// LIGNES (POLYLINES)
// ============================================================================

/**
 * Dessine une polyline avec un contour blanc pour la lisibilité sur fond satellite.
 * On ajoute d'abord un trait blanc épais dessous, puis le trait coloré dessus.
 */
function addOutlinedPolyline(
  layerGroup: L.LayerGroup,
  latLngs: [number, number][],
  color: string,
  dashArray: string | undefined
): void {
  // Contour blanc (plus épais, en dessous)
  L.polyline(latLngs, {
    color: "#ffffff",
    weight: 7,
    opacity: 0.6,
    interactive: false,
    dashArray,
  }).addTo(layerGroup);

  // Trait coloré principal
  L.polyline(latLngs, {
    color,
    weight: 4,
    opacity: 1,
    interactive: false,
    dashArray,
  }).addTo(layerGroup);
}

/**
 * Dessine les lignes BT sur la couche.
 */
export function drawLignesBt(
  layerGroup: L.LayerGroup,
  lignes: EnedisLigne[]
): void {
  layerGroup.clearLayers();

  for (const ligne of lignes) {
    if (!ligne.coordinates || ligne.coordinates.length < 2) continue;

    const latLngs: [number, number][] = ligne.coordinates.map(
      (c) => [c[1], c[0]] as [number, number] // [lat, lon]
    );

    const isEnterre = ligne.installation === "enterre";

    addOutlinedPolyline(
      layerGroup,
      latLngs,
      ENEDIS_COLORS.btAerien,
      isEnterre ? "10, 8" : undefined
    );
  }
}

/**
 * Dessine les lignes HTA sur la couche.
 * Pour les lignes aériennes, ajoute aussi des marqueurs "poteau MT" à chaque vertex.
 */
export function drawLignesHta(
  layerGroup: L.LayerGroup,
  lignes: EnedisLigne[]
): void {
  layerGroup.clearLayers();

  for (const ligne of lignes) {
    if (!ligne.coordinates || ligne.coordinates.length < 2) continue;

    const latLngs: [number, number][] = ligne.coordinates.map(
      (c) => [c[1], c[0]] as [number, number] // [lat, lon]
    );

    const isEnterre = ligne.installation === "enterre";

    addOutlinedPolyline(
      layerGroup,
      latLngs,
      ENEDIS_COLORS.htaAerien,
      isEnterre ? "10, 8" : undefined
    );

    // Poteaux MT : chaque vertex d'une ligne HTA aérienne = un poteau
    if (!isEnterre) {
      for (const pt of latLngs) {
        L.circleMarker(pt, {
          radius: 6,
          color: "#333333",
          weight: 2,
          fillColor: "#ffffff",
          fillOpacity: 1,
          bubblingMouseEvents: true,
        }).bindTooltip("Poteau MT", {
          direction: "top",
          offset: [0, -8],
        }).addTo(layerGroup);
      }
    }
  }
}

// ============================================================================
// VISIBILITÉ
// ============================================================================

/**
 * Met à jour la visibilité des couches Enedis sur la carte.
 */
export function updateEnedisVisibility(
  map: L.Map,
  groups: EnedisLayerGroups,
  visibility: EnedisLayerVisibility
): void {
  const setVis = (group: L.LayerGroup, visible: boolean) => {
    if (visible && !map.hasLayer(group)) {
      group.addTo(map);
    } else if (!visible && map.hasLayer(group)) {
      map.removeLayer(group);
    }
  };

  setVis(groups.postes, visibility.postes);
  setVis(groups.lignesBt, visibility.lignesBt);
  setVis(groups.lignesHta, visibility.lignesHta);
}

// ============================================================================
// DRAW ALL
// ============================================================================

/**
 * Dessine toutes les couches Enedis et applique la visibilité.
 */
export function drawAllEnedisLayers(
  map: L.Map,
  groups: EnedisLayerGroups,
  postes: EnedisPoste[],
  lignesBt: EnedisLigne[],
  lignesHta: EnedisLigne[],
  visibility: EnedisLayerVisibility
): void {
  drawPostes(groups.postes, postes);
  drawLignesBt(groups.lignesBt, lignesBt);
  drawLignesHta(groups.lignesHta, lignesHta);
  updateEnedisVisibility(map, groups, visibility);
}

// ============================================================================
// HELPERS
// ============================================================================

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
