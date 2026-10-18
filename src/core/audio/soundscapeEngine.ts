import type { SoundscapePresetId } from '@/types/world';

export interface SoundscapePresetConfig {
  id: SoundscapePresetId;
  label: string;
  windCenterFreqHz: number;
  windQ: number;
  windGain: number;
  brookCenterFreqHz: number;
  brookGain: number;
  lfoRateHz: number;
  chimeScaleHz: number[];
}

export const SOUNDSCAPE_CONFIGS: Record<
  SoundscapePresetId,
  SoundscapePresetConfig
> = {
  MORNING_BREEZE: {
    id: 'MORNING_BREEZE',
    label: 'Morning Pine Breeze & Brook',
    windCenterFreqHz: 420,
    windQ: 2.2,
    windGain: 0.16,
    brookCenterFreqHz: 980,
    brookGain: 0.08,
    lfoRateHz: 0.14,
    // C Major Pentatonic (C5, D5, E5, G5, A5)
    chimeScaleHz: [523.25, 587.33, 659.25, 783.99, 880.0]
  },
  AMBER_STILLNESS: {
    id: 'AMBER_STILLNESS',
    label: 'Warm Meadow Stillness',
    windCenterFreqHz: 340,
    windQ: 2.8,
    windGain: 0.14,
    brookCenterFreqHz: 820,
    brookGain: 0.05,
    lfoRateHz: 0.1,
    // F Lydian/Major Pentatonic warm voicings
    chimeScaleHz: [440.0, 523.25, 587.33, 698.46, 880.0]
  },
  JADE_RAIN_STREAM: {
    id: 'JADE_RAIN_STREAM',
    label: 'Grounded Jade Stream & Mist',
    windCenterFreqHz: 540,
    windQ: 1.6,
    windGain: 0.18,
    brookCenterFreqHz: 1180,
    brookGain: 0.15,
    lfoRateHz: 0.18,
    // Calm D Dorian / Minor Pentatonic grounding tones
    chimeScaleHz: [392.0, 440.0, 523.25, 587.33, 659.25]
  },
  TWILIGHT_CRICKETS: {
    id: 'TWILIGHT_CRICKETS',
    label: 'Twilight Grove & Distant Water',
    windCenterFreqHz: 290,
    windQ: 3.4,
    windGain: 0.13,
    brookCenterFreqHz: 760,
    brookGain: 0.07,
    lfoRateHz: 0.09,
    // Gentle A Minor Pentatonic dusk harmonics
    chimeScaleHz: [440.0, 523.25, 659.25, 783.99, 987.77]
  }
};

/**
 * Maps a 3D world X coordinate (-12..+12) to a subtle stereo pan value (-0.55..+0.55)
 * so spatial cues feel grounded without ever hard-panning to one ear.
 */
export function worldXToStereoPan(worldX: number): number {
  if (!Number.isFinite(worldX)) return 0;
  const normalized = worldX / 12;
  return Number(Math.max(-0.55, Math.min(0.55, normalized)).toFixed(2));
}

export function clampVolume(val: number): number {
  if (!Number.isFinite(val)) return 0.5;
  return Number(Math.max(0, Math.min(1, val)).toFixed(2));
}

/**
 * Pure Web Audio API Procedural Soundscape & Micro-Interaction Synthesizer.
 * - Starts ONLY after a deliberate user gesture (respects browser autoplay policy).
 * - Requires zero external MP3 downloads and fails gracefully if Web Audio is unavailable.
 */
class SanctuarySoundscapeEngine {
  private ctx: AudioContext | null = null;
  private masterAmbientGain: GainNode | null = null;
  private masterEffectsGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private windGainNode: GainNode | null = null;
  private brookFilter: BiquadFilterNode | null = null;
  private brookGainNode: GainNode | null = null;
  private lfoOsc: OscillatorNode | null = null;
  private natureAccentTimer: ReturnType<typeof setTimeout> | null = null;

  private isInitialized = false;
  private isMuted = false;
  private ambientVolume = 0.55;
  private effectsVolume = 0.7;
  private activePreset: SoundscapePresetId | string = 'MORNING_BREEZE';

  public getState() {
    return {
      isInitialized: this.isInitialized,
      isMuted: this.isMuted,
      ambientVolume: this.ambientVolume,
      effectsVolume: this.effectsVolume,
      activePreset: this.activePreset
    };
  }

  private getAudioContextConstructor(): typeof AudioContext | null {
    if (typeof window === 'undefined') return null;
    const win = window as unknown as {
      AudioContext?: typeof AudioContext;
      webkitAudioContext?: typeof AudioContext;
    };
    return win.AudioContext || win.webkitAudioContext || null;
  }

  /**
   * Initializes the Web Audio graph inside a deliberate user gesture handler.
   */
  public unlockAndStart(options?: {
    muted?: boolean;
    ambientVolume?: number;
    effectsVolume?: number;
    preset?: SoundscapePresetId;
  }): boolean {
    if (options?.muted !== undefined) this.isMuted = options.muted;
    if (options?.ambientVolume !== undefined) {
      this.ambientVolume = clampVolume(options.ambientVolume);
    }
    if (options?.effectsVolume !== undefined) {
      this.effectsVolume = clampVolume(options.effectsVolume);
    }
    if (options?.preset) {
      this.activePreset = options.preset;
    }

    const AudioCtx = this.getAudioContextConstructor();
    if (!AudioCtx) return false;

    try {
      if (!this.ctx) {
        this.ctx = new AudioCtx();
      }
      if (this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }

      if (!this.isInitialized) {
        this.setupAmbientGraph();
        this.isInitialized = true;
      }

      this.syncGainLevels();
      this.scheduleNextNatureAccent();
      return true;
    } catch {
      return false;
    }
  }

  private setupAmbientGraph(): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const config =
      (SOUNDSCAPE_CONFIGS as Record<string, SoundscapePresetConfig>)[this.activePreset] ??
      SOUNDSCAPE_CONFIGS.MORNING_BREEZE;

    this.masterAmbientGain = ctx.createGain();
    this.masterEffectsGain = ctx.createGain();
    this.masterAmbientGain.connect(ctx.destination);
    this.masterEffectsGain.connect(ctx.destination);

    // Create a 4-second looping pink-like noise buffer for organic wind & brook water
    const sampleRate = ctx.sampleRate;
    const bufferLength = sampleRate * 4;
    const noiseBuffer = ctx.createBuffer(1, bufferLength, sampleRate);
    const output = noiseBuffer.getChannelData(0);

    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    let b3 = 0;
    let b4 = 0;
    let b5 = 0;
    let b6 = 0;

    for (let i = 0; i < bufferLength; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.04;
      b6 = white * 0.115926;
    }

    // 1. Wind / Foliage Rustle Layer
    const windSource = ctx.createBufferSource();
    windSource.buffer = noiseBuffer;
    windSource.loop = true;

    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = 'bandpass';
    this.windFilter.frequency.value = config.windCenterFreqHz;
    this.windFilter.Q.value = config.windQ;

    this.windGainNode = ctx.createGain();
    this.windGainNode.gain.value = config.windGain;

    // Slow LFO modulating wind filter frequency for natural breathing motion
    this.lfoOsc = ctx.createOscillator();
    this.lfoOsc.type = 'sine';
    this.lfoOsc.frequency.value = config.lfoRateHz;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 95;
    this.lfoOsc.connect(lfoGain);
    lfoGain.connect(this.windFilter.frequency);

    windSource.connect(this.windFilter);
    this.windFilter.connect(this.windGainNode);
    this.windGainNode.connect(this.masterAmbientGain);

    // 2. Brook / Water Ripple Layer
    const brookSource = ctx.createBufferSource();
    brookSource.buffer = noiseBuffer;
    brookSource.loop = true;

    this.brookFilter = ctx.createBiquadFilter();
    this.brookFilter.type = 'bandpass';
    this.brookFilter.frequency.value = config.brookCenterFreqHz;
    this.brookFilter.Q.value = 3.2;

    this.brookGainNode = ctx.createGain();
    this.brookGainNode.gain.value = config.brookGain;

    brookSource.connect(this.brookFilter);
    this.brookFilter.connect(this.brookGainNode);
    this.brookGainNode.connect(this.masterAmbientGain);

    windSource.start(0);
    brookSource.start(1.3);
    this.lfoOsc.start(0);
  }

  private syncGainLevels(): void {
    if (!this.ctx || !this.masterAmbientGain || !this.masterEffectsGain) return;
    const now = this.ctx.currentTime;

    const targetAmbient = this.isMuted ? 0 : this.ambientVolume * 0.45;
    const targetEffects = this.isMuted ? 0 : this.effectsVolume * 0.55;

    this.masterAmbientGain.gain.setTargetAtTime(targetAmbient, now, 0.18);
    this.masterEffectsGain.gain.setTargetAtTime(targetEffects, now, 0.08);
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    this.syncGainLevels();
  }

  public setAmbientVolume(volume: number): void {
    this.ambientVolume = clampVolume(volume);
    this.syncGainLevels();
  }

  public setEffectsVolume(volume: number): void {
    this.effectsVolume = clampVolume(volume);
    this.syncGainLevels();
  }

  /**
   * Smoothly crossfades filter frequencies and ambient layer levels over 1.4 seconds
   * when the biome or context changes (e.g., Scenario A -> Scenario B).
   */
  public transitionToPreset(presetId: SoundscapePresetId | string): void {
    this.activePreset = presetId;
    if (!this.ctx || !this.isInitialized) return;

    const config =
      (SOUNDSCAPE_CONFIGS as Record<string, SoundscapePresetConfig>)[presetId] ??
      SOUNDSCAPE_CONFIGS.MORNING_BREEZE;
    const now = this.ctx.currentTime;

    this.windFilter?.frequency.setTargetAtTime(config.windCenterFreqHz, now, 0.65);
    this.windFilter?.Q.setTargetAtTime(config.windQ, now, 0.65);
    this.windGainNode?.gain.setTargetAtTime(config.windGain, now, 0.65);

    this.brookFilter?.frequency.setTargetAtTime(config.brookCenterFreqHz, now, 0.65);
    this.brookGainNode?.gain.setTargetAtTime(config.brookGain, now, 0.65);
    this.lfoOsc?.frequency.setTargetAtTime(config.lfoRateHz, now, 0.65);
  }

  private scheduleNextNatureAccent(): void {
    if (this.natureAccentTimer) {
      clearTimeout(this.natureAccentTimer);
    }
    const delayMs = 7500 + Math.random() * 6500;
    this.natureAccentTimer = setTimeout(() => {
      if (this.isInitialized && !this.isMuted && this.ambientVolume > 0.05) {
        this.playSoftNatureDroplet();
      }
      this.scheduleNextNatureAccent();
    }, delayMs);
  }

  private playSoftNatureDroplet(): void {
    if (!this.ctx || !this.masterAmbientGain || this.isMuted) return;
    const config =
      (SOUNDSCAPE_CONFIGS as Record<string, SoundscapePresetConfig>)[this.activePreset] ??
      SOUNDSCAPE_CONFIGS.MORNING_BREEZE;
    const scale = config.chimeScaleHz;
    const freq = scale[Math.floor(Math.random() * scale.length)];

    this.triggerTone({
      freqHz: freq,
      type: 'sine',
      durationSec: 1.1,
      peakGain: 0.045,
      pan: (Math.random() - 0.5) * 0.6,
      destination: this.masterAmbientGain
    });
  }

  private triggerTone(params: {
    freqHz: number;
    type?: OscillatorType;
    startTimeOffsetSec?: number;
    durationSec: number;
    peakGain: number;
    pan?: number;
    destination?: AudioNode | null;
  }): void {
    if (!this.ctx || this.isMuted) return;
    const targetNode = params.destination ?? this.masterEffectsGain;
    if (!targetNode) return;

    const now = this.ctx.currentTime + (params.startTimeOffsetSec ?? 0);
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();

    osc.type = params.type ?? 'sine';
    osc.frequency.setValueAtTime(params.freqHz, now);

    env.gain.setValueAtTime(0.0001, now);
    env.gain.linearRampToValueAtTime(params.peakGain, now + 0.025);
    env.gain.exponentialRampToValueAtTime(0.0001, now + params.durationSec);

    if (
      typeof this.ctx.createStereoPanner === 'function' &&
      params.pan !== undefined
    ) {
      const panner = this.ctx.createStereoPanner();
      panner.pan.setValueAtTime(worldXToStereoPan(params.pan * 12), now);
      osc.connect(env);
      env.connect(panner);
      panner.connect(targetNode);
    } else {
      osc.connect(env);
      env.connect(targetNode);
    }

    osc.start(now);
    osc.stop(now + params.durationSec + 0.04);
  }

  /**
   * Subtle wooden marimba tap when selecting a 3D landmark or route card.
   */
  public playSelectCue(worldX = 0): void {
    const pan = worldXToStereoPan(worldX);
    this.triggerTone({
      freqHz: 329.63, // E4
      type: 'triangle',
      durationSec: 0.14,
      peakGain: 0.12,
      pan
    });
  }

  /**
   * Warm ascending interval when confirming a new day plan.
   */
  public playPlanConfirmCue(): void {
    const notes = [261.63, 329.63, 392.0]; // C4 -> E4 -> G4
    notes.forEach((freq, idx) => {
      this.triggerTone({
        freqHz: freq,
        type: 'triangle',
        startTimeOffsetSec: idx * 0.09,
        durationSec: 0.45,
        peakGain: 0.14,
        pan: (idx - 1) * 0.15
      });
    });
  }

  /**
   * Rich major-9th botanical bloom arpeggio paired with landmark completion.
   */
  public playCompletionBloomCue(worldX = 0): void {
    const pan = worldXToStereoPan(worldX);
    // C4 - E4 - G4 - B4 - D5 warm harmonic bloom
    const notes = [261.63, 329.63, 392.0, 493.88, 587.33];
    notes.forEach((freq, idx) => {
      this.triggerTone({
        freqHz: freq,
        type: 'sine',
        startTimeOffsetSec: idx * 0.075,
        durationSec: 0.85,
        peakGain: 0.15,
        pan
      });
    });
  }

  /**
   * Calming, grounded transition cue when replanning after an interruption ("My plans changed").
   * Explicitly peaceful—never an alarm or failure sound.
   */
  public playReplanTransitionCue(newPreset?: SoundscapePresetId | string): void {
    if (newPreset) {
      this.transitionToPreset(newPreset);
    }
    // Gentle Fmaj7 -> Cmaj7 grounding cadence
    const notes = [349.23, 440.0, 392.0, 523.25];
    notes.forEach((freq, idx) => {
      this.triggerTone({
        freqHz: freq,
        type: 'sine',
        startTimeOffsetSec: idx * 0.12,
        durationSec: 0.75,
        peakGain: 0.12,
        pan: 0
      });
    });
  }

  /**
   * Soft descending two-note cue when undoing a task completion or replan.
   */
  public playUndoCue(): void {
    const notes = [392.0, 329.63]; // G4 -> E4
    notes.forEach((freq, idx) => {
      this.triggerTone({
        freqHz: freq,
        type: 'triangle',
        startTimeOffsetSec: idx * 0.08,
        durationSec: 0.28,
        peakGain: 0.11
      });
    });
  }

  /**
   * Realistic tactile woodchop impact with sharp transient 'thwack' and low timber resonance.
   */
  public playWoodChop(worldX = 0): void {
    if (!this.ctx || this.isMuted) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const pan = worldXToStereoPan(worldX);

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.08);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.24, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.12);

    const snapOsc = ctx.createOscillator();
    const snapGain = ctx.createGain();
    snapOsc.type = 'sawtooth';
    snapOsc.frequency.setValueAtTime(540, now);
    snapOsc.frequency.exponentialRampToValueAtTime(180, now + 0.035);
    snapGain.gain.setValueAtTime(0.08, now);
    snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    if (typeof ctx.createStereoPanner === 'function') {
      const panner = ctx.createStereoPanner();
      panner.pan.setValueAtTime(pan, now);
      osc.connect(gain);
      snapOsc.connect(snapGain);
      gain.connect(panner);
      snapGain.connect(panner);
      panner.connect(this.masterEffectsGain || ctx.destination);
    } else {
      osc.connect(gain);
      snapOsc.connect(snapGain);
      gain.connect(this.masterEffectsGain || ctx.destination);
      snapGain.connect(this.masterEffectsGain || ctx.destination);
    }

    osc.start(now);
    osc.stop(now + 0.13);
    snapOsc.start(now);
    snapOsc.stop(now + 0.045);
  }

  /**
   * Crisp rhythmic mallet/hammer tap on timber/stone during plot construction.
   */
  public playHammerTap(worldX = 0): void {
    if (!this.ctx || this.isMuted) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const pan = worldXToStereoPan(worldX);

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(740, now);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.045);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.12, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0005, now + 0.06);

    if (typeof ctx.createStereoPanner === 'function') {
      const panner = ctx.createStereoPanner();
      panner.pan.setValueAtTime(pan, now);
      osc.connect(gain);
      gain.connect(panner);
      panner.connect(this.masterEffectsGain || ctx.destination);
    } else {
      osc.connect(gain);
      gain.connect(this.masterEffectsGain || ctx.destination);
    }

    osc.start(now);
    osc.stop(now + 0.07);
  }

  /**
   * Heavy grounded timber thud and rustle when a frontier tree crashes down.
   */
  public playTreeFellCrackle(worldX = 0): void {
    if (!this.ctx || this.isMuted) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const pan = worldXToStereoPan(worldX);

    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(90, now);
    subOsc.frequency.exponentialRampToValueAtTime(32, now + 0.38);

    subGain.gain.setValueAtTime(0.001, now);
    subGain.gain.linearRampToValueAtTime(0.32, now + 0.03);
    subGain.gain.exponentialRampToValueAtTime(0.0005, now + 0.45);

    if (typeof ctx.createStereoPanner === 'function') {
      const panner = ctx.createStereoPanner();
      panner.pan.setValueAtTime(pan, now);
      subOsc.connect(subGain);
      subGain.connect(panner);
      panner.connect(this.masterEffectsGain || ctx.destination);
    } else {
      subOsc.connect(subGain);
      subGain.connect(this.masterEffectsGain || ctx.destination);
    }

    subOsc.start(now);
    subOsc.stop(now + 0.48);
  }

  /**
   * Cozy organic hearth fireplace ember pop/crackle for the log cabin.
   */
  public playCabinFireCrackle(): void {
    if (!this.ctx || this.isMuted) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    const randFreq = 1200 + Math.random() * 800;
    osc.frequency.setValueAtTime(randFreq, now);
    osc.frequency.exponentialRampToValueAtTime(300, now + 0.02);

    gain.gain.setValueAtTime(0.0005, now);
    gain.gain.linearRampToValueAtTime(0.045, now + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.025);

    osc.connect(gain);
    gain.connect(this.masterAmbientGain || ctx.destination);
    osc.start(now);
    osc.stop(now + 0.03);
  }
}

export const soundscapeEngine = new SanctuarySoundscapeEngine();
