/**
 * Procedural Web Audio API synthesizer for Đảo Đèn Lồng (Phase 2).
 * Includes night ambient bed + all required SFX (pickup, lantern lit, pulse, hit, jump, dash,
 * win, lose, shade spawned, wind warning, drifter steal/drop, charm, 10s final countdown).
 */
export class LanternAudio {
  private ctx: AudioContext | null = null;
  private muted = false;
  private masterVolume = 0.7;
  private ambientOsc: OscillatorNode | null = null;
  private ambientGain: GainNode | null = null;

  setVolume(vol: number): void {
    this.masterVolume = Math.max(0, Math.min(1, vol));
    if (this.ambientGain && this.ctx) {
      this.ambientGain.gain.setTargetAtTime(
        this.muted ? 0.0001 : 0.025 * this.masterVolume,
        this.ctx.currentTime,
        0.1
      );
    }
  }

  getVolume(): number {
    return this.masterVolume;
  }

  isMuted(): boolean {
    return this.muted;
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    this.setVolume(this.masterVolume);
    return this.muted;
  }

  private ensureContext(): AudioContext | null {
    if (this.muted || this.masterVolume <= 0.001) return null;
    if (typeof window === 'undefined') return null;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!this.ctx) {
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  startAmbient(): void {
    const ctx = this.ensureContext();
    if (!ctx || this.ambientOsc) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(110, ctx.currentTime);
    gain.gain.setValueAtTime(0.025 * this.masterVolume, ctx.currentTime);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    this.ambientOsc = osc;
    this.ambientGain = gain;
  }

  private tone(
    freq: number,
    durationS: number,
    type: OscillatorType,
    volume: number,
    delayS = 0,
    endFreq?: number
  ): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime + delayS;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const scaledVol = Math.max(0.0002, volume * this.masterVolume);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + durationS);
    }
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(scaledVol, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationS);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + durationS + 0.02);
  }

  playMotePickup(carried: number): void {
    const scale = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
    const note = scale[(Math.max(1, carried) - 1) % scale.length];
    this.tone(note, 0.22, 'sine', 0.14);
    this.tone(note * 1.5, 0.16, 'triangle', 0.06, 0.04);
  }

  playJump(): void {
    this.tone(240, 0.16, 'sine', 0.1, 0, 480);
  }

  playDash(): void {
    this.tone(520, 0.18, 'triangle', 0.13, 0, 220);
  }

  playCharm(): void {
    this.tone(587.33, 0.25, 'sine', 0.14, 0);
    this.tone(880.0, 0.35, 'triangle', 0.14, 0.08);
    this.tone(1174.66, 0.4, 'sine', 0.12, 0.16);
  }

  playDeposit(): void {
    this.tone(392.0, 0.2, 'triangle', 0.12, 0, 523.25);
  }

  playLanternLit(): void {
    this.tone(440.0, 0.4, 'sine', 0.14, 0.0);
    this.tone(554.37, 0.45, 'sine', 0.14, 0.09);
    this.tone(659.25, 0.55, 'triangle', 0.16, 0.18);
    this.tone(880.0, 0.7, 'sine', 0.12, 0.28);
  }

  playPulse(): void {
    this.tone(660, 0.45, 'sine', 0.16, 0, 180);
    this.tone(990, 0.35, 'triangle', 0.08, 0.03, 330);
  }

  playHit(): void {
    this.tone(160, 0.35, 'sawtooth', 0.15, 0, 65);
  }

  playShadeSpawned(): void {
    this.tone(140, 0.4, 'sine', 0.11, 0, 95);
  }

  playDrifterEvent(): void {
    this.tone(740, 0.25, 'triangle', 0.12, 0, 420);
  }

  playWindWarning(): void {
    this.tone(300, 0.5, 'sine', 0.09, 0, 460);
  }

  playCountdownTick(): void {
    this.tone(880, 0.09, 'square', 0.08);
  }

  playGameOver(won: boolean): void {
    if (won) {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, idx) => {
        this.tone(f, 0.5, 'sine', 0.14, idx * 0.11);
      });
    } else {
      [329.63, 293.66, 220.0].forEach((f, idx) => {
        this.tone(f, 0.5, 'triangle', 0.13, idx * 0.14);
      });
    }
  }
}
