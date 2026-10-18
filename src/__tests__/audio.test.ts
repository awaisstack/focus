import { describe, expect, it } from 'vitest';
import {
  clampVolume,
  SOUNDSCAPE_CONFIGS,
  soundscapeEngine,
  worldXToStereoPan
} from '@/core/audio/soundscapeEngine';

describe('Phase 6 — Web Audio Procedural Soundscape Engine & Spatial Helpers', () => {
  it('defines distinct acoustic parameters for all 4 soundscape presets', () => {
    expect(Object.keys(SOUNDSCAPE_CONFIGS)).toEqual([
      'MORNING_BREEZE',
      'AMBER_STILLNESS',
      'JADE_RAIN_STREAM',
      'TWILIGHT_CRICKETS'
    ]);

    expect(SOUNDSCAPE_CONFIGS.JADE_RAIN_STREAM.brookGain).toBeGreaterThan(
      SOUNDSCAPE_CONFIGS.MORNING_BREEZE.brookGain
    );
  });

  it('maps 3D world X coordinates to safe bounded stereo pan values (-0.55..+0.55)', () => {
    expect(worldXToStereoPan(0)).toBe(0);
    expect(worldXToStereoPan(-6)).toBe(-0.5);
    expect(worldXToStereoPan(6)).toBe(0.5);
    // Extreme coordinates clamp safely so audio never hard-pans to 100%
    expect(worldXToStereoPan(-25)).toBe(-0.55);
    expect(worldXToStereoPan(25)).toBe(0.55);
  });

  it('clamps volume sliders safely to [0, 1] and degrades gracefully without window.AudioContext', () => {
    expect(clampVolume(-0.4)).toBe(0);
    expect(clampVolume(1.8)).toBe(1);
    expect(clampVolume(0.65)).toBe(0.65);

    // In Node test environment without Web Audio API, calls must never throw
    const started = soundscapeEngine.unlockAndStart({
      muted: false,
      ambientVolume: 0.6,
      effectsVolume: 0.8,
      preset: 'JADE_RAIN_STREAM'
    });
    expect(started).toBe(false);

    soundscapeEngine.playSelectCue(-4.5);
    soundscapeEngine.playCompletionBloomCue(3.2);
    soundscapeEngine.playReplanTransitionCue('MISTY_ZEN_STREAM');
    soundscapeEngine.playUndoCue();

    const state = soundscapeEngine.getState();
    expect(state.ambientVolume).toBe(0.6);
    expect(state.effectsVolume).toBe(0.8);
    expect(state.activePreset).toBe('MISTY_ZEN_STREAM');
  });
});
