'use client';

import React from 'react';
import { Undo2, X } from 'lucide-react';
import { useFocusStore } from '../../store/useFocusStore';

export function PlanDiffBanner() {
  const {
    planDiff,
    availableMinutes,
    previousSnapshot,
    undoLastReplan,
    dismissPlanDiff
  } = useFocusStore();

  if (planDiff.length === 0) return null;

  const scheduledItems = planDiff.filter((d) => d.newState === 'scheduled');
  const deferredItems = planDiff.filter((d) => d.newState === 'deferred');

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-auto mx-auto mt-2.5 max-w-3xl border-2 border-[#4A2E1B] bg-[#FBF6EB] px-4 py-3 text-[#1E1610] shadow-xl"
      style={{ borderRadius: '4px' }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-bold text-[#7C2D12]">
          Village Reconfigured for {availableMinutes}m Remaining ·{' '}
          {scheduledItems.length} Active · {deferredItems.length} Safely Stored
          in Storehouse
        </div>

        <div className="flex items-center gap-2">
          {previousSnapshot && (
            <button
              type="button"
              onClick={undoLastReplan}
              className="inline-flex items-center gap-1 border border-[#8C6D53] bg-[#EFE3CE] px-2.5 py-1 text-xs font-bold text-[#1E1610] hover:bg-[#E2D1B3] cursor-pointer whitespace-nowrap"
              style={{ borderRadius: '4px' }}
            >
              <Undo2 className="h-3.5 w-3.5 shrink-0" />
              <span>Undo Replan</span>
            </button>
          )}
          <button
            type="button"
            onClick={dismissPlanDiff}
            aria-label="Dismiss replan explanation banner"
            className="p-1 text-[#5C4938] hover:text-[#1E1610] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
        {planDiff.slice(0, 4).map((item) => (
          <div
            key={item.taskId}
            className="border border-[#D8C8B0] bg-white px-3 py-1.5"
            style={{ borderRadius: '4px' }}
          >
            <div className="font-bold text-[#1E1610]">
              {item.newState === 'scheduled'
                ? `Active Next: ${item.title}`
                : item.newState === 'completed'
                ? `Preserved Monument: ${item.title}`
                : `Deferred: ${item.title}`}
            </div>
            <div className="text-[#4A3B2F]">{item.explanation}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
