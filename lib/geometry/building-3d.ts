/**
 * Helpers pour génération géométrie 3D du bâtiment
 * PROMPT 8: Rendu 3D avec React Three Fiber
 */

import type { BuildingConfig } from "@/lib/types/building";
import * as THREE from "three";

export interface Column3D {
  position: [number, number, number]; // x, y, z
  height: number;
}

export interface Beam3D {
  start: [number, number, number];
  end: [number, number, number];
  thickness?: number;
}

export interface CrossBrace3D {
  // Croix de Saint-André : 2 diagonales
  diagonal1Start: [number, number, number];
  diagonal1End: [number, number, number];
  diagonal2Start: [number, number, number];
  diagonal2End: [number, number, number];
}

export interface RoofPlane3D {
  vertices: THREE.Vector3[];
  color: string;
  isPV: boolean; // zone PV ou non
}

export interface Panel3D {
  position: [number, number, number];
  rotation: [number, number, number];
  width: number;
  height: number;
}

/**
 * Génère les positions des poteaux (colonnes)
 * Disposition: poteaux aux angles + poteaux intermédiaires selon nb_travees
 */
export function generateColumns(config: BuildingConfig): Column3D[] {
  const columns: Column3D[] = [];
  const { width, nbSpans, heightSabliereLeft, heightSabliereRight } = config.params;
  const { length, poteauPosition, hasIntermediatePoles } = config.derived;
  
  // Espacement entre travées
  const traveeSpacing = length / nbSpans;
  
  // Poteaux sur le côté gauche (x = 0) - utilisent heightSabliereLeft
  for (let i = 0; i <= nbSpans; i++) {
    columns.push({
      position: [0, heightSabliereLeft / 2, i * traveeSpacing - length / 2],
      height: heightSabliereLeft,
    });
  }
  
  // Poteaux sur le côté droit (x = width) - utilisent heightSabliereRight
  for (let i = 0; i <= nbSpans; i++) {
    columns.push({
      position: [width, heightSabliereRight / 2, i * traveeSpacing - length / 2],
      height: heightSabliereRight,
    });
  }
  
  // Pour ASYM2 ou si poteaux intermédiaires, ajouter poteaux centraux
  if (hasIntermediatePoles && poteauPosition) {
    // Calculer la hauteur du toit à la position du poteau
    // Pour les toits asymétriques, interpoler entre les sablières et le faîtage
    const { type, heightSabliereLeft, heightSabliereRight, heightFaitage } = config.params;
    const { faitagePosition } = config.derived;
    
    let poleHeight: number;
    
    if (type === "ASYM2" || type === "ASYM1") {
      // Pour ASYM: le poteau est sous la pente
      // Si le poteau est avant le faîtage (côté gauche)
      if (faitagePosition && poteauPosition <= faitagePosition) {
        // Interpoler entre sablière gauche et faîtage
        const ratio = poteauPosition / faitagePosition;
        poleHeight = heightSabliereLeft + ratio * (heightFaitage - heightSabliereLeft);
      } else if (faitagePosition) {
        // Interpoler entre faîtage et sablière droite
        const ratio = (poteauPosition - faitagePosition) / (width - faitagePosition);
        poleHeight = heightFaitage - ratio * (heightFaitage - heightSabliereRight);
      } else {
        poleHeight = heightFaitage;
      }
    } else if (type === "PL") {
      // PL: toit plat incliné, interpoler simplement
      const ratio = poteauPosition / width;
      poleHeight = heightSabliereLeft - ratio * (heightSabliereLeft - heightSabliereRight);
    } else {
      // Autres types: utiliser le faîtage
      poleHeight = heightFaitage;
    }
    
    for (let i = 0; i <= nbSpans; i++) {
      columns.push({
        position: [poteauPosition, poleHeight / 2, i * traveeSpacing - length / 2],
        height: poleHeight,
      });
    }
  }
  
  return columns;
}

/**
 * Génère les plans de toiture (avec indication si zone PV)
 */
export function generateRoofPlanes(config: BuildingConfig): RoofPlane3D[] {
  const planes: RoofPlane3D[] = [];
  const { type, width, heightSabliereLeft, heightSabliereRight, heightFaitage } = config.params;
  const { length, faitagePosition, zonePvA, zonePvB } = config.derived;
  
  const halfLength = length / 2;
  
  // Vecteurs de base pour les 4 coins à la base
  const frontLeft = new THREE.Vector3(0, heightSabliereLeft, -halfLength);
  const backLeft = new THREE.Vector3(0, heightSabliereLeft, halfLength);
  const frontRight = new THREE.Vector3(width, heightSabliereRight, -halfLength);
  const backRight = new THREE.Vector3(width, heightSabliereRight, halfLength);
  
  switch (type) {
    case "SYM": {
      // Toit symétrique: 2 pans égaux
      const faitageX = width / 2;
      const frontRidge = new THREE.Vector3(faitageX, heightFaitage, -halfLength);
      const backRidge = new THREE.Vector3(faitageX, heightFaitage, halfLength);
      
      // Pan A (droit/sud)
      planes.push({
        vertices: [frontRight, frontRidge, backRidge, backRight],
        color: zonePvA ? "#3b82f6" : "#6b7280",
        isPV: zonePvA,
      });
      
      // Pan B (gauche/nord)
      planes.push({
        vertices: [frontLeft, backLeft, backRidge, frontRidge],
        color: zonePvB ? "#3b82f6" : "#6b7280",
        isPV: zonePvB,
      });
      break;
    }
    
    case "ASYM1": {
      // Asymétrique 1 zone: faîtage décalé, pas de poteau central
      const faitageX = faitagePosition ?? width * 0.4;
      const frontRidge = new THREE.Vector3(faitageX, heightFaitage, -halfLength);
      const backRidge = new THREE.Vector3(faitageX, heightFaitage, halfLength);
      
      // Pan A (droit/sud)
      planes.push({
        vertices: [frontRight, frontRidge, backRidge, backRight],
        color: zonePvA ? "#3b82f6" : "#6b7280",
        isPV: zonePvA,
      });
      
      // Pan B (gauche/nord)
      planes.push({
        vertices: [frontLeft, backLeft, backRidge, frontRidge],
        color: zonePvB ? "#3b82f6" : "#6b7280",
        isPV: zonePvB,
      });
      break;
    }
    
    case "ASYM2": {
      // Asymétrique 2 zones: faîtage décalé AVEC poteau central
      const faitageX = faitagePosition ?? width * 0.4;
      const frontRidge = new THREE.Vector3(faitageX, heightFaitage, -halfLength);
      const backRidge = new THREE.Vector3(faitageX, heightFaitage, halfLength);
      
      // Pan A (droit/sud)
      planes.push({
        vertices: [frontRight, frontRidge, backRidge, backRight],
        color: zonePvA ? "#3b82f6" : "#6b7280",
        isPV: zonePvA,
      });
      
      // Pan B (gauche/nord)
      planes.push({
        vertices: [frontLeft, backLeft, backRidge, frontRidge],
        color: zonePvB ? "#3b82f6" : "#6b7280",
        isPV: zonePvB,
      });
      break;
    }
    
    case "MONO": {
      // Monopente: 1 seul pan incliné
      planes.push({
        vertices: [frontLeft, backLeft, backRight, frontRight],
        color: zonePvA ? "#3b82f6" : "#6b7280",
        isPV: zonePvA,
      });
      break;
    }
    
    case "VL_LEFT":
    case "VL_RIGHT":
    case "VL_DOUBLE": {
      // Vélums: toit plat ou légèrement incliné
      const avgHeight = (heightSabliereLeft + heightSabliereRight) / 2;
      planes.push({
        vertices: [
          new THREE.Vector3(0, avgHeight, -halfLength),
          new THREE.Vector3(0, avgHeight, halfLength),
          new THREE.Vector3(width, avgHeight, halfLength),
          new THREE.Vector3(width, avgHeight, -halfLength),
        ],
        color: zonePvA ? "#3b82f6" : "#6b7280",
        isPV: zonePvA,
      });
      break;
    }
    
    case "PL": {
      // Toit plat
      planes.push({
        vertices: [frontLeft, backLeft, backRight, frontRight],
        color: zonePvA ? "#3b82f6" : "#6b7280",
        isPV: zonePvA,
      });
      break;
    }
  }
  
  return planes;
}

/**
 * Génère les panneaux solaires en grille sur les zones PV
 * Simplifié: on place juste des rectangles représentatifs
 */
export function generatePanels(config: BuildingConfig): Panel3D[] {
  const panels: Panel3D[] = [];
  
  // Récupérer les données de panneaux depuis derived
  const { nbPanelsPanA, nbPanelsPanB } = config.derived;
  const { width, heightSabliereRight, heightSabliereLeft } = config.params;
  const { length } = config.derived;
  
  // Pour l'instant, on génère une grille simple si des panneaux sont présents
  if (nbPanelsPanA > 0) {
    // Estimation: 3-4 panneaux par rangée
    const panelsPerRow = Math.ceil(Math.sqrt(nbPanelsPanA));
    const rows = Math.ceil(nbPanelsPanA / panelsPerRow);
    
    const panelWidth = 1.1;
    const panelHeight = 1.8;
    const gap = 0.015;
    
    // Position approximative sur le pan droit
    const startX = width * 0.6;
    const startY = heightSabliereRight + 0.5;
    const startZ = -length / 4;
    
    for (let row = 0; row < rows; row++) {
      const panelsInRow = Math.min(panelsPerRow, nbPanelsPanA - row * panelsPerRow);
      for (let col = 0; col < panelsInRow; col++) {
        panels.push({
          position: [
            startX + col * (panelWidth + gap),
            startY,
            startZ + row * (panelHeight + gap),
          ],
          rotation: [-0.3, 0, 0], // Légère inclinaison pour suivre le toit
          width: panelWidth,
          height: panelHeight,
        });
      }
    }
  }
  
  return panels;
}

/**
 * Calcule les dimensions pour affichage des cotes
 */
export function getBuildingDimensions(config: BuildingConfig) {
  return {
    largeur: config.params.width,
    longueur: config.derived.length,
    hauteur_rive: config.params.heightSabliereLeft,
    hauteur_faitage: config.params.heightFaitage,
  };
}

/**
 * Génère les pannes horizontales transversales (perpendiculaires à la longueur)
 * Comme sur NELSON: uniquement les poutres transversales à chaque travée
 * PAS de barres longitudinales sur toute la longueur
 */
export function generateHorizontalBeams(config: BuildingConfig): Beam3D[] {
  // Sur NELSON, il n'y a pas de pannes horizontales visibles le long des façades
  // Les seules structures horizontales sont les fermes transversales (dans generateRoofStructure)
  return [];
}

/**
 * Génère les croix de Saint-André sur les CÔTÉS LATÉRAUX (long pans)
 * Positionnées entre la 1ère et 2ème travée, comme sur NELSON
 */
export function generateCrossBraces(config: BuildingConfig): CrossBrace3D[] {
  const braces: CrossBrace3D[] = [];
  const { width, nbSpans, heightSabliereLeft, heightSabliereRight } = config.params;
  const { length } = config.derived;
  
  const halfLength = length / 2;
  const traveeSpacing = length / nbSpans;
  
  // Position Z de la première travée (entre travée 0 et 1)
  const z1 = -halfLength;
  const z2 = -halfLength + traveeSpacing;
  
  const crossBottom = 0.3;
  const crossMargin = 0.2; // Marge par rapport aux poteaux
  
  // === CÔTÉ GAUCHE (x = 0) - Croix entre 1ère et 2ème travée ===
  const crossTopLeft = heightSabliereLeft - 0.3;
  braces.push({
    diagonal1Start: [crossMargin, crossBottom, z1 + crossMargin],
    diagonal1End: [crossMargin, crossTopLeft, z2 - crossMargin],
    diagonal2Start: [crossMargin, crossTopLeft, z1 + crossMargin],
    diagonal2End: [crossMargin, crossBottom, z2 - crossMargin],
  });
  
  // === CÔTÉ DROIT (x = width) - Croix entre 1ère et 2ème travée ===
  const crossTopRight = heightSabliereRight - 0.3;
  braces.push({
    diagonal1Start: [width - crossMargin, crossBottom, z1 + crossMargin],
    diagonal1End: [width - crossMargin, crossTopRight, z2 - crossMargin],
    diagonal2Start: [width - crossMargin, crossTopRight, z1 + crossMargin],
    diagonal2End: [width - crossMargin, crossBottom, z2 - crossMargin],
  });
  
  return braces;
}

/**
 * Génère les fermes/treillis sous la toiture (structure visible)
 * Pannes transversales à chaque travée
 */
export function generateRoofStructure(config: BuildingConfig): Beam3D[] {
  const beams: Beam3D[] = [];
  const { width, nbSpans, heightSabliereLeft, heightSabliereRight, heightFaitage, type } = config.params;
  const { length, faitagePosition } = config.derived;
  
  const traveeSpacing = length / nbSpans;
  const halfLength = length / 2;
  const faitageX = faitagePosition ?? width / 2;
  
  // Pour chaque travée, générer les pannes transversales
  for (let i = 0; i <= nbSpans; i++) {
    const z = i * traveeSpacing - halfLength;
    
    if (type === "SYM" || type === "ASYM1" || type === "ASYM2") {
      // Ferme triangulaire: sablière gauche -> faîtage -> sablière droite
      
      // Arbalétrier gauche (sablière gauche vers faîtage)
      beams.push({
        start: [0, heightSabliereLeft, z],
        end: [faitageX, heightFaitage, z],
        thickness: 0.12,
      });
      
      // Arbalétrier droit (faîtage vers sablière droite)
      beams.push({
        start: [faitageX, heightFaitage, z],
        end: [width, heightSabliereRight, z],
        thickness: 0.12,
      });
      
      // Pas d'entrait horizontal - non présent sur NELSON
    } else if (type === "MONO" || type === "PL") {
      // Monopente: une seule panne inclinée
      beams.push({
        start: [0, heightSabliereLeft, z],
        end: [width, heightSabliereRight, z],
        thickness: 0.12,
      });
    }
  }
  
  // Pannes de toiture longitudinales (parallèles au faîtage, sur les rampants)
  const nbPannesPerPan = 3; // Nombre de pannes intermédiaires par pan
  
  if (type === "SYM" || type === "ASYM1" || type === "ASYM2") {
    // Pan gauche
    for (let p = 1; p < nbPannesPerPan; p++) {
      const ratio = p / nbPannesPerPan;
      const x = faitageX * (1 - ratio);
      const y = heightFaitage - ratio * (heightFaitage - heightSabliereLeft);
      
      beams.push({
        start: [x, y, -halfLength],
        end: [x, y, halfLength],
        thickness: 0.08,
      });
    }
    
    // Pan droit
    for (let p = 1; p < nbPannesPerPan; p++) {
      const ratio = p / nbPannesPerPan;
      const x = faitageX + (width - faitageX) * ratio;
      const y = heightFaitage - ratio * (heightFaitage - heightSabliereRight);
      
      beams.push({
        start: [x, y, -halfLength],
        end: [x, y, halfLength],
        thickness: 0.08,
      });
    }
  }
  
  return beams;
}
