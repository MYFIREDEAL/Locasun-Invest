"use client";

import { useMemo } from "react";
import * as THREE from "three";
import type { BuildingConfig } from "@/lib/types/building";
import { DEFAULT_STRUCTURE_COLOR } from "@/lib/types/building";
import {
  generateColumns,
  generateRoofPlanes,
  generatePanels,
  generateHorizontalBeams,
  generateCrossBraces,
  generateRoofStructure,
} from "@/lib/geometry/building-3d";

interface BuildingMeshProps {
  config: BuildingConfig;
}

export function BuildingMesh({ config }: BuildingMeshProps) {
  // Couleur de la structure métallique (poteaux, pannes, croix)
  const structureColor = config.params.structureColor || DEFAULT_STRUCTURE_COLOR;
  
  // Mémoïsation pour éviter recalculs lors de re-renders
  const columns = useMemo(() => generateColumns(config), [config]);
  const roofPlanes = useMemo(() => generateRoofPlanes(config), [config]);
  const panels = useMemo(() => generatePanels(config), [config]);
  const horizontalBeams = useMemo(() => generateHorizontalBeams(config), [config]);
  const crossBraces = useMemo(() => generateCrossBraces(config), [config]);
  const roofStructure = useMemo(() => generateRoofStructure(config), [config]);

  return (
    <group>
      {/* Poteaux (colonnes) */}
      {columns.map((column, i) => (
        <mesh key={`column-${i}`} position={column.position} castShadow receiveShadow>
          <boxGeometry args={[0.4, column.height, 0.4]} />
          <meshStandardMaterial 
            color={structureColor} 
            metalness={0.7} 
            roughness={0.4}
            envMapIntensity={0.5}
          />
        </mesh>
      ))}

      {/* Pannes horizontales (lisses) */}
      {horizontalBeams.map((beam, i) => {
        const start = new THREE.Vector3(...beam.start);
        const end = new THREE.Vector3(...beam.end);
        const direction = new THREE.Vector3().subVectors(end, start);
        const length = direction.length();
        const center = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
        const thickness = beam.thickness || 0.1;
        
        // Calculer rotation pour aligner le cylindre avec la direction
        const axis = new THREE.Vector3(0, 1, 0);
        const quaternion = new THREE.Quaternion();
        quaternion.setFromUnitVectors(axis, direction.clone().normalize());
        
        return (
          <mesh 
            key={`beam-${i}`} 
            position={[center.x, center.y, center.z]}
            quaternion={quaternion}
            castShadow 
            receiveShadow
          >
            <cylinderGeometry args={[thickness / 2, thickness / 2, length, 8]} />
            <meshStandardMaterial 
              color={structureColor} 
              metalness={0.7} 
              roughness={0.4}
            />
          </mesh>
        );
      })}

      {/* Croix de Saint-André (contreventement) */}
      {crossBraces.map((brace, i) => {
        const renderDiagonal = (start: [number, number, number], end: [number, number, number], key: string) => {
          const startVec = new THREE.Vector3(...start);
          const endVec = new THREE.Vector3(...end);
          const direction = new THREE.Vector3().subVectors(endVec, startVec);
          const length = direction.length();
          const center = new THREE.Vector3().addVectors(startVec, endVec).multiplyScalar(0.5);
          
          const axis = new THREE.Vector3(0, 1, 0);
          const quaternion = new THREE.Quaternion();
          quaternion.setFromUnitVectors(axis, direction.clone().normalize());
          
          return (
            <mesh 
              key={key} 
              position={[center.x, center.y, center.z]}
              quaternion={quaternion}
              castShadow 
              receiveShadow
            >
              <cylinderGeometry args={[0.03, 0.03, length, 6]} />
              <meshStandardMaterial 
                color={structureColor} 
                metalness={0.7} 
                roughness={0.4}
              />
            </mesh>
          );
        };
        
        return (
          <group key={`cross-${i}`}>
            {renderDiagonal(brace.diagonal1Start, brace.diagonal1End, `cross-${i}-d1`)}
            {renderDiagonal(brace.diagonal2Start, brace.diagonal2End, `cross-${i}-d2`)}
          </group>
        );
      })}

      {/* Structure du toit (fermes et pannes) */}
      {roofStructure.map((beam, i) => {
        const start = new THREE.Vector3(...beam.start);
        const end = new THREE.Vector3(...beam.end);
        const direction = new THREE.Vector3().subVectors(end, start);
        const length = direction.length();
        const center = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
        const thickness = beam.thickness || 0.1;
        
        const axis = new THREE.Vector3(0, 1, 0);
        const quaternion = new THREE.Quaternion();
        quaternion.setFromUnitVectors(axis, direction.clone().normalize());
        
        return (
          <mesh 
            key={`roof-beam-${i}`} 
            position={[center.x, center.y, center.z]}
            quaternion={quaternion}
            castShadow 
            receiveShadow
          >
            <cylinderGeometry args={[thickness / 2, thickness / 2, length, 8]} />
            <meshStandardMaterial 
              color={structureColor} 
              metalness={0.6} 
              roughness={0.5}
            />
          </mesh>
        );
      })}

      {/* Plans de toiture */}
      {roofPlanes.map((plane, i) => {
        // Créer une géométrie BufferGeometry depuis les vertices
        if (plane.vertices.length < 3) return null;
        
        const geometry = new THREE.BufferGeometry();
        
        // Créer les positions (triangle fan pour quad)
        const positions = new Float32Array([
          plane.vertices[0]!.x, plane.vertices[0]!.y, plane.vertices[0]!.z,
          plane.vertices[1]!.x, plane.vertices[1]!.y, plane.vertices[1]!.z,
          plane.vertices[2]!.x, plane.vertices[2]!.y, plane.vertices[2]!.z,
          plane.vertices[0]!.x, plane.vertices[0]!.y, plane.vertices[0]!.z,
          plane.vertices[2]!.x, plane.vertices[2]!.y, plane.vertices[2]!.z,
          plane.vertices[3]!.x, plane.vertices[3]!.y, plane.vertices[3]!.z,
        ]);
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.computeVertexNormals();

        return (
          <mesh key={`roof-${i}`} receiveShadow castShadow geometry={geometry}>
            <meshStandardMaterial
              color={plane.isPV ? "#2563eb" : "#6b7280"}
              side={THREE.DoubleSide}
              metalness={plane.isPV ? 0.7 : 0.3}
              roughness={plane.isPV ? 0.2 : 0.6}
              envMapIntensity={plane.isPV ? 1 : 0.5}
            />
          </mesh>
        );
      })}

      {/* Panneaux solaires - couvrent TOUTE la surface de chaque pan PV */}
      {roofPlanes.map((plane, planeIdx) => {
        if (!plane.isPV) return null;
        
        // Récupérer les données de panneaux depuis derived
        const nbPanels = planeIdx === 0 ? config.derived.nbPanelsPanA : config.derived.nbPanelsPanB;
        if (nbPanels === 0) return null;
        
        const panelWidth = 1.134; // Largeur panneau en mode landscape
        const panelHeight = 1.722; // Longueur panneau en mode landscape  
        const gap = 0.02; // Espacement entre panneaux
        const margin = 0.15; // Marge depuis les bords
        
        // Vertices du plan (ordre: front-right, front-ridge, back-ridge, back-right pour pan A)
        const v0 = plane.vertices[0]!;
        const v1 = plane.vertices[1]!;
        const v2 = plane.vertices[2]!;
        const v3 = plane.vertices[3]!;
        
        // Pour le pan, calculer les vecteurs selon la direction rampant (du bas vers le faîtage)
        // et la direction longueur (le long du bâtiment)
        const edgeAlong = new THREE.Vector3().subVectors(v3, v0); // Le long du bâtiment (longueur)
        const edgeUp = new THREE.Vector3().subVectors(v1, v0);    // Vers le faîtage (rampant)
        
        const alongLength = edgeAlong.length(); // Longueur du bâtiment
        const upLength = edgeUp.length();       // Rampant (pente)
        
        // Normaliser les vecteurs
        const alongDir = edgeAlong.clone().normalize();
        const upDir = edgeUp.clone().normalize();
        
        // Calculer la normale du plan
        const normal = new THREE.Vector3().crossVectors(alongDir, upDir).normalize();
        
        // Quaternion pour orienter les panneaux
        const upVector = new THREE.Vector3(0, 1, 0);
        const quaternion = new THREE.Quaternion().setFromUnitVectors(upVector, normal);
        
        // Calculer le nombre de panneaux en X (longueur) et Y (rampant)
        const usableAlong = alongLength - 2 * margin;
        const usableUp = upLength - 2 * margin;
        
        const nbCols = Math.floor((usableAlong + gap) / (panelWidth + gap));
        const nbRows = Math.floor((usableUp + gap) / (panelHeight + gap));
        
        // Centrer les panneaux
        const totalWidthPanels = nbCols * panelWidth + (nbCols - 1) * gap;
        const totalHeightPanels = nbRows * panelHeight + (nbRows - 1) * gap;
        const startOffsetX = (alongLength - totalWidthPanels) / 2;
        const startOffsetY = (upLength - totalHeightPanels) / 2;
        
        const panelMeshes = [];
        let panelCount = 0;
        
        for (let row = 0; row < nbRows && panelCount < nbPanels; row++) {
          for (let col = 0; col < nbCols && panelCount < nbPanels; col++) {
            // Position du centre du panneau
            const xOffset = startOffsetX + col * (panelWidth + gap) + panelWidth / 2;
            const yOffset = startOffsetY + row * (panelHeight + gap) + panelHeight / 2;
            
            // Position 3D
            const position = new THREE.Vector3()
              .copy(v0)
              .add(alongDir.clone().multiplyScalar(xOffset))
              .add(upDir.clone().multiplyScalar(yOffset));
            
            // Légèrement au-dessus du toit
            position.add(normal.clone().multiplyScalar(0.04));
            
            panelMeshes.push(
              <mesh
                key={`panel-${planeIdx}-${panelCount}`}
                position={[position.x, position.y, position.z]}
                quaternion={quaternion}
                castShadow
              >
                <boxGeometry args={[panelWidth, 0.04, panelHeight]} />
                <meshStandardMaterial
                  color="#1e293b"
                  metalness={0.85}
                  roughness={0.15}
                />
              </mesh>
            );
            
            panelCount++;
          }
        }
        
        return <group key={`panels-${planeIdx}`}>{panelMeshes}</group>;
      })}
    </group>
  );
}
