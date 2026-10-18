'use client';

import React, { useState, useEffect } from 'react';
import { Hammer, Clock, Volume2, ArrowRight, AlertCircle, Sparkles } from 'lucide-react';
import { useFocusStore } from '../../store/useFocusStore';
import { voiceoverEngine } from '../../core/audio/voiceoverEngine';
import type { VillagerVoiceLine } from '../../types/focus';

/**
 * Diegetic Interactive Goal Capture HUD Inside the Real-Time 3D WebGL Cabin!
 * - 100% real-time 3D WebGL scene: The 4 animated 3D villagers physically hold the 3D frame,
 *   breathe, blink, track the cursor/camera, in front of the roaring 3D stone fireplace.
 * - Zero flat 2D picture backgrounds! The 3D canvas renders behind this transparent HUD.
 */
export function GoalCaptureModal() {
  const {
    isGoalModalOpen,
    cameraStage,
    founderName,
    townName,
    tasks,
    closeGoalModal,
    buildVillageFromGoalsInstantly,
    resetVillageAndStartFresh
  } = useFocusStore();

  const completedCount = tasks.filter((t) => t.status === 'completed').length;
  const allTasksCompleted = completedCount > 0 && completedCount === tasks.length;

  const [promptText, setPromptText] = useState(
    allTasksCompleted
      ? 'Review lecture notes for 40 minutes, draft summary report for 35 minutes, evening walk for 25 minutes'
      : 'Study for an hour, finish my assignment for 40 minutes, go for a walk for 25 minutes, and call my friend for 20 minutes'
  );
  const [hoursInput, setHoursInput] = useState<number>(2);
  const [minutesInput, setMinutesInput] = useState<number>(30);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [activeVoiceLine, setActiveVoiceLine] =
    useState<VillagerVoiceLine | null>(null);

  useEffect(() => {
    return voiceoverEngine.onSubtitleChange(setActiveVoiceLine);
  }, []);

  useEffect(() => {
    if (cameraStage === 'cabin' || isGoalModalOpen) {
      const timer = setTimeout(() => {
        if (!voiceoverEngine.getActiveSpeakerId()) {
          const speakText = allTasksCompleted
            ? `Incredible work in ${townName}, ${founderName}! You finished today's goals! Write your next goals on the parchment to expand the settlement, or start a fresh day!`
            : `Welcome by the fire, ${founderName}! Maya, Clara, Alden, and I are ready to plan your day. Write what you will do today on the parchment!`;
          void voiceoverEngine.speak({
            speakerId: 'ELENA_VILLAGER',
            speakerName: 'Elena',
            speakerRole: 'Village Steward',
            text: speakText
          });
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [cameraStage, isGoalModalOpen, founderName, allTasksCompleted, townName]);

  if (!isGoalModalOpen && cameraStage !== 'cabin') return null;

  const totalCustomMinutes = Math.max(
    15,
    Math.min(960, hoursInput * 60 + minutesInput)
  );

  const handleSetQuickPreset = (totalMins: number) => {
    setHoursInput(Math.floor(totalMins / 60));
    setMinutesInput(totalMins % 60);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanText = promptText.trim();
    if (!cleanText) {
      setValidationError(
        'Please write at least one goal on the parchment before transforming the village.'
      );
      return;
    }
    setValidationError(null);

    voiceoverEngine.unlockOnUserGesture();

    void buildVillageFromGoalsInstantly({
      promptText: cleanText,
      availableMinutes: totalCustomMinutes
    });

    void voiceoverEngine.speak({
      speakerId: 'MAYA_BUILDER',
      speakerName: 'Maya',
      speakerRole: 'Master Builder',
      text: `We framed your goals for ${townName}, ${founderName}! Step outside—watch our enchanted timber beams and rooftops telekinetically assemble right now!`
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cabin-parchment-title"
      className="pointer-events-none fixed inset-0 z-40 flex flex-col justify-between p-4 md:p-6"
    >
      {/* Top Bar Inside Real-Time 3D Log Cabin (3D Villagers & Hearth 100% Visible!) */}
      <div className="pointer-events-auto flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <div
            className="border-2 border-[#6E4726] bg-[#1E120A]/95 px-3.5 py-2 text-xs font-bold text-[#FBF3E4] shadow-xl backdrop-blur-sm"
            style={{ borderRadius: '6px' }}
          >
            Inside {townName} Hearth Cabin · Real-Time 3D Villagers Active
          </div>

          <button
            type="button"
            onClick={() => {
              voiceoverEngine.unlockOnUserGesture();
              void voiceoverEngine.speak({
                speakerId: 'ELENA_VILLAGER',
                speakerName: 'Elena',
                speakerRole: 'Village Steward',
                text: `Welcome by the fire, ${founderName}! Maya, Clara, Alden, and I are ready to plan your day. Write what you will do today on the parchment!`
              });
            }}
            className="inline-flex items-center gap-1.5 border-2 border-[#8C5A32] bg-[#2B180C]/95 px-3.5 py-2 text-xs font-bold text-amber-300 shadow-xl backdrop-blur-sm hover:bg-[#3B2212] transition cursor-pointer whitespace-nowrap"
            style={{ borderRadius: '6px' }}
          >
            <Volume2 className="h-4 w-4 shrink-0" />
            <span>Hear Villagers Speak</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            voiceoverEngine.unlockOnUserGesture();
            closeGoalModal();
          }}
          className="inline-flex items-center gap-2 border-2 border-[#8C5A32] bg-[#1E120A]/95 px-4 py-2 text-xs md:text-sm font-bold text-[#FBF3E4] shadow-xl backdrop-blur-sm hover:bg-[#2E1C10] transition cursor-pointer whitespace-nowrap"
          style={{ borderRadius: '6px' }}
        >
          <span>Step Outside to 3D Village</span>
          <ArrowRight className="h-4 w-4 shrink-0" />
        </button>
      </div>

      {/* Live Villager Speech Subtitle Banner */}
      {activeVoiceLine && (
        <div
          className="pointer-events-auto mx-auto flex max-w-xl items-center justify-between gap-3 border-2 border-[#8C5A32] bg-[#1A0F08]/95 px-4 py-2.5 text-[#FBF6EB] shadow-2xl backdrop-blur-md"
          style={{ borderRadius: '6px' }}
        >
          <div className="text-xs md:text-sm">
            <span className="font-bold text-amber-400">
              {activeVoiceLine.speakerName} ({activeVoiceLine.speakerRole}):{' '}
            </span>
            <span>“{activeVoiceLine.text}”</span>
          </div>
          <button
            type="button"
            onClick={() => void voiceoverEngine.replayLastLine()}
            className="shrink-0 border border-amber-400/50 bg-[#2E1A0E] px-2.5 py-1 text-xs font-bold text-amber-300 hover:bg-[#3E2414] cursor-pointer whitespace-nowrap"
            style={{ borderRadius: '4px' }}
          >
            Replay
          </button>
        </div>
      )}

      {/* =====================================================================
          DIEGETIC INTERACTIVE CARVED PARCHMENT FRAME HELD BY THE 3D VILLAGERS
          Positioned in the lower portion so the real 3D villagers, roaring stone
          fireplace, and rising ember sparks shine across the upper screen!
      ===================================================================== */}
      <form
        onSubmit={handleSubmit}
        className="pointer-events-auto mx-auto mb-1 w-full max-w-[620px]"
        style={{ perspective: '1100px' }}
      >
        <div
          className="border-[6px] border-[#4B2C16] bg-[#DBC39B]/95 p-4 md:p-5 text-[#2A170B] shadow-[0_28px_80px_rgba(0,0,0,0.95)] backdrop-blur-sm"
          style={{
            borderRadius: '8px',
            transform: 'rotateX(3deg)'
          }}
        >
          <div className="border-2 border-[#7A5432] bg-[#E8D5B5]/95 p-3.5 md:p-4 rounded">
            <h2
              id="cabin-parchment-title"
              className="text-center font-serif text-xl md:text-2xl font-bold text-[#2B1709] tracking-tight"
            >
              What will you do today?
            </h2>

            {/* Glowing Recessed Parchment Textarea */}
            <div className="mt-2.5">
              <label htmlFor="cabin-goal-textarea" className="sr-only">
                Write your goals for today
              </label>
              <textarea
                id="cabin-goal-textarea"
                rows={2}
                value={promptText}
                onChange={(e) => {
                  setPromptText(e.target.value);
                  if (validationError) setValidationError(null);
                }}
                placeholder="Study for an hour, finish assignment, go for a walk..."
                className="w-full rounded border-2 border-[#A68458] bg-[#FFFDF7] p-3 text-sm md:text-base font-semibold text-[#1F1108] placeholder:text-[#8A6D4B] shadow-[inset_0_3px_10px_rgba(120,80,30,0.25)] focus:border-[#B84322] focus:outline-none"
              />
            </div>

            {validationError && (
              <div
                role="alert"
                className="mt-2 flex items-center gap-1.5 text-xs font-bold text-[#991B1B]"
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{validationError}</span>
              </div>
            )}

            {/* Time Budget & Action Controls */}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2.5 pt-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 text-xs font-bold text-[#5C3416]">
                  <Clock className="h-3.5 w-3.5 shrink-0" />
                  <span>Window:</span>
                </span>

                <input
                  type="number"
                  min={0}
                  max={16}
                  value={hoursInput}
                  onChange={(e) =>
                    setHoursInput(
                      Math.max(0, Math.min(16, parseInt(e.target.value, 10) || 0))
                    )
                  }
                  aria-label="Available Hours"
                  className="w-10 rounded border border-[#6E4A28] bg-[#FFFDF8] px-1 py-1 text-center font-mono text-xs font-bold text-[#26150A]"
                />
                <span className="text-xs font-bold text-[#3D2412]">hr</span>

                <input
                  type="number"
                  min={0}
                  max={59}
                  step={5}
                  value={minutesInput}
                  onChange={(e) =>
                    setMinutesInput(
                      Math.max(0, Math.min(59, parseInt(e.target.value, 10) || 0))
                    )
                  }
                  aria-label="Available Minutes"
                  className="w-10 rounded border border-[#6E4A28] bg-[#FFFDF8] px-1 py-1 text-center font-mono text-xs font-bold text-[#26150A]"
                />
                <span className="text-xs font-bold text-[#3D2412]">min</span>

                {[45, 90, 120, 240].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => handleSetQuickPreset(m)}
                    className={`rounded border px-2 py-0.5 font-mono text-xs font-bold cursor-pointer whitespace-nowrap transition ${
                      totalCustomMinutes === m
                        ? 'border-[#4A1808] bg-[#B84322] text-white shadow-sm'
                        : 'border-[#8C6742] bg-[#FAF0DC] text-[#3D2412] hover:bg-[#EFE0C4]'
                    }`}
                  >
                    {m >= 60 && m % 60 === 0 ? `${m / 60}h` : `${m}m`}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                {allTasksCompleted ? (
                  <button
                    type="button"
                    onClick={() => {
                      voiceoverEngine.playWoodClick();
                      resetVillageAndStartFresh();
                    }}
                    className="rounded border border-[#7A5634] bg-[#FAF0DC] px-2.5 py-1.5 text-xs font-bold text-[#3D2412] hover:bg-[#EBD8B7] cursor-pointer whitespace-nowrap"
                  >
                    🌅 Start Fresh Day
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setPromptText(
                        'Study for an hour, finish my assignment for 40 minutes, go for a walk for 25 minutes, and call my friend for 20 minutes'
                      );
                      setValidationError(null);
                    }}
                    className="rounded border border-[#7A5634] bg-[#FAF0DC] px-2.5 py-1.5 text-xs font-bold text-[#3D2412] hover:bg-[#EBD8B7] cursor-pointer whitespace-nowrap"
                  >
                    Load Study Day
                  </button>
                )}

                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded border-2 border-[#421506] bg-[#B84322] px-4 py-1.5 text-xs md:text-sm font-bold text-white shadow-lg hover:bg-[#9E3618] active:scale-[0.99] transition cursor-pointer whitespace-nowrap"
                >
                  <Hammer className="h-4 w-4 shrink-0 text-amber-200" />
                  <span>
                    {allTasksCompleted
                      ? `Expand Village (+${totalCustomMinutes}m)`
                      : `Transform Village (${totalCustomMinutes}m)`}
                  </span>
                  <Sparkles className="h-3.5 w-3.5 shrink-0 text-amber-200" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
