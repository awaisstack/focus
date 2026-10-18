import type { VillagerSpeakerId, VillagerVoiceLine } from '../../types/focus';
import { soundscapeEngine } from './soundscapeEngine';

/**
 * Villager Neural Voiceover & Tactile Web Audio Soundscape Engine
 * - Unlocks Web Audio API synchronously inside user click gestures so browser autoplay never blocks speech.
 * - Connects an AnalyserNode to active neural speech buffers so 3D villagers lip-sync their jaws & mouths in real time!
 * - Synthesizes warm ambient hearth/meadow beds, gate unlatch acoustics, and Hogwarts magical transformation chimes.
 */
class VillagerVoiceoverAndSoundEngine {
  private isMuted = false;
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private analyserData: Uint8Array<ArrayBuffer> | null = null;
  private activeSource: AudioBufferSourceNode | null = null;
  private rawBufferCache = new Map<string, ArrayBuffer>();
  private lastSpokenLine: VillagerVoiceLine | null = null;
  private isCurrentlySpeaking = false;
  private syntheticSpeechStartTime = 0;
  private syntheticSpeechDurationMs = 0;
  private onSubtitleCallback: ((line: VillagerVoiceLine | null) => void) | null = null;
  private subtitleTimer: ReturnType<typeof setTimeout> | null = null;
  private ambientInterval: ReturnType<typeof setInterval> | null = null;

  private getOrCreateAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioCtx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (AudioCtx) {
        this.audioCtx = new AudioCtx();
        this.analyser = this.audioCtx.createAnalyser();
        this.analyser.fftSize = 128;
        this.analyser.smoothingTimeConstant = 0.65;
        this.analyserData = new Uint8Array(new ArrayBuffer(this.analyser.frequencyBinCount));
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      void this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  /**
   * Call directly inside any button onClick handler to permanently unlock
   * Web Audio playback for the entire session (survives setTimeout & async fetches).
   */
  public unlockOnUserGesture(): void {
    const ctx = this.getOrCreateAudioContext();
    if (!ctx) return;
    try {
      const silentBuffer = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = silentBuffer;
      src.connect(ctx.destination);
      src.start(0);
      this.startAmbientSoundscape();
    } catch {
      // Ignore if already running
    }
  }

  /**
   * Returns a normalized 0..1 lip-sync mouth aperture value for 3D character jaw animation!
   */
  public getLipSyncAmplitude(): number {
    if (!this.isCurrentlySpeaking) return 0;

    if (this.analyser && this.analyserData && this.activeSource) {
      this.analyser.getByteFrequencyData(this.analyserData);
      let sum = 0;
      const bins = Math.min(24, this.analyserData.length);
      for (let i = 2; i < bins; i++) {
        sum += this.analyserData[i];
      }
      const avg = sum / ((bins - 2) * 255);
      if (avg > 0.02) {
        return Math.min(1, avg * 2.8);
      }
    }

    // Natural syllable cadence envelope when playing melodic/fallback speech or during network stream warm-up
    const elapsed = performance.now() - this.syntheticSpeechStartTime;
    if (elapsed < this.syntheticSpeechDurationMs) {
      const syllableWave =
        Math.abs(Math.sin(elapsed * 0.021)) * 0.65 +
        Math.abs(Math.cos(elapsed * 0.034)) * 0.35;
      return Math.min(1, syllableWave);
    }

    return 0;
  }

  public getActiveSpeakerId(): VillagerSpeakerId | null {
    return this.isCurrentlySpeaking && this.lastSpokenLine
      ? this.lastSpokenLine.speakerId
      : null;
  }

  public async preload(
    line: Pick<VillagerVoiceLine, 'speakerId' | 'text'>
  ): Promise<void> {
    if (typeof window === 'undefined') return;
    const cacheKey = `${line.speakerId}::${line.text}`;
    if (this.rawBufferCache.has(cacheKey)) return;

    try {
      const res = await fetch('/api/ai/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: line.text,
          speakerId: line.speakerId
        })
      });
      if (res.ok) {
        const arrBuf = await res.arrayBuffer();
        if (arrBuf.byteLength > 200) {
          this.rawBufferCache.set(cacheKey, arrBuf);
        }
      }
    } catch {
      // Ignore preload network error
    }
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    soundscapeEngine.setMuted(muted);
    if (muted) {
      this.stopCurrentAudio();
    }
  }

  public isAudioMuted(): boolean {
    return this.isMuted;
  }

  private stopCurrentAudio(): void {
    this.isCurrentlySpeaking = false;
    if (this.activeSource) {
      try {
        this.activeSource.stop();
        this.activeSource.disconnect();
      } catch {
        // Ignore
      }
      this.activeSource = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Ignore
      }
    }
  }

  public onSubtitleChange(
    cb: (line: VillagerVoiceLine | null) => void
  ): () => void {
    this.onSubtitleCallback = cb;
    return () => {
      if (this.onSubtitleCallback === cb) {
        this.onSubtitleCallback = null;
      }
    };
  }

  public subscribeVoiceLine(
    cb: (line: VillagerVoiceLine | null) => void
  ): () => void {
    return this.onSubtitleChange(cb);
  }

  public unlockFromUserGesture(): void {
    this.unlockOnUserGesture();
  }

  public getVoiceAmplitude(): number {
    return this.getLipSyncAmplitude();
  }

  public speakLine(line: VillagerVoiceLine): void {
    void this.speak(line);
  }

  public playWoodClick(): void {
    const ctx = this.getOrCreateAudioContext();
    if (!ctx || this.isMuted) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(195, now);
      osc.frequency.exponentialRampToValueAtTime(75, now + 0.045);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.055);
    } catch {
      // Ignore audio state errors
    }
  }

  public getLastSpokenLine(): VillagerVoiceLine | null {
    return this.lastSpokenLine;
  }

  public async replayLastLine(): Promise<void> {
    if (this.lastSpokenLine) {
      this.unlockOnUserGesture();
      await this.speak(this.lastSpokenLine);
    }
  }

  /**
   * Starts organic pine wind rustling and mountain river soundscape via procedural soundscape engine.
   */
  public startAmbientSoundscape(): void {
    if (typeof window === 'undefined') return;
    soundscapeEngine.unlockAndStart({ muted: this.isMuted });
  }

  /**
   * Plays a rich Hogwarts-style telekinetic transformation shimmer chord + timber assembly thud.
   */
  public playMagicalTransformSpell(): void {
    const ctx = this.getOrCreateAudioContext();
    if (!ctx || this.isMuted) return;

    const chord = [261.63, 329.63, 392.0, 523.25, 659.25, 783.99, 1046.5];
    chord.forEach((freq, idx) => {
      const now = ctx.currentTime + idx * 0.065;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = idx % 2 === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.02, now + 0.55);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.045, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.65);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.7);
    });
  }

  /**
   * Plays a warm celebratory monument completion chime.
   */
  public playCompletionChime(): void {
    const ctx = this.getOrCreateAudioContext();
    if (!ctx || this.isMuted) return;

    const notes = [392.0, 493.88, 587.33, 783.99];
    notes.forEach((freq, i) => {
      const now = ctx.currentTime + i * 0.09;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.07, now + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.48);
    });
  }

  private playWarmStorybookCadence(speakerId: VillagerSpeakerId): void {
    const ctx = this.getOrCreateAudioContext();
    if (!ctx || this.isMuted) return;

    const baseFreqs =
      speakerId === 'ROWAN_ELDER'
        ? [196.0, 246.94, 293.66, 246.94, 329.63]
        : speakerId === 'MAYA_BUILDER'
        ? [329.63, 392.0, 440.0, 523.25, 440.0]
        : [293.66, 369.99, 440.0, 392.0, 493.88];

    baseFreqs.forEach((freq, idx) => {
      const now = ctx.currentTime + idx * 0.085;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.055, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.24);
    });
  }

  private speakViaBrowserSpeechSynthesis(line: VillagerVoiceLine): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      this.playWarmStorybookCadence(line.speakerId);
      return;
    }

    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(line.text);
      utterance.rate = line.speakerId === 'ROWAN_ELDER' ? 0.95 : 1.02;
      utterance.pitch = line.speakerId === 'ROWAN_ELDER' ? 0.88 : 1.08;

      const voices = window.speechSynthesis.getVoices();
      if (voices && voices.length > 0) {
        const isMale = line.speakerId === 'ROWAN_ELDER';
        const matched =
          voices.find((v) => {
            const n = v.name.toLowerCase();
            const langMatch = v.lang.startsWith('en');
            if (!langMatch) return false;
            if (isMale) {
              return (
                n.includes('male') ||
                n.includes('david') ||
                n.includes('andrew') ||
                n.includes('guy') ||
                n.includes('george')
              );
            }
            return (
              n.includes('natural') ||
              n.includes('online') ||
              n.includes('female') ||
              n.includes('ava') ||
              n.includes('jenny') ||
              n.includes('samantha') ||
              n.includes('zira')
            );
          }) ??
          voices.find((v) => v.lang.startsWith('en')) ??
          voices[0];

        if (matched) {
          utterance.voice = matched;
        }
      }

      utterance.onstart = () => {
        this.isCurrentlySpeaking = true;
        this.syntheticSpeechStartTime = performance.now();
        this.syntheticSpeechDurationMs = Math.max(3000, line.text.length * 68);
        if (this.onSubtitleCallback) {
          this.onSubtitleCallback({
            ...line,
            isSpeaking: true,
            sourceTier: 'BROWSER_SPEECH_SYNTHESIS'
          });
        }
      };

      utterance.onend = () => {
        this.isCurrentlySpeaking = false;
        if (this.onSubtitleCallback) {
          this.onSubtitleCallback(null);
        }
      };

      utterance.onerror = () => {
        this.isCurrentlySpeaking = false;
        if (this.onSubtitleCallback) {
          this.onSubtitleCallback(null);
        }
      };

      window.speechSynthesis.speak(utterance);
    } catch {
      this.playWarmStorybookCadence(line.speakerId);
    }
  }

  public async speak(line: VillagerVoiceLine): Promise<void> {
    this.lastSpokenLine = line;

    if (this.subtitleTimer) {
      clearTimeout(this.subtitleTimer);
    }

    this.stopCurrentAudio();

    const estDurationMs = Math.max(3200, Math.min(9500, line.text.length * 62));
    this.isCurrentlySpeaking = true;
    this.syntheticSpeechStartTime = performance.now();
    this.syntheticSpeechDurationMs = estDurationMs;

    if (this.onSubtitleCallback) {
      this.onSubtitleCallback({
        ...line,
        isSpeaking: true,
        sourceTier: line.sourceTier ?? 'GEMINI_NEURAL_TTS'
      });
    }

    this.subtitleTimer = setTimeout(() => {
      this.isCurrentlySpeaking = false;
      if (this.onSubtitleCallback) {
        this.onSubtitleCallback(null);
      }
    }, estDurationMs + 600);

    if (this.isMuted || typeof window === 'undefined') {
      return;
    }

    const cacheKey = `${line.speakerId}::${line.text}`;

    try {
      let rawBuffer = this.rawBufferCache.get(cacheKey);
      let sourceTier: VillagerVoiceLine['sourceTier'] = 'CLOUD_NEURAL_MP3';

      if (!rawBuffer) {
        const res = await fetch('/api/ai/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: line.text,
            speakerId: line.speakerId
          })
        });

        if (res.ok) {
          const tierHeader = res.headers.get('X-TTS-Tier') as
            | VillagerVoiceLine['sourceTier']
            | null;
          if (tierHeader) {
            sourceTier = tierHeader;
          }
          const fetchedBuf = await res.arrayBuffer();
          if (fetchedBuf.byteLength > 200) {
            rawBuffer = fetchedBuf;
            this.rawBufferCache.set(cacheKey, fetchedBuf);
          }
        }
      }

      if (rawBuffer) {
        const ctx = this.getOrCreateAudioContext();
        if (ctx) {
          if (ctx.state === 'suspended') {
            await ctx.resume();
          }
          const bufferCopy = rawBuffer.slice(0);
          const decodedAudio = await ctx.decodeAudioData(bufferCopy);
          const source = ctx.createBufferSource();
          const gainNode = ctx.createGain();
          gainNode.gain.value = 1.05;

          source.buffer = decodedAudio;
          if (this.analyser) {
            source.connect(this.analyser);
            this.analyser.connect(gainNode);
          } else {
            source.connect(gainNode);
          }
          gainNode.connect(ctx.destination);

          this.activeSource = source;
          this.isCurrentlySpeaking = true;
          this.syntheticSpeechDurationMs = decodedAudio.duration * 1000;

          if (this.onSubtitleCallback) {
            this.onSubtitleCallback({
              ...line,
              isSpeaking: true,
              sourceTier
            });
          }

          source.onended = () => {
            if (this.activeSource === source) {
              this.activeSource = null;
              this.isCurrentlySpeaking = false;
            }
          };
          source.start(0);
          return;
        }
      }

      this.speakViaBrowserSpeechSynthesis(line);
    } catch {
      this.speakViaBrowserSpeechSynthesis(line);
    }
  }
}

export const voiceoverEngine = new VillagerVoiceoverAndSoundEngine();
