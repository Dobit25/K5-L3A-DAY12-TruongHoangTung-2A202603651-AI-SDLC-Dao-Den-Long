/**
 * Procedural Web Audio API synthesizer for Đảo Đèn Lồng.
 * Pure browser audio layer — zero dependency on src/core/ and zero external audio assets.
 */
export class LanternAudio {
  private ctx: AudioContext | null = null;
  private muted = false;

  isMuted(): boolean {
    return this.muted;
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    return this.muted;
  }

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;
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
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + durationS);
    }
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationS);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + durationS + 0.02);
  }

  playMotePickup(carried: number): void {
    // Pentatonic chime rising gently with carried count
    const scale = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
    const note = scale[(Math.max(1, carried) - 1) % scale.length];
    this.tone(note, 0.22, 'sine', 0.12);
    this.tone(note * 1.5, 0.18, 'triangle', 0.05, 0.04);
  }

  playDeposit(): void {
    this.tone(392.0, 0.22, 'triangle', 0.12, 0, 523.25);
  }

  playLanternLit(): void {
    // Warm golden triad arpeggio
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
    this.tone(160, 0.35, 'sawtooth', 0.14, 0, 65);
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

