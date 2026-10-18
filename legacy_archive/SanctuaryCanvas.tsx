'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useFocusStore } from '@/store/useFocusStore';
import { FableVillageScene } from './FableVillageScene';
import { voiceoverEngine } from '@/core/audio/voiceoverEngine';

function CinematicCameraController({
  controlsRef,
  hasEnteredWorld,
  reducedMotion
}: {
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
  hasEnteredWorld: boolean;
  reducedMotion: boolean;
}) {
  const desiredCamPos = useRef(new THREE.Vector3(0, 1.9, 18.2));
  const desiredTarget = useRef(new THREE.Vector3(0, 1.7, 8.0));
  const hasTransitioned = useRef(false);

  useEffect(() => {
    if (!hasEnteredWorld) {
      hasTransitioned.current = false;
      desiredCamPos.current.set(0, 1.9, 18.2);
      desiredTarget.current.set(0, 1.7, 6.0);
    } else {
      // Exact Elevated Isometric Diorama View matching Image 1 & Image 3
      desiredCamPos.current.set(0, 13.2, 16.2);
      desiredTarget.current.set(0, 0.85, 0.5);
    }
  }, [hasEnteredWorld]);

  useFrame(({ camera }, delta) => {
    const controls = controlsRef.current;
    if (!controls) return;

    if (!hasEnteredWorld || !hasTransitioned.current) {
      const speed = reducedMotion ? 1 : Math.min(1, delta * 2.2);
      camera.position.lerp(desiredCamPos.current, speed);
      controls.target.lerp(desiredTarget.current, speed);
      controls.update();

      if (
        hasEnteredWorld &&
        camera.position.distanceTo(desiredCamPos.current) < 0.6
      ) {
        hasTransitioned.current = true;
      }
    }
  });

  return null;
}

export default function SanctuaryCanvas() {
  const {
    hasEnteredWorld,
    landmarks,
    tasks,
    availableMinutes,
    planDiff,
    selectedLandmarkId,
    reducedMotion,
    selectLandmark,
    completeTask
  } = useFocusStore();

  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const [transformationPulse, setTransformationPulse] = useState(1);

  // Trigger a Hogwarts telekinetic building reconfiguration whenever tasks, time window, or replan changes
  useEffect(() => {
    setTransformationPulse((prev) => prev + 1);
  }, [tasks, availableMinutes, planDiff.length]);

  // Listen for custom HUD button trigger to replay the Hogwarts transformation wave on demand
  useEffect(() => {
    const handler = () => setTransformationPulse((prev) => prev + 1);
    window.addEventListener('focus:trigger-hogwarts-transform', handler);
    return () =>
      window.removeEventListener('focus:trigger-hogwarts-transform', handler);
  }, []);

  const handleCompleteWithVoice = (taskId: string, title: string) => {
    voiceoverEngine.unlockOnUserGesture();
    completeTask(taskId);
    setTransformationPulse((prev) => prev + 1);
    void voiceoverEngine.speak({
      speakerId: 'ELENA_VILLAGER',
      speakerName: 'Elena',
      speakerRole: 'Village Steward',
      text: `Wonderful work! You finished "${title}"! Watch the magic—the timbers have assembled into a permanent monument and our village is thriving!`
    });
  };

  return (
    <div
      onMouseDown={() => voiceoverEngine.unlockOnUserGesture()}
      className="relative h-screen w-screen overflow-hidden select-none"
      style={{
        background:
          'linear-gradient(180deg, #7BB8DC 0%, #B8DFEE 38%, #F5E1BE 100%)'
      }}
    >
      {/* Subtle Golden-Hour Vignette & Warm Sunbeam Lens Glow matching Image 3 */}
      <div
        className="pointer-events-none absolute inset-0 z-10"
        style={{
          background:
            'radial-gradient(circle at 18% 12%, rgba(255, 232, 165, 0.34) 0%, transparent 48%, rgba(18, 12, 8, 0.32) 100%)'
        }}
      />

      <Canvas
        shadows
        camera={{ position: [0, 1.9, 18.2], fov: 35, near: 0.5, far: 160 }}
        gl={{
          antialias: true,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.24
        }}
      >
        <fog attach="fog" args={['#CFE6F0', 22, 54]} />

        <hemisphereLight
          args={['#FFF8E7', '#5E8738', 1.18]}
          position={[0, 40, 0]}
        />

        <directionalLight
          castShadow
          position={[18, 24, 14]}
          color="#FFE4AD"
          intensity={2.45}
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-near={1}
          shadow-camera-far={75}
          shadow-camera-left={-22}
          shadow-camera-right={22}
          shadow-camera-top={22}
          shadow-camera-bottom={-22}
          shadow-bias={-0.0004}
        />

        <directionalLight
          position={[-16, 12, -12]}
          color="#90C2E7"
          intensity={0.82}
        />

        <FableVillageScene
          landmarks={landmarks}
          selectedLandmarkId={selectedLandmarkId}
          isGateClosed={!hasEnteredWorld}
          isGateOpening={hasEnteredWorld}
          transformationPulse={transformationPulse}
          reducedMotion={reducedMotion}
          onSelectLandmark={selectLandmark}
          onCompleteTask={handleCompleteWithVoice}
        />

        <OrbitControls
          ref={controlsRef}
          makeDefault
          enabled={hasEnteredWorld}
          enableDamping={!reducedMotion}
          dampingFactor={0.06}
          minDistance={9}
          maxDistance={28}
          minPolarAngle={Math.PI / 6}
          maxPolarAngle={Math.PI / 2.35}
        />

        <CinematicCameraController
          controlsRef={controlsRef}
          hasEnteredWorld={hasEnteredWorld}
          reducedMotion={reducedMotion}
        />
      </Canvas>
    </div>
  );
}
