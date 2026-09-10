// Calming Salon Lounge Ambient Audio Generator using Web Audio API
class LoungeAudioEngine {
  private ctx: AudioContext | null = null;
  private isRunning = false;
  private timer: number | null = null;
  private currentVibe = 'lofi';

  private chordProgressions: Record<string, number[][]> = {
    lofi: [
      [261.63, 329.63, 392.00, 493.88], // Cmaj7
      [220.00, 261.63, 329.63, 392.00], // Am7
      [293.66, 349.23, 440.00, 523.25], // Dm7
      [196.00, 246.94, 293.66, 349.23], // G7
    ],
    ambient_spa: [
      [216.0, 324.0, 432.0], // 432Hz Serene Chords
      [256.0, 384.0, 512.0],
      [288.0, 432.0, 576.0],
      [216.0, 324.0, 432.0],
    ],
    bossa: [
      [261.63, 311.13, 392.00, 466.16], // Cm7
      [246.94, 311.13, 369.99, 440.00], // B7b5
      [220.00, 261.63, 329.63, 392.00], // Am7
      [207.65, 261.63, 311.13, 392.00], // Abmaj7
    ],
  };

  public init() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public play(vibe = 'lofi') {
    this.init();
    if (!this.ctx) return;
    this.isRunning = true;
    this.currentVibe = vibe.toLowerCase().includes('spa')
      ? 'ambient_spa'
      : vibe.toLowerCase().includes('bossa')
      ? 'bossa'
      : 'lofi';

    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    // Resume context in case it was suspended by pause()
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    let step = 0;
    const chords = this.chordProgressions[this.currentVibe] || this.chordProgressions.lofi;

    const playChord = () => {
      if (!this.isRunning || !this.ctx) return;
      const notes = chords[step % chords.length];
      step++;

      notes.forEach((freq, idx) => {
        if (!this.ctx) return;
        try {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          const filter = this.ctx.createBiquadFilter();

          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(650 + idx * 80, this.ctx.currentTime);

          // Gentle ambient fade in and long organic release
          const now = this.ctx.currentTime;
          gain.gain.setValueAtTime(0.0001, now);
          gain.gain.exponentialRampToValueAtTime(0.035, now + 0.6);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 3.8);

          osc.connect(filter);
          filter.connect(gain);
          gain.connect(this.ctx.destination);

          osc.start(now);
          osc.stop(now + 4.0);
        } catch {
          // Ignore audio node cleanup errors
        }
      });

      this.timer = window.setTimeout(playChord, 3400);
    };

    playChord();
  }

  /** Pause playback — suspends the AudioContext so it can be resumed later. */
  public pause() {
    this.isRunning = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    // Suspend (not close) so resume() works cleanly on next play()
    if (this.ctx && this.ctx.state === 'running') {
      this.ctx.suspend().catch(() => {});
    }
  }

  public stop() {
    this.isRunning = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}

export const loungeAudio = new LoungeAudioEngine();
