'use client';

import React, { useEffect, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { useFocusStore } from '../../store/useFocusStore';
import { voiceoverEngine } from '../../core/audio/voiceoverEngine';

export function SanctuaryGateway() {
  const {
    hasEnteredWorld,
    cameraStage,
    founderName: storedFounder,
    townName: storedTown,
    setFounderAndTown,
    enterWorld
  } = useFocusStore();

  const [founderName, setFounderName] = useState(storedFounder || 'Awais');
  const [townName, setTownName] = useState(storedTown || 'Oakvale');

  useEffect(() => {
    const cleanFounder = founderName.trim() || 'Awais';
    const cleanTown = townName.trim() || 'Oakvale';
    void voiceoverEngine.preload({
      speakerId: 'ELENA_VILLAGER',
      text: `Welcome to ${cleanTown}, ${cleanFounder}! Step inside our warm log cabin by the hearth. We brought the carved wooden frame—write what you will do today on the parchment!`
    });
  }, [founderName, townName]);

  const handleOpenGate = (muted: boolean, skipToVillage = false) => {
    const cleanFounder = founderName.trim() || 'Awais';
    const cleanTown = townName.trim() || 'Oakvale';

    setFounderAndTown(cleanFounder, cleanTown);

    // Synchronously unlock Web Audio API inside the user gesture
    voiceoverEngine.unlockOnUserGesture();
    voiceoverEngine.setMuted(muted);
    if (!muted) {
      voiceoverEngine.startAmbientSoundscape();
    }

    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    enterWorld({ muted, skipToVillage });

    const welcomeText = skipToVillage
      ? `Welcome back to ${cleanTown}, ${cleanFounder}! Watch our enchanted timbers assemble your village goals in the golden-hour sun.`
      : `Welcome to ${cleanTown}, ${cleanFounder}! Step inside our warm log cabin by the hearth. We brought the carved wooden frame—write what you will do today on the parchment!`;

    void voiceoverEngine.speak({
      speakerId: 'ELENA_VILLAGER',
      speakerName: 'Elena',
      speakerRole: 'Village Steward',
      text: welcomeText
    });
  };

  useEffect(() => {
    if (hasEnteredWorld || cameraStage !== 'gate') return;
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleOpenGate(false, false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  if (hasEnteredWorld && cameraStage !== 'gate') {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="gateway-title"
      className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex flex-col items-center justify-end p-4"
    >
      <div
        className="pointer-events-auto w-full max-w-xl border-4 border-[#4A2E1B] bg-[#FBF6EB] p-6 md:p-7 text-[#1E1610] shadow-[0_24px_64px_rgba(12,7,3,0.9)]"
        style={{ borderRadius: '6px' }}
      >
        {/* Bespoke Inline SVG Village Crest Lockup */}
        <div className="flex items-center gap-3">
          <svg
            viewBox="0 0 44 44"
            className="h-11 w-11 shrink-0"
            aria-hidden="true"
          >
            <rect
              x="2"
              y="2"
              width="40"
              height="40"
              rx="6"
              fill="#2B180B"
              stroke="#C85232"
              strokeWidth="2.5"
            />
            <polygon points="22,7 9,20 35,20" fill="#255785" />
            <rect x="13" y="20" width="18" height="15" fill="#FAF0DC" />
            <line
              x1="13"
              y1="20"
              x2="31"
              y2="35"
              stroke="#4B2E19"
              strokeWidth="2.2"
            />
            <line
              x1="31"
              y1="20"
              x2="13"
              y2="35"
              stroke="#4B2E19"
              strokeWidth="2.2"
            />
            <rect x="19" y="25" width="6" height="10" rx="2" fill="#F59E0B" />
          </svg>
          <div>
            <div className="text-xs font-semibold tracking-wide text-[#7C3F1D]">
              Focus · Living 3D Storybook Village · Standing at {townName} Gate
            </div>
            <h1
              id="gateway-title"
              className="font-display text-2xl md:text-3xl font-bold text-[#1E1610] leading-tight"
            >
              Turn your changing day into a living village.
            </h1>
          </div>
        </div>

        <p className="mt-2.5 text-sm text-[#4A3B2F] leading-relaxed">
          State your daily goals inside the warm log cabin, watch your cottages
          telekinetically assemble in 3D, and replan without guilt whenever life
          interrupts.
        </p>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="founder-name-input"
              className="block text-xs font-bold text-[#4A3B2F] mb-1"
            >
              Your Name
            </label>
            <input
              id="founder-name-input"
              type="text"
              value={founderName}
              onChange={(e) => setFounderName(e.target.value)}
              className="w-full border-2 border-[#8C6D53] bg-white px-3 py-1.5 text-sm font-bold text-[#1E1610] focus:border-[#C85232] focus:outline-none"
              style={{ borderRadius: '4px' }}
            />
          </div>

          <div>
            <label
              htmlFor="town-name-input"
              className="block text-xs font-bold text-[#4A3B2F] mb-1"
            >
              Village Name
            </label>
            <input
              id="town-name-input"
              type="text"
              value={townName}
              onChange={(e) => setTownName(e.target.value)}
              className="w-full border-2 border-[#8C6D53] bg-white px-3 py-1.5 text-sm font-bold text-[#1E1610] focus:border-[#C85232] focus:outline-none"
              style={{ borderRadius: '4px' }}
            />
          </div>
        </div>

        <div className="mt-5 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <button
            type="button"
            data-start="true"
            onClick={() => handleOpenGate(false, false)}
            className="inline-flex flex-1 items-center justify-center gap-2 border-2 border-[#5C200C] bg-[#C85232] px-4 py-2.5 text-sm font-bold text-white shadow-lg hover:bg-[#B04325] transition cursor-pointer whitespace-nowrap"
            style={{ borderRadius: '4px' }}
          >
            <Volume2 className="h-4 w-4 shrink-0" />
            <span>Unlatch &amp; Open Village Gates</span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenGate(false, true)}
            className="inline-flex items-center justify-center border-2 border-[#4A2E1B] bg-[#EFE3CE] px-3.5 py-2.5 text-xs md:text-sm font-bold text-[#1E1610] hover:bg-[#E2D1B3] transition cursor-pointer whitespace-nowrap"
            style={{ borderRadius: '4px' }}
          >
            <span>Explore Village Directly</span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenGate(true, false)}
            aria-label="Enter Muted"
            className="inline-flex items-center justify-center gap-1.5 border-2 border-[#8C6D53] bg-white px-3.5 py-2.5 text-xs md:text-sm font-bold text-[#2D221A] hover:border-[#4A2E1B] transition cursor-pointer whitespace-nowrap"
            style={{ borderRadius: '4px' }}
          >
            <VolumeX className="h-4 w-4 shrink-0" />
            <span>Enter Muted</span>
          </button>
        </div>

        <div className="mt-3 text-center text-xs text-[#6E5A48]">
          Drag to Orbit 3D Village · Scroll to Zoom · Click Villagers or
          Cottages to Interact · Press Enter to Start
        </div>
      </div>
    </div>
  );
}
