"use client";

import { Line, Html } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";
import type { BuildingConfig } from "@/lib/types/building";

interface DimensionLabelsProps {
  config: BuildingConfig;
}

export function DimensionLabels({ config }: DimensionLabelsProps) {
  const { width } = config.params;
  const { length } = config.derived;
  const heightSabliereLeft = config.params.heightSabliereLeft;
  const heightSabliereRight = config.params.heightSabliereRight;
  const heightFaitage = config.params.heightFaitage;
  
  const offset = 1.5; // Distance des cotes par rapport au bâtiment
  const tickSize = 0.3;
  
  // Pignon arrière (+z) pour que les cotes soient visibles depuis la vue par défaut
  const pignon = length / 2;
  
  // === COTE LARGEUR (au sol, derrière le bâtiment) ===
  const widthLine = useMemo(() => [
    new THREE.Vector3(0, 0, pignon + offset),
    new THREE.Vector3(width, 0, pignon + offset),
  ], [width, pignon]);
  
  const widthTickL = useMemo(() => [
    new THREE.Vector3(0, 0, pignon + offset - tickSize),
    new THREE.Vector3(0, 0, pignon + offset + tickSize),
  ], [pignon]);
  
  const widthTickR = useMemo(() => [
    new THREE.Vector3(width, 0, pignon + offset - tickSize),
    new THREE.Vector3(width, 0, pignon + offset + tickSize),
  ], [width, pignon]);
  
  // === COTE LONGUEUR (au sol, côté droit) ===
  const lengthLine = useMemo(() => [
    new THREE.Vector3(width + offset, 0, -length / 2),
    new THREE.Vector3(width + offset, 0, length / 2),
  ], [width, length]);
  
  const lengthTickFront = useMemo(() => [
    new THREE.Vector3(width + offset - tickSize, 0, -length / 2),
    new THREE.Vector3(width + offset + tickSize, 0, -length / 2),
  ], [width, length]);
  
  const lengthTickBack = useMemo(() => [
    new THREE.Vector3(width + offset - tickSize, 0, length / 2),
    new THREE.Vector3(width + offset + tickSize, 0, length / 2),
  ], [width, length]);
  
  // === COTE SABLIÈRE GAUCHE (verticale, côté gauche pignon arrière) ===
  const sabLeftLine = useMemo(() => [
    new THREE.Vector3(-offset, 0, pignon),
    new THREE.Vector3(-offset, heightSabliereLeft, pignon),
  ], [pignon, heightSabliereLeft]);
  
  const sabLeftTickB = useMemo(() => [
    new THREE.Vector3(-offset - tickSize, 0, pignon),
    new THREE.Vector3(-offset + tickSize, 0, pignon),
  ], [pignon]);
  
  const sabLeftTickT = useMemo(() => [
    new THREE.Vector3(-offset - tickSize, heightSabliereLeft, pignon),
    new THREE.Vector3(-offset + tickSize, heightSabliereLeft, pignon),
  ], [pignon, heightSabliereLeft]);
  
  // === COTE SABLIÈRE DROITE (verticale, côté droit pignon arrière) ===
  const sabRightLine = useMemo(() => [
    new THREE.Vector3(width + offset, 0, pignon),
    new THREE.Vector3(width + offset, heightSabliereRight, pignon),
  ], [width, pignon, heightSabliereRight]);
  
  const sabRightTickB = useMemo(() => [
    new THREE.Vector3(width + offset - tickSize, 0, pignon),
    new THREE.Vector3(width + offset + tickSize, 0, pignon),
  ], [width, pignon]);
  
  const sabRightTickT = useMemo(() => [
    new THREE.Vector3(width + offset - tickSize, heightSabliereRight, pignon),
    new THREE.Vector3(width + offset + tickSize, heightSabliereRight, pignon),
  ], [width, pignon, heightSabliereRight]);
  
  // === COTE FAÎTAGE (verticale, à la position du faîtage depuis config.derived) ===
  // Pour ASYM, faitagePosition est décalé ; pour SYM c'est width/2
  const faitageX = config.derived.faitagePosition;
  const faitageLine = useMemo(() => [
    new THREE.Vector3(faitageX, 0, pignon + offset),
    new THREE.Vector3(faitageX, heightFaitage, pignon + offset),
  ], [faitageX, pignon, heightFaitage]);
  
  const faitageTickB = useMemo(() => [
    new THREE.Vector3(faitageX - tickSize, 0, pignon + offset),
    new THREE.Vector3(faitageX + tickSize, 0, pignon + offset),
  ], [faitageX, pignon]);
  
  const faitageTickT = useMemo(() => [
    new THREE.Vector3(faitageX - tickSize, heightFaitage, pignon + offset),
    new THREE.Vector3(faitageX + tickSize, heightFaitage, pignon + offset),
  ], [faitageX, pignon, heightFaitage]);

  const labelStyle = "text-xs font-medium text-gray-700 whitespace-nowrap bg-white/80 px-1 rounded";
  const verticalStyle = { writingMode: 'vertical-rl' as const, transform: 'rotate(180deg)' };

  return (
    <group>
      {/* === LARGEUR === */}
      <Line points={widthLine} color="#1a1a1a" lineWidth={1.5} />
      <Line points={widthTickL} color="#1a1a1a" lineWidth={1.5} />
      <Line points={widthTickR} color="#1a1a1a" lineWidth={1.5} />
      <Html position={[width / 2, 0, pignon + offset + 1]} center>
        <div className={labelStyle}>
          {width.toFixed(1)} m
        </div>
      </Html>
      
      {/* === LONGUEUR === */}
      <Line points={lengthLine} color="#1a1a1a" lineWidth={1.5} />
      <Line points={lengthTickFront} color="#1a1a1a" lineWidth={1.5} />
      <Line points={lengthTickBack} color="#1a1a1a" lineWidth={1.5} />
      <Html position={[width + offset + 1, 0, 0]} center>
        <div className={labelStyle}>
          {length.toFixed(1)} m
        </div>
      </Html>
      
      {/* === SABLIÈRE GAUCHE === */}
      <Line points={sabLeftLine} color="#1a1a1a" lineWidth={1.5} />
      <Line points={sabLeftTickB} color="#1a1a1a" lineWidth={1.5} />
      <Line points={sabLeftTickT} color="#1a1a1a" lineWidth={1.5} />
      <Html position={[-offset - 1, heightSabliereLeft / 2, pignon]} center>
        <div className={labelStyle} style={verticalStyle}>
          {heightSabliereLeft.toFixed(1)} m
        </div>
      </Html>
      
      {/* === SABLIÈRE DROITE === */}
      <Line points={sabRightLine} color="#1a1a1a" lineWidth={1.5} />
      <Line points={sabRightTickB} color="#1a1a1a" lineWidth={1.5} />
      <Line points={sabRightTickT} color="#1a1a1a" lineWidth={1.5} />
      <Html position={[width + offset + 1, heightSabliereRight / 2, pignon]} center>
        <div className={labelStyle} style={verticalStyle}>
          {heightSabliereRight.toFixed(1)} m
        </div>
      </Html>
      
      {/* === FAÎTAGE (du sol au sommet) === */}
      <Line points={faitageLine} color="#1a1a1a" lineWidth={1.5} />
      <Line points={faitageTickB} color="#1a1a1a" lineWidth={1.5} />
      <Line points={faitageTickT} color="#1a1a1a" lineWidth={1.5} />
      <Html position={[faitageX, heightFaitage / 2, pignon + offset + 1]} center>
        <div className={labelStyle} style={verticalStyle}>
          {heightFaitage.toFixed(1)} m
        </div>
      </Html>
    </group>
  );
}
