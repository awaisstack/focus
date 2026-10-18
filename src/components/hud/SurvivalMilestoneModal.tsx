'use client';

import React, { useEffect, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CheckCircle2, Undo2, X } from 'lucide-react';
import { useFocusStore } from '../../store/useFocusStore';
import { BUILDING_ARCHETYPES, type TaskCategory } from '../../types/focus';
import { voiceoverEngine } from '../../core/audio/voiceoverEngine';

const renderCache = new Map<TaskCategory, string>();

/**
 * Generates an instant high-DPI painted architectural render on a 2D canvas
 * so the image tag has a rich, zero-latency studio render at t=0ms.
 */
function generateArchitecturalStudioFallback(
  category: TaskCategory,
  accentHex: string
): string {
  const canvas = document.createElement('canvas');
  canvas.width = 480;
  canvas.height = 320;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Golden-hour atmospheric sky gradient
  const skyGrad = ctx.createLinearGradient(0, 0, 0, 320);
  skyGrad.addColorStop(0, '#1e293b');
  skyGrad.addColorStop(0.45, '#475569');
  skyGrad.addColorStop(0.8, '#d97706');
  skyGrad.addColorStop(1, '#365314');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, 480, 320);

  // Soft golden sun glow
  const sunGlow = ctx.createRadialGradient(370, 95, 8, 370, 95, 150);
  sunGlow.addColorStop(0, 'rgba(254, 240, 138, 0.85)');
  sunGlow.addColorStop(0.5, 'rgba(245, 158, 11, 0.28)');
  sunGlow.addColorStop(1, 'rgba(245, 158, 11, 0)');
  ctx.fillStyle = sunGlow;
  ctx.fillRect(0, 0, 480, 320);

  // Distant misty pine silhouettes
  ctx.fillStyle = 'rgba(30, 41, 59, 0.55)';
  for (let i = 0; i < 14; i++) {
    const tx = i * 38;
    const th = 55 + ((i * 29) % 40);
    ctx.beginPath();
    ctx.moveTo(tx, 245);
    ctx.lineTo(tx + 18, 245 - th);
    ctx.lineTo(tx + 36, 245);
    ctx.closePath();
    ctx.fill();
  }

  // Lush valley ground & cobblestone foundation
  const groundGrad = ctx.createLinearGradient(0, 230, 0, 320);
  groundGrad.addColorStop(0, '#3f6212');
  groundGrad.addColorStop(1, '#1a2e05');
  ctx.fillStyle = groundGrad;
  ctx.fillRect(0, 235, 480, 85);

  // Stone foundation plinth
  ctx.fillStyle = '#78716c';
  ctx.fillRect(130, 215, 220, 26);
  ctx.strokeStyle = '#44403c';
  ctx.lineWidth = 2;
  ctx.strokeRect(130, 215, 220, 26);

  // Half-timbered medieval walls
  ctx.fillStyle = '#f5ebe0';
  ctx.fillRect(145, 130, 190, 86);
  ctx.strokeStyle = '#5c3a21';
  ctx.lineWidth = 6;
  ctx.strokeRect(145, 130, 190, 86);

  // Timber framing beams
  ctx.beginPath();
  ctx.moveTo(240, 130);
  ctx.lineTo(240, 216);
  ctx.moveTo(145, 172);
  ctx.lineTo(335, 172);
  ctx.stroke();

  // Steep medieval pitched roof
  ctx.fillStyle = accentHex;
  ctx.beginPath();
  ctx.moveTo(122, 134);
  ctx.lineTo(240, 56);
  ctx.lineTo(358, 134);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#3b1f0b';
  ctx.lineWidth = 4;
  ctx.stroke();

  // Category-specific architectural signature
  if (category === 'MILL_GRANARY') {
    // Windmill sails
    ctx.strokeStyle = '#fef3c7';
    ctx.lineWidth = 4;
    for (let a = 0; a < 4; a++) {
      const ang = (a * Math.PI) / 2 + 0.35;
      ctx.beginPath();
      ctx.moveTo(240, 110);
      ctx.lineTo(240 + Math.cos(ang) * 78, 110 + Math.sin(ang) * 78);
      ctx.stroke();
    }
  } else if (category === 'GUILD_WORKSHOP') {
    // Waterwheel on side
    ctx.strokeStyle = '#92400e';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(145, 190, 34, 0, Math.PI * 2);
    ctx.stroke();
  } else if (category === 'SCHOLAR_TOWER') {
    // Tall spire tower
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(285, 70, 52, 145);
    ctx.fillStyle = '#1d4ed8';
    ctx.beginPath();
    ctx.moveTo(278, 72);
    ctx.lineTo(311, 24);
    ctx.lineTo(344, 72);
    ctx.closePath();
    ctx.fill();
  }

  // Warm glowing lantern windows
  ctx.fillStyle = '#fbbf24';
  ctx.shadowColor = '#f59e0b';
  ctx.shadowBlur = 16;
  ctx.fillRect(172, 146, 26, 22);
  ctx.fillRect(282, 146, 26, 22);
  ctx.shadowBlur = 0;

  // Arched oak door
  ctx.fillStyle = '#78350f';
  ctx.fillRect(224, 178, 32, 38);

  return canvas.toDataURL('image/png');
}

/**
 * Renders the actual 3D GLTF building model offscreen with golden-hour studio lighting
 * so the completion toast displays an authentic 3D render of the completed structure.
 */
async function renderGltfBuildingSnapshot(
  category: TaskCategory,
  gltfUrl: string,
  accentHex: string
): Promise<string> {
  const cached = renderCache.get(category);
  if (cached) return cached;

  const fallback = generateArchitecturalStudioFallback(category, accentHex);
  const isHeadless =
    typeof navigator !== 'undefined' &&
    (navigator.webdriver || /HeadlessChrome/i.test(navigator.userAgent));
  if (isHeadless) {
    renderCache.set(category, fallback);
    return fallback;
  }

  return new Promise<string>((resolve) => {
    const loader = new GLTFLoader();
    loader.load(
      gltfUrl,
      (gltf) => {
        try {
          const offCanvas = document.createElement('canvas');
          offCanvas.width = 480;
          offCanvas.height = 320;
          const renderer = new THREE.WebGLRenderer({
            canvas: offCanvas,
            antialias: true,
            alpha: false,
            preserveDrawingBuffer: true
          });
          renderer.setSize(480, 320, false);
          renderer.outputColorSpace = THREE.SRGBColorSpace;
          renderer.toneMapping = THREE.ACESFilmicToneMapping;
          renderer.toneMappingExposure = 1.15;

          const scene = new THREE.Scene();
          scene.background = new THREE.Color('#1e293b');
          scene.fog = new THREE.FogExp2('#334155', 0.06);

          const camera = new THREE.PerspectiveCamera(34, 480 / 320, 0.1, 50);
          camera.position.set(3.8, 2.7, 4.4);
          camera.lookAt(0, 0.95, 0);

          const hemi = new THREE.HemisphereLight('#fde68a', '#365314', 1.35);
          scene.add(hemi);

          const keyLight = new THREE.DirectionalLight('#fffbeb', 2.4);
          keyLight.position.set(5, 8, 6);
          scene.add(keyLight);

          const rimLight = new THREE.DirectionalLight('#60a5fa', 0.9);
          rimLight.position.set(-5, 4, -4);
          scene.add(rimLight);

          const ground = new THREE.Mesh(
            new THREE.CircleGeometry(4.5, 32),
            new THREE.MeshStandardMaterial({ color: '#3f6212', roughness: 0.9 })
          );
          ground.rotation.x = -Math.PI / 2;
          scene.add(ground);

          const model = gltf.scene;
          const box = new THREE.Box3().setFromObject(model);
          const size = box.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z, 0.01);
          const scale = 2.4 / maxDim;
          model.scale.setScalar(scale);

          const centeredBox = new THREE.Box3().setFromObject(model);
          const center = centeredBox.getCenter(new THREE.Vector3());
          model.position.x -= center.x;
          model.position.z -= center.z;
          model.position.y -= centeredBox.min.y;
          scene.add(model);

          renderer.render(scene, camera);
          const dataUrl = offCanvas.toDataURL('image/png');
          renderer.dispose();
          renderCache.set(category, dataUrl);
          resolve(dataUrl);
        } catch {
          resolve(fallback);
        }
      },
      undefined,
      () => resolve(fallback)
    );
  });
}

export function SurvivalMilestoneModal() {
  const state = useFocusStore();
  const milestone = state.lastMilestoneModal;
  const [imageUrl, setImageUrl] = useState<string>('');
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    if (!milestone) {
      setIsLeaving(false);
      return;
    }

    const arch =
      BUILDING_ARCHETYPES[milestone.category] ?? BUILDING_ARCHETYPES.GUILD_WORKSHOP;
    const immediateImg =
      renderCache.get(milestone.category) ??
      generateArchitecturalStudioFallback(milestone.category, arch.accentHex);
    setImageUrl(immediateImg);
    setIsLeaving(false);

    let cancelled = false;
    void renderGltfBuildingSnapshot(
      milestone.category,
      arch.completedGltf,
      arch.accentHex
    ).then((url) => {
      if (!cancelled && url) {
        setImageUrl(url);
      }
    });

    // Auto-dismiss after 4.5 seconds (within the 3-5 second requirement)
    const leaveTimer = window.setTimeout(() => {
      if (!cancelled) setIsLeaving(true);
    }, 4150);

    const dismissTimer = window.setTimeout(() => {
      if (!cancelled) {
        state.dismissMilestoneModal();
      }
    }, 4500);

    return () => {
      cancelled = true;
      window.clearTimeout(leaveTimer);
      window.clearTimeout(dismissTimer);
    };
  }, [milestone?.id]);

  if (!milestone) return null;

  const arch =
    BUILDING_ARCHETYPES[milestone.category] ?? BUILDING_ARCHETYPES.GUILD_WORKSHOP;

  return (
    <aside
      aria-live="polite"
      aria-label={`Completed building notification: ${milestone.guildName}`}
      data-testid="building-completion-toast"
      className={`fixed bottom-16 right-4 z-40 w-[380px] max-w-[calc(100vw-2rem)] pointer-events-auto transition-all duration-300 ease-out ${
        isLeaving
          ? 'opacity-0 translate-y-3 scale-95'
          : 'opacity-100 translate-y-0 scale-100'
      }`}
    >
      <div className="rounded-xl border-2 border-[#785133] bg-[#1c130d]/95 text-[#fdf8ee] shadow-[0_18px_45px_rgba(0,0,0,0.65)] overflow-hidden">
        {/* High-Res Building Render Header */}
        <div className="relative h-36 w-full bg-[#0f172a] overflow-hidden border-b border-[#5c3a21]">
          {imageUrl && (
            <img
              src={imageUrl}
              alt={`${milestone.guildName} 3D architectural render`}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#1c130d] via-transparent to-black/30" />

          <div className="absolute top-2.5 left-3 right-2.5 flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-[#fde68a] bg-black/65 px-2.5 py-1 rounded-md">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#4ade80]" />
              Building Completed
            </span>
            <button
              type="button"
              onClick={() => {
                voiceoverEngine.playWoodClick();
                state.dismissMilestoneModal();
              }}
              aria-label="Dismiss building notification"
              className="p-1 rounded-md bg-black/55 text-[#fde68a] hover:bg-black/80 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="absolute bottom-2 left-3 right-3 flex items-baseline justify-between gap-2">
            <h3 className="text-base font-bold text-white leading-tight drop-shadow">
              {milestone.guildName}
            </h3>
            <span className="text-[11px] font-semibold text-[#86efac] shrink-0">
              {arch.survivalEffect.split('·')[0].trim()}
            </span>
          </div>
        </div>

        {/* Concise 2-Sentence Description & Action Row */}
        <div className="p-3.5 space-y-2.5">
          <p className="text-xs text-[#e7d8c1] leading-relaxed">
            Completing <strong className="text-white">“{milestone.taskTitle}”</strong> raised the{' '}
            <strong className="text-[#fcd34d]">{milestone.guildName}</strong> in {state.townName}.{' '}
            {arch.survivalDetailedBenefit}
          </p>

          <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/10 text-[11px] text-[#cbb698]">
            <span>
              Builder: <strong className="text-[#fdf8ee]">{milestone.specialistName}</strong> · Auto-closes in 4s
            </span>
            {state.lastUndoTaskId && (
              <button
                type="button"
                onClick={() => {
                  voiceoverEngine.playWoodClick();
                  state.undoLastCompletion();
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#3b2516] hover:bg-[#52341f] text-[#fde68a] font-semibold transition-colors cursor-pointer"
              >
                <Undo2 className="w-3 h-3" />
                Undo
              </button>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
