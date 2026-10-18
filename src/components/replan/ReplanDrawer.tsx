'use client';

import React, { useState } from 'react';
import {
  RotateCcw,
  X,
  Clock,
  CheckSquare,
  Square,
  HeartHandshake,
  Loader2
} from 'lucide-react';
import { useFocusStore } from '../../store/useFocusStore';
import { voiceoverEngine } from '../../core/audio/voiceoverEngine';

export function ReplanDrawer() {
  const {
    isReplanDrawerOpen,
    isAiLoading,
    tasks,
    closeReplanDrawer,
    submitInterruptionReplan
  } = useFocusStore();

  const [interruptionText, setInterruptionText] = useState(
    'My day got interrupted — I only have 45 minutes left now.'
  );
  const [hoursLeft, setHoursLeft] = useState<number>(0);
  const [minutesLeft, setMinutesLeft] = useState<number>(45);
  const [checkedCompletedIds, setCheckedCompletedIds] = useState<string[]>([]);

  if (!isReplanDrawerOpen) return null;

  const totalRemainingMinutes = Math.max(
    10,
    Math.min(720, hoursLeft * 60 + minutesLeft)
  );

  const nonCompletedTasks = tasks.filter((t) => t.status !== 'completed');

  const toggleCompletedCheck = (taskId: string) => {
    setCheckedCompletedIds((prev) =>
      prev.includes(taskId)
        ? prev.filter((id) => id !== taskId)
        : [...prev, taskId]
    );
  };

  const handleSetPreset = (mins: number) => {
    setHoursLeft(Math.floor(mins / 60));
    setMinutesLeft(mins % 60);
    setInterruptionText(`I have ${mins} minutes remaining today.`);
  };

  const handleReplanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    voiceoverEngine.unlockOnUserGesture();

    await submitInterruptionReplan({
      interruptionText,
      quickMinutes: totalRemainingMinutes,
      newlyCompletedIds: checkedCompletedIds,
      useHostedAi: true
    });

    void voiceoverEngine.speak({
      speakerId: 'ELENA_VILLAGER',
      speakerName: 'Elena',
      speakerRole: 'Village Steward',
      text: `Please don't stress at all! Watch the village magically transform—we kept your finished buildings safe and reshaped the town for your ${totalRemainingMinutes} minutes left!`
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="replan-drawer-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
    >
      <div
        className="w-full max-w-xl border-4 border-[#4A2E1B] bg-[#FBF6EB] p-6 md:p-7 text-[#1E1610] shadow-[0_25px_70px_rgba(0,0,0,0.9)]"
        style={{ borderRadius: '6px' }}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#D8C8B0] pb-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#C85232]">
              <HeartHandshake className="h-4 w-4 shrink-0" />
              <span>Interruption-Aware Village Replanning</span>
            </div>
            <h2
              id="replan-drawer-title"
              className="mt-1 font-display text-2xl font-bold text-[#1E1610]"
            >
              Plans changed? Watch the village adapt.
            </h2>
            <p className="mt-1 text-sm text-[#4A3B2F]">
              Life interrupts everyone. Your finished monuments stay standing,
              and our enchanted timbers will telekinetically reconfigure around
              the clearest next step for the time you have left.
            </p>
          </div>
          <button
            type="button"
            onClick={closeReplanDrawer}
            aria-label="Close replan dialog"
            className="border-2 border-[#8C6D53] bg-[#EFE3CE] p-1.5 text-[#2D221A] hover:border-[#4A2E1B] cursor-pointer"
            style={{ borderRadius: '4px' }}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleReplanSubmit} className="mt-4 space-y-4">
          <div>
            <label
              htmlFor="interruption-note-input"
              className="block text-xs font-bold text-[#4A3B2F] mb-1"
            >
              What changed in your day?
            </label>
            <input
              id="interruption-note-input"
              type="text"
              value={interruptionText}
              onChange={(e) => setInterruptionText(e.target.value)}
              className="w-full border-2 border-[#8C6D53] bg-white px-3 py-2 text-sm font-semibold text-[#1E1610]"
              style={{ borderRadius: '4px' }}
            />
          </div>

          <div
            className="border border-[#D8C8B0] bg-[#F3E9D6] p-4 space-y-3"
            style={{ borderRadius: '4px' }}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-sm font-bold text-[#2D221A]">
                <Clock className="h-4 w-4 text-[#C85232] shrink-0" />
                <span>Remaining Time Budget:</span>
              </span>

              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={0}
                  max={12}
                  value={hoursLeft}
                  onChange={(e) =>
                    setHoursLeft(
                      Math.max(
                        0,
                        Math.min(12, parseInt(e.target.value, 10) || 0)
                      )
                    )
                  }
                  aria-label="Remaining Hours"
                  className="w-14 border-2 border-[#7C5836] bg-white px-2 py-1 text-center font-mono text-sm font-bold text-[#1E1610]"
                  style={{ borderRadius: '4px' }}
                />
                <span className="text-xs font-bold text-[#4A3B2F]">hr</span>

                <input
                  type="number"
                  min={0}
                  max={59}
                  step={5}
                  value={minutesLeft}
                  onChange={(e) =>
                    setMinutesLeft(
                      Math.max(
                        0,
                        Math.min(59, parseInt(e.target.value, 10) || 0)
                      )
                    )
                  }
                  aria-label="Remaining Minutes"
                  className="w-14 border-2 border-[#7C5836] bg-white px-2 py-1 text-center font-mono text-sm font-bold text-[#1E1610]"
                  style={{ borderRadius: '4px' }}
                />
                <span className="text-xs font-bold text-[#4A3B2F]">min</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {[25, 35, 45, 60, 90, 120].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => handleSetPreset(mins)}
                  className={`border px-3 py-1 font-mono text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                    totalRemainingMinutes === mins
                      ? 'border-[#5C220E] bg-[#C85232] text-white'
                      : 'border-[#8C6D53] bg-white text-[#2D221A] hover:bg-[#EFE3CE]'
                  }`}
                  style={{ borderRadius: '4px' }}
                >
                  {mins}m left
                </button>
              ))}
            </div>
          </div>

          {nonCompletedTasks.length > 0 && (
            <div>
              <p className="text-xs font-bold text-[#5C3D24] mb-1.5">
                Did you already complete any of these before the interruption?
              </p>
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {nonCompletedTasks.map((task) => {
                  const isChecked = checkedCompletedIds.includes(task.id);
                  return (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => toggleCompletedCheck(task.id)}
                      className={`flex w-full items-center justify-between border px-3 py-2 text-left text-xs md:text-sm font-bold transition cursor-pointer ${
                        isChecked
                          ? 'border-emerald-700 bg-emerald-50 text-emerald-950'
                          : 'border-[#8C6D53] bg-white text-[#1E1610]'
                      }`}
                      style={{ borderRadius: '4px' }}
                    >
                      <span className="flex items-center gap-2">
                        {isChecked ? (
                          <CheckSquare className="h-4 w-4 text-emerald-700 shrink-0" />
                        ) : (
                          <Square className="h-4 w-4 text-[#8C6D53] shrink-0" />
                        )}
                        <span>{task.title}</span>
                      </span>
                      <span className="font-mono text-xs font-semibold text-[#5C3D24]">
                        {task.estimatedMinutes}m
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={closeReplanDrawer}
              className="border-2 border-[#8C6D53] bg-[#EFE3CE] px-4 py-2 text-xs md:text-sm font-bold text-[#2D221A] cursor-pointer whitespace-nowrap"
              style={{ borderRadius: '4px' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isAiLoading}
              className="inline-flex items-center gap-2 border-2 border-[#5C220E] bg-[#C85232] px-5 py-2 text-xs md:text-sm font-bold text-white shadow-lg hover:bg-[#B04325] disabled:opacity-50 transition cursor-pointer whitespace-nowrap"
              style={{ borderRadius: '4px' }}
            >
              {isAiLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                  <span>Magically Reconfiguring...</span>
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4 shrink-0" />
                  <span>
                    Magically Transform Plan ({totalRemainingMinutes}m)
                  </span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
