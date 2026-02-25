"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Suspense, useState } from "react";
import type { BuildingConfig } from "@/lib/types/building";
import { BuildingMesh } from "./building-mesh";
import { DimensionLabels } from "./dimension-labels";

interface Building3DViewProps {
  config: BuildingConfig;
}

export function Building3DView({ config }: Building3DViewProps) {
  const [showDimensions, setShowDimensions] = useState(true);

  return (
    <div className="relative h-full w-full">
      {/* Toggle cotes */}
      <div className="absolute right-4 top-4 z-10">
        <button
          onClick={() => setShowDimensions(!showDimensions)}
          className="rounded bg-white px-3 py-2 text-sm shadow-md hover:bg-gray-50"
        >
          {showDimensions ? "Masquer les cotes" : "Afficher les cotes"}
        </button>
      </div>

      {/* Canvas 3D */}
      <Canvas
        camera={{
          position: [config.params.width * 1.8, config.params.heightFaitage * 1.5, config.derived.length * 1.2],
          fov: 45,
        }}
        className="bg-gradient-to-b from-blue-50 to-gray-100"
        shadows
      >
        {/* Lumières */}
        <ambientLight intensity={0.5} />
        <directionalLight 
          position={[20, 30, 20]} 
          intensity={1.5} 
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-far={100}
          shadow-camera-left={-50}
          shadow-camera-right={50}
          shadow-camera-top={50}
          shadow-camera-bottom={-50}
        />
        <directionalLight position={[-10, 15, -10]} intensity={0.4} />
        <hemisphereLight intensity={0.3} groundColor="#888888" />

        {/* Sol blanc uni */}
        <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
          <planeGeometry args={[200, 200]} />
          <meshStandardMaterial color="#f5f5f5" />
        </mesh>
        
        {/* Plan pour ombres */}
        <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.005, 0]}>
          <planeGeometry args={[200, 200]} />
          <shadowMaterial opacity={0.25} />
        </mesh>

        {/* Bâtiment */}
        <Suspense fallback={null}>
          <BuildingMesh config={config} />
        </Suspense>

        {/* Cotes dimensionnelles */}
        {showDimensions && (
          <Suspense fallback={null}>
            <DimensionLabels config={config} />
          </Suspense>
        )}

        {/* Contrôles caméra */}
        <OrbitControls
          makeDefault
          minDistance={5}
          maxDistance={200}
          enablePan={true}
          enableDamping
          dampingFactor={0.05}
        />
      </Canvas>
    </div>
  );
}
