'use client';

import React, { useEffect, useState, useRef } from 'react';
import {
  Menu,
  X,
  Volume2,
  VolumeX,
  RotateCcw,
  PlusCircle,
  PlayCircle,
  Cpu,
  Hammer,
  Compass,
  Eye,
  BookOpen,
  CheckCircle2,
  Sparkles,
  ChevronRight
} from 'lucide-react';
import { useFocusStore } from '@/store/useFocusStore';
import { voiceoverEngine } from '@/core/audio/voiceoverEngine';
import { BUILDING_ARCHETYPES, type VillagerVoiceLine } from '@/types/focus';
import { PlanDiffBanner } from '../replan/PlanDiffBanner';
import { SurvivalMilestoneModal } from './SurvivalMilestoneModal';
import { TutorialGuideModal } from './TutorialGuideModal';

const LEVEL_TITLES: Record<number, string> = {
  1: 'Level 1 • Pioneer Settlement',
  2: 'Level 2 • Timber Hamlet',
  3: 'Level 3 • Valley Homestead',
  4: 'Level 4 • Bustling Guild Town',
  5: 'Level 5 • Thriving Stronghold'
};

export function TopSanctuaryBar() {
  const {
    hasEnteredWorld,
    cameraStage,
    cameraProjection,
    previewThrivingTown,
    townName,
    founderName,
    landmarks,
    selectedLandmarkId,
    selectLandmark,
    completeTask,
    resumeDeferredGoals,
    openGoalModal,
    openTutorial,
    openReplanDrawer,
    toggleExperienceLab,
    toggleCameraProjection,
    togglePreviewThrivingTown,
    isAudioMuted,
    toggleMute,
    villageGold,
    villageLumber,
    villageFood,
    villagerPopulation,
    clearedTreesCount,
    landRadiusMeters
  } = useFocusStore();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeVoice, setActiveVoice] = useState<VillagerVoiceLine | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    return voiceoverEngine.subscribeVoiceLine((line) => {
      setActiveVoice(line);
    });
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen]);

  // Keyboard shortcut for camera toggle ('C')
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }
      if (e.key.toLowerCase() === 'c' && cameraStage === 'village') {
        toggleCameraProjection();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [toggleCameraProjection, cameraStage]);

  if (!hasEnteredWorld || cameraStage !== 'village') {
    return (
      <>
        <SurvivalMilestoneModal />
        <TutorialGuideModal />
      </>
    );
  }

  const completedCount = landmarks.filter((l) => l.isCompleted).length;
  const deferredCount = landmarks.filter((l) => l.isDeferred).length;
  const plotCapacity = Math.max(8, 8 + Math.floor(clearedTreesCount / 2));
  const villageLevel = previewThrivingTown
    ? 5
    : Math.min(5, 1 + Math.floor(completedCount * 0.85));
  const citizensCount = previewThrivingTown ? 28 : villagerPopulation;

  const selectedNode =
    landmarks.find((l) => l.id === selectedLandmarkId) ?? null;

  const selectedArch = selectedNode
    ? BUILDING_ARCHETYPES[selectedNode.category] ?? BUILDING_ARCHETYPES.GUILD_WORKSHOP
    : null;

  return (
    <>
      <SurvivalMilestoneModal />
      <TutorialGuideModal />

      {/* Top Streamlined Carved-Oak & Warm Parchment HUD Bar */}
      <header className="fixed top-3 left-4 right-4 z-30 pointer-events-none flex justify-center">
        <div className="pointer-events-auto w-full max-w-[1400px] bg-[#fbf4e6]/95 backdrop-blur-md border-2 border-[#5c3a21] rounded-xl px-4 py-2.5 shadow-[0_8px_30px_rgba(40,24,12,0.25)] flex items-center justify-between gap-4">
          {/* Left: Village Crest, Level Title & Compact Metrics */}
          <div className="flex items-center gap-3.5">
            <div className="w-9 h-9 rounded-lg bg-[#b84a27] border border-[#5c3a21] flex items-center justify-center text-[#fff8eb] font-bold shadow-sm shrink-0">
              <Hammer className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display text-base sm:text-lg font-bold text-[#2b180a] leading-none whitespace-nowrap">
                  {townName}
                </h1>
                <span className="text-xs font-semibold text-[#8c6b4f]">•</span>
                <span className="text-xs font-bold text-[#b84a27] whitespace-nowrap">
                  {LEVEL_TITLES[villageLevel] ?? `Level ${villageLevel}`}
                </span>
                <span className="hidden lg:inline text-xs font-medium text-[#6e5239]">
                  • Founder {founderName} •{' '}
                  <span className="tabular-nums font-bold text-[#2b180a]">
                    {completedCount}/{landmarks.length}
                  </span>{' '}
                  Buildings Completed
                </span>
              </div>

              <div className="flex items-center gap-2 mt-1 text-[11px] font-mono tabular-nums text-[#5c4028]">
                <span>
                  Workers: <strong>{citizensCount}</strong>
                </span>
                <span>•</span>
                <span>
                  Timber: <strong>{villageLumber}</strong> • Gold:{' '}
                  <strong>{villageGold}</strong> • Food:{' '}
                  <strong>{villageFood}</strong>
                </span>
                <span className="hidden md:inline">•</span>
                <span
                  className="hidden md:inline text-[#15803d] font-semibold"
                  title="Available Building Plot Capacity vs Active Goals"
                >
                  Land:{' '}
                  <strong>
                    {landmarks.length}/{plotCapacity} Plots
                  </strong>{' '}
                  ({landRadiusMeters}m)
                </span>
              </div>
            </div>
          </div>

          {/* Right: Transparent, uncluttered primary buttons + sleek Menu dropdown */}
          <div className="flex items-center gap-2">
            {/* Set Today's Goals (Primary Action) */}
            <button
              type="button"
              onClick={() => {
                voiceoverEngine.unlockOnUserGesture();
                voiceoverEngine.playWoodClick();
                openGoalModal();
              }}
              title="Add or update your daily productivity goals"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#b84a27] hover:bg-[#9e3c1d] text-[#fff8eb] text-xs font-bold border border-[#5c3a21] shadow-sm transition cursor-pointer whitespace-nowrap shrink-0"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>
                {completedCount > 0 && completedCount === landmarks.length
                  ? '✨ Add More Goals'
                  : "Set Today's Goals"}
              </span>
            </button>

            {/* Review Interruption */}
            <button
              type="button"
              onClick={() => {
                voiceoverEngine.unlockOnUserGesture();
                voiceoverEngine.playWoodClick();
                openReplanDrawer();
              }}
              title="Adjust your plan if an interruption or meeting occurred"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#f0dfc5] hover:bg-[#e4cead] text-[#2b180a] text-xs font-bold border border-[#785133] transition cursor-pointer whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5 text-[#b84a27]" />
              <span className="hidden sm:inline">Review Interruption</span>
              <span className="sm:hidden">Interrupted</span>
            </button>

            {/* Resume Goal (Conditional) */}
            {deferredCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  voiceoverEngine.unlockOnUserGesture();
                  resumeDeferredGoals();
                }}
                title="Restore paused goals back into today's active schedule"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#15803d] hover:bg-[#166534] text-[#fff8eb] text-xs font-bold border border-[#14532d] transition cursor-pointer whitespace-nowrap shrink-0"
              >
                <PlayCircle className="w-3.5 h-3.5" />
                <span>Resume Goal ({deferredCount})</span>
              </button>
            )}

            {/* Sleek Menu Dropdown (Hides secondary controls so the 3D world breathes!) */}
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => {
                  voiceoverEngine.playWoodClick();
                  setIsMenuOpen((prev) => !prev);
                }}
                title="Open settings and village controls"
                aria-label="Toggle menu"
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border transition cursor-pointer shrink-0 ${
                  isMenuOpen
                    ? 'bg-[#4a2e18] text-[#fdf8ee] border-[#2e1c0e]'
                    : 'bg-[#ebd8bd] hover:bg-[#dfc7a7] text-[#2b180a] border-[#785133]'
                }`}
              >
                <Menu className="w-4 h-4" />
                <span className="hidden md:inline">Menu</span>
              </button>

              {isMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-xl bg-[#2a1b12]/95 backdrop-blur-md border-2 border-[#785133] text-[#fdf8ee] shadow-[0_16px_40px_rgba(0,0,0,0.6)] py-2 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#d4af37] border-b border-[#5c3a21]/60">
                    Village Controls
                  </div>

                  {/* Camera Projection Toggle */}
                  <button
                    type="button"
                    onClick={() => {
                      voiceoverEngine.playWoodClick();
                      toggleCameraProjection();
                      setIsMenuOpen(false);
                    }}
                    className="w-full px-3 py-2 text-left text-xs font-semibold flex items-center justify-between hover:bg-[#3d2719] transition cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <Compass className="w-4 h-4 text-[#60a5fa]" />
                      <span>Camera View</span>
                    </span>
                    <span className="text-[11px] font-bold text-[#fde68a]">
                      {cameraProjection === 'ISOMETRIC_RTS' ? 'Isometric' : 'Valley'}
                    </span>
                  </button>

                  {/* Preview Full Town */}
                  <button
                    type="button"
                    onClick={() => {
                      voiceoverEngine.unlockOnUserGesture();
                      togglePreviewThrivingTown();
                      setIsMenuOpen(false);
                    }}
                    className="w-full px-3 py-2 text-left text-xs font-semibold flex items-center justify-between hover:bg-[#3d2719] transition cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <Eye className="w-4 h-4 text-[#f59e0b]" />
                      <span>Full Town Preview</span>
                    </span>
                    <span className="text-[11px] font-bold text-[#fde68a]">
                      {previewThrivingTown ? 'Active' : 'Off'}
                    </span>
                  </button>

                  {/* Village Handbook Guide */}
                  <button
                    type="button"
                    onClick={() => {
                      voiceoverEngine.playWoodClick();
                      openTutorial();
                      setIsMenuOpen(false);
                    }}
                    className="w-full px-3 py-2 text-left text-xs font-semibold flex items-center gap-2 hover:bg-[#3d2719] transition cursor-pointer"
                  >
                    <BookOpen className="w-4 h-4 text-[#ca8a04]" />
                    <span>Village Guide & Handbook</span>
                  </button>

                  {/* AI Planner Inspector */}
                  <button
                    type="button"
                    onClick={() => {
                      voiceoverEngine.playWoodClick();
                      toggleExperienceLab();
                      setIsMenuOpen(false);
                    }}
                    className="w-full px-3 py-2 text-left text-xs font-semibold flex items-center gap-2 hover:bg-[#3d2719] transition cursor-pointer"
                  >
                    <Cpu className="w-4 h-4 text-[#8c4f27]" />
                    <span>AI Planner Inspector</span>
                  </button>

                  <div className="border-t border-[#5c3a21]/60 my-1" />

                  {/* Audio Mute/Unmute */}
                  <button
                    type="button"
                    onClick={() => {
                      voiceoverEngine.unlockOnUserGesture();
                      toggleMute();
                    }}
                    className="w-full px-3 py-2 text-left text-xs font-semibold flex items-center justify-between hover:bg-[#3d2719] transition cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      {isAudioMuted ? (
                        <VolumeX className="w-4 h-4 text-red-400" />
                      ) : (
                        <Volume2 className="w-4 h-4 text-green-400" />
                      )}
                      <span>Soundscape & Voice</span>
                    </span>
                    <span className="text-[11px] font-bold text-[#fde68a]">
                      {isAudioMuted ? 'Muted' : 'Playing'}
                    </span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Plan Difference Banner (Appears when replan occurred) */}
      <PlanDiffBanner />

      {/* Clean Minimal Side HUD on Selection (Replaces 3D floating text clutter) */}
      {selectedNode && selectedArch && (
        <aside
          data-testid="landmark-side-hud"
          className="fixed bottom-4 left-4 z-20 w-80 max-w-[calc(100vw-2rem)] rounded-xl border-2 border-[#5c3a21] bg-[#1c120a]/95 backdrop-blur-md text-[#fdf8ee] shadow-[0_12px_32px_rgba(0,0,0,0.6)] p-3.5 animate-in fade-in slide-in-from-bottom-2 duration-200 pointer-events-auto"
        >
          <div className="flex items-start justify-between gap-2 border-b border-white/10 pb-2">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#fde68a]">
                Plot #{selectedNode.plotIndex + 1} • {selectedNode.isCompleted ? 'Completed' : 'In Progress'}
              </span>
              <h3 className="text-sm font-bold text-white leading-tight mt-0.5">
                {selectedNode.label}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => selectLandmark(null)}
              className="p-1 rounded bg-black/40 hover:bg-black/60 text-[#cbb698] cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="mt-2.5 space-y-1.5 text-xs text-[#e7d8c1]">
            <p className="leading-relaxed">
              <strong className="text-white">Goal:</strong> {selectedNode.subtitle}
            </p>
            <p className="text-[11px] text-[#86efac] font-medium">
              {selectedArch.survivalEffect}
            </p>
            <p className="text-[11px] text-[#cbb698]">
              Builder: <strong>{selectedArch.specialistName}</strong> ({selectedArch.specialistTitle})
            </p>
          </div>

          {!selectedNode.isCompleted && (
            <button
              type="button"
              onClick={() => {
                voiceoverEngine.unlockOnUserGesture();
                completeTask(selectedNode.taskId);
              }}
              className="mt-3 w-full inline-flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-[#15803d] hover:bg-[#166534] text-[#fff8eb] text-xs font-bold shadow transition cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4 text-[#86efac]" />
              <span>Mark Goal Completed</span>
            </button>
          )}
        </aside>
      )}
    </>
  );
}
