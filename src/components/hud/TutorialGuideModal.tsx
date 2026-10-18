'use client';

import React, { useState } from 'react';
import {
  BookOpen,
  Hammer,
  Trees,
  Compass,
  Sparkles,
  CheckCircle2,
  X,
  ArrowRight
} from 'lucide-react';
import { useFocusStore } from '../../store/useFocusStore';
import { BUILDING_ARCHETYPES } from '../../types/focus';
import { voiceoverEngine } from '../../core/audio/voiceoverEngine';

export function TutorialGuideModal() {
  const state = useFocusStore();
  const [activeTab, setActiveTab] = useState<0 | 1 | 2 | 3>(0);

  if (!state.isTutorialOpen) return null;

  const archetypes = Object.values(BUILDING_ARCHETYPES);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tutorial-modal-title"
    >
      <div className="relative w-full max-w-3xl rounded-xl border-4 border-[#7c4a21] bg-[#fdf6e7] text-[#2b180a] shadow-[0_25px_70px_rgba(0,0,0,0.8)] overflow-hidden">
        {/* Header */}
        <div
          className="px-6 py-4 text-white flex items-center justify-between border-b-2 border-[#5c3616]"
          style={{
            background:
              'linear-gradient(135deg, #3b1f0b 0%, #5c3415 55%, #7c481e 100%)'
          }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#fbbf24]/20 border border-[#fbbf24] flex items-center justify-center text-[#fde68a]">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-widest text-[#fcd34d]">
                Interactive Village Handbook & Survival Guide
              </div>
              <h2
                id="tutorial-modal-title"
                className="text-lg sm:text-xl font-extrabold text-[#fffbeb]"
              >
                How Your Real-Life Goals Build & Expand {state.townName}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              voiceoverEngine.playWoodClick();
              state.closeTutorial();
            }}
            className="p-1.5 rounded-lg text-[#fde68a] hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Close tutorial"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Navigation Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 bg-[#efe0c4] border-b-2 border-[#c9a675]">
          {[
            { idx: 0 as const, label: '1. Survival Guilds', icon: Hammer },
            { idx: 1 as const, label: '2. Tree Clearing & Land', icon: Trees },
            { idx: 2 as const, label: '3. Map Icons & HUD', icon: Compass },
            { idx: 3 as const, label: '4. Changing Plans', icon: Sparkles }
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.idx;
            return (
              <button
                key={tab.idx}
                type="button"
                onClick={() => {
                  voiceoverEngine.playWoodClick();
                  setActiveTab(tab.idx);
                }}
                className={`px-3 py-3 text-xs font-extrabold flex items-center justify-center gap-1.5 border-b-4 transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#fdf6e7] border-[#b45309] text-[#92400e]'
                    : 'border-transparent text-[#5c3a21] hover:bg-[#f7ecd8]'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="p-6 max-h-[68vh] overflow-y-auto space-y-4">
          {activeTab === 0 && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-[#f5e7cc] border border-[#c9a675]">
                <h3 className="text-sm font-extrabold text-[#4a2810] mb-1">
                  Every Real-Life Goal Becomes a Functional Survival Building
                </h3>
                <p className="text-xs text-[#3d2512] leading-relaxed">
                  Just like classic strategy games (<em>Age of Empires</em> &{' '}
                  <em>Stronghold</em>), your settlement starts at{' '}
                  <strong>Level 1 (Pioneer Camp)</strong> beside the mountain stream.
                  When you enter your daily goals in the Hearth Cabin, the AI assigns
                  each goal to a specific <strong>Survival Guild</strong>:
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {archetypes.map((arch) => (
                  <div
                    key={arch.category}
                    className="p-3 rounded-lg bg-white border-2 border-[#d8bc90] shadow-sm space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-[#2b180a]">
                        {arch.guildName}
                      </span>
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded text-white"
                        style={{ backgroundColor: arch.accentHex }}
                      >
                        {arch.survivalEffect.split('·')[0]}
                      </span>
                    </div>
                    <div className="text-[11px] font-bold text-[#8c4f20]">
                      Builder: {arch.specialistName} ({arch.specialistTitle})
                    </div>
                    <p className="text-[11px] text-[#4a321d] leading-snug">
                      {arch.survivalDetailedBenefit}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 1 && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-[#ecfdf5] border-2 border-[#16a34a]/40 space-y-2">
                <h3 className="text-sm font-extrabold text-[#14532d] flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-[#15803d]" />
                  Completing 1 Goal Finishes ONLY That 1 Building + Expands Land
                </h3>
                <p className="text-xs text-[#166534] leading-relaxed">
                  When you click <strong>“Complete & Raise Building”</strong> on a
                  goal, <strong>only that specific building plot</strong> transitions
                  from wooden construction scaffolding into a finished, smoking
                  riverside building. Other buildings never jump or reshuffle!
                </p>
              </div>

              <div className="p-4 rounded-lg bg-[#eff6ff] border-2 border-[#3b82f6]/40 space-y-2">
                <h3 className="text-sm font-extrabold text-[#1e3a8a] flex items-center gap-2">
                  <Trees className="w-5 h-5 text-[#15803d]" />
                  How Carpenters Chop Down Trees to Expand Village Land
                </h3>
                <p className="text-xs text-[#1e40af] leading-relaxed">
                  As your village grows up to 12 buildings and more workers arrive,
                  your valley needs more buildable land. Every time you complete a
                  single goal:
                </p>
                <ul className="list-disc list-inside text-xs text-[#1e3a8a] space-y-1 font-medium">
                  <li>
                    <strong>Master Carpenter Alden’s lumberjacks</strong> walk to the
                    frontier pine trees at the edge of the clearing and chop them down
                    with axes.
                  </li>
                  <li>
                    You see the <strong>frontier pine trees tilt and fall</strong> in
                    3D, turning into stacked timber logs (+40 Seasoned Timber).
                  </li>
                  <li>
                    Your village’s <strong>Cleared Land Radius expands</strong> (from
                    20m → 24m → 28m → 32m+), unlocking outer meadow plots for new
                    buildings!
                  </li>
                </ul>
              </div>
            </div>
          )}

          {activeTab === 2 && (
            <div className="space-y-3">
              <h3 className="text-sm font-extrabold text-[#4a2810]">
                What Every Map Badge & Top-Bar Button Means
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-white border border-[#d8bc90]">
                  <div className="font-extrabold text-[#b45309]">
                    🔨 [Builder Name] Building Now
                  </div>
                  <p className="text-[#4a321d] mt-1">
                    Your current <strong>Next Step</strong> goal. Surrounded by wooden
                    scaffolding with a specialist actively hammering.
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-white border border-[#d8bc90]">
                  <div className="font-extrabold text-[#6b513a]">
                    📐 Staked Plot · Queued
                  </div>
                  <p className="text-[#4a321d] mt-1">
                    A planned goal waiting for its turn today. Marked by wooden stakes
                    and lumber piles on the ground.
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-white border border-[#d8bc90]">
                  <div className="font-extrabold text-[#15803d]">
                    ✓ Producing · Completed Building
                  </div>
                  <p className="text-[#4a321d] mt-1">
                    A goal you finished! The full 3D guild building stands proudly with
                    chimney smoke and active production.
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-white border border-[#d8bc90]">
                  <div className="font-extrabold text-[#8c4f20]">
                    Top Bar Controls Explained
                  </div>
                  <p className="text-[#4a321d] mt-1">
                    <strong>Edit Daily Goals</strong>: Add or update daily goals in the Hearth Council.
                    <br />
                    <strong>Review Interruption / Resume Goal</strong>: Adapt your schedule or restore paused goals.
                    <br />
                    <strong>Isometric View</strong>: Toggle classic 45° RTS overhead camera.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 3 && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-[#fffbeb] border-2 border-[#f59e0b]/50 space-y-2">
                <h3 className="text-sm font-extrabold text-[#92400e] flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-[#d97706]" />
                  What Happens When an Interruption Occurs
                </h3>
                <p className="text-xs text-[#451a03] leading-relaxed">
                  Life is unpredictable. If an unexpected meeting or low energy
                  interrupts your day, click{' '}
                  <strong>“Review Interruption”</strong> in the top bar (or{' '}
                  <strong>“Resume Goal”</strong> to restore paused goals):
                </p>
                <ul className="list-disc list-inside text-xs text-[#451a03] space-y-1.5 font-medium">
                  <li>
                    <strong>3.8-Second Transformation Rings</strong>: Golden and cyan
                    helical rings appear <em>only around the buildings affected by
                    your plan change</em> for 3.8 seconds and then vanish.
                  </li>
                  <li>
                    <strong>Old Unbuilt Plans Dissolve Peacefully</strong>: Tasks that
                    no longer fit today’s remaining time transform into covered
                    blueprint caches so your town reshapes around what is realistic
                    right now—with zero guilt or penalty.
                  </li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-[#f3e5c8] border-t-2 border-[#c29b68] flex items-center justify-between">
          <div className="text-xs font-bold text-[#6b4423]">
            Tip: Click any 3D building or signboard in the valley to inspect its
            survival role.
          </div>
          <div className="flex items-center gap-2">
            {activeTab < 3 ? (
              <button
                type="button"
                onClick={() => {
                  voiceoverEngine.playWoodClick();
                  setActiveTab((prev) => (prev + 1) as 0 | 1 | 2 | 3);
                }}
                className="px-4 py-2 rounded-lg text-xs font-extrabold bg-[#b45309] hover:bg-[#92400e] text-white flex items-center gap-1.5 cursor-pointer"
              >
                Next Tip
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  voiceoverEngine.playWoodClick();
                  state.closeTutorial();
                }}
                className="px-5 py-2 rounded-lg text-xs font-extrabold bg-[#15803d] hover:bg-[#166534] text-white flex items-center gap-1.5 cursor-pointer"
              >
                Got It — Return to Village
                <CheckCircle2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
