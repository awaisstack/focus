'use client';

import React, { useEffect, useState } from 'react';
import { X, Play, Sparkles, CheckCircle2 } from 'lucide-react';
import { useFocusStore } from '../../store/useFocusStore';
import { voiceoverEngine } from '../../core/audio/voiceoverEngine';

interface ModelCatalogItem {
  id: string;
  provider: string;
  role: string;
  supportsStructuredJson: boolean;
  status: string;
}

export function ExperienceLabDrawer() {
  const {
    isExperienceLabOpen,
    worldSeed,
    availableMinutes,
    schedule,
    telemetryLog,
    toggleExperienceLab,
    loadJudgeScenario
  } = useFocusStore();

  const [catalog, setCatalog] = useState<ModelCatalogItem[]>([]);

  useEffect(() => {
    if (!isExperienceLabOpen) return;
    fetch('/api/ai/models')
      .then((r) => r.json())
      .then((data: { catalog?: ModelCatalogItem[] }) => {
        if (Array.isArray(data.catalog)) {
          setCatalog(data.catalog);
        }
      })
      .catch(() => {
        // Ignore offline error
      });
  }, [isExperienceLabOpen]);

  if (!isExperienceLabOpen) return null;

  const totalCostUsd = telemetryLog.reduce(
    (acc, item) => acc + item.estimatedCostUsd,
    0
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="experience-lab-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
    >
      <div
        className="max-h-[88vh] w-full max-w-3xl overflow-y-auto border-4 border-[#4A2E1B] bg-[#FBF6EB] p-6 text-[#1E1610] shadow-2xl"
        style={{ borderRadius: '6px' }}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#D8C8B0] pb-4">
          <div>
            <div className="text-xs font-bold text-[#C85232]">
              AMD Developer Hackathon: ACT III · Create a New Kind of Experience
            </div>
            <h2
              id="experience-lab-title"
              className="mt-0.5 font-display text-2xl font-bold text-[#1E1610]"
            >
              Experience Lab &amp; Architecture Inspector
            </h2>
            <p className="mt-1 text-xs md:text-sm text-[#4A3B2F]">
              Compare the two required adaptive scenarios, inspect AMD Token
              Factory &amp; Gemini Neural TTS routing, and verify deterministic
              PCG + DAG scheduling guarantees.
            </p>
          </div>
          <button
            type="button"
            onClick={toggleExperienceLab}
            aria-label="Close Experience Lab"
            className="border-2 border-[#8C6D53] bg-[#EFE3CE] p-1.5 text-[#2D221A] hover:border-[#4A2E1B] cursor-pointer"
            style={{ borderRadius: '4px' }}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Two-Scenario Hackathon Proof Switcher */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div
            className="border border-[#8C6D53] bg-white p-4"
            style={{ borderRadius: '4px' }}
          >
            <div className="text-xs font-bold text-[#7C2D12]">
              Scenario A · Full Study &amp; Creation Day (180m)
            </div>
            <p className="mt-1 text-xs text-[#4A3B2F]">
              4 goals scheduled across the village: Scholar Tower, Guild
              Workshop, Meadow Pavilion, and Market Hearth.
            </p>
            <button
              type="button"
              onClick={() => {
                voiceoverEngine.unlockOnUserGesture();
                loadJudgeScenario('SCENARIO_A_FULL_DAY');
                toggleExperienceLab();
              }}
              className="mt-3 inline-flex items-center gap-1.5 border border-[#4A2E1B] bg-[#C85232] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#B04325] cursor-pointer whitespace-nowrap"
              style={{ borderRadius: '4px' }}
            >
              <Play className="h-3.5 w-3.5 shrink-0" />
              <span>Run Scenario A (180m Day)</span>
            </button>
          </div>

          <div
            className="border border-[#8C6D53] bg-white p-4"
            style={{ borderRadius: '4px' }}
          >
            <div className="text-xs font-bold text-[#7C2D12]">
              Scenario B · Interrupted Day Replan (45m Remaining)
            </div>
            <p className="mt-1 text-xs text-[#4A3B2F]">
              Preserves completed monument, highlights the single best 40m task,
              defers excess tasks with explanation, and triggers Hogwarts magic.
            </p>
            <button
              type="button"
              onClick={() => {
                voiceoverEngine.unlockOnUserGesture();
                loadJudgeScenario('SCENARIO_B_INTERRUPTED_45M');
                toggleExperienceLab();
              }}
              className="mt-3 inline-flex items-center gap-1.5 border border-[#4A2E1B] bg-[#1E1610] px-3 py-1.5 text-xs font-bold text-amber-300 hover:bg-[#2E2218] cursor-pointer whitespace-nowrap"
              style={{ borderRadius: '4px' }}
            >
              <Sparkles className="h-3.5 w-3.5 shrink-0" />
              <span>Run Scenario B (45m Replan)</span>
            </button>
          </div>
        </div>

        {/* Deterministic Engine & Cost Summary */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono text-xs">
          <div className="border border-[#D8C8B0] bg-[#F3E9D6] p-3">
            <div className="text-[#5C4938]">World Seed</div>
            <div className="mt-0.5 text-sm font-bold text-[#1E1610]">
              #{worldSeed}
            </div>
          </div>
          <div className="border border-[#D8C8B0] bg-[#F3E9D6] p-3">
            <div className="text-[#5C4938]">Scheduled / Window</div>
            <div className="mt-0.5 text-sm font-bold text-[#1E1610]">
              {schedule.totalScheduledMinutes}m / {availableMinutes}m
            </div>
          </div>
          <div className="border border-[#D8C8B0] bg-[#F3E9D6] p-3">
            <div className="text-[#5C4938]">DAG &amp; BFS Graph</div>
            <div className="mt-0.5 flex items-center gap-1 text-sm font-bold text-emerald-800">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>Connected</span>
            </div>
          </div>
          <div className="border border-[#D8C8B0] bg-[#F3E9D6] p-3">
            <div className="text-[#5C4938]">Session AI Cost</div>
            <div className="mt-0.5 text-sm font-bold text-[#1E1610]">
              ${totalCostUsd.toFixed(5)}
            </div>
          </div>
        </div>

        {/* Runtime Model Catalog */}
        {catalog.length > 0 && (
          <div className="mt-4">
            <h3 className="text-xs font-bold text-[#4A3B2F] mb-2">
              Discovered Runtime Model Router Catalog
            </h3>
            <div className="space-y-1.5 text-xs">
              {catalog.map((m) => (
                <div
                  key={m.id}
                  className="flex flex-wrap items-center justify-between gap-2 border border-[#D8C8B0] bg-white px-3 py-2"
                  style={{ borderRadius: '4px' }}
                >
                  <div>
                    <span className="font-mono font-bold text-[#1E1610]">
                      {m.id}
                    </span>{' '}
                    <span className="text-[#5C4938]">· {m.provider}</span>
                    <div className="text-[#4A3B2F]">{m.role}</div>
                  </div>
                  <span className="font-mono text-[11px] font-semibold text-[#7C2D12]">
                    {m.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
