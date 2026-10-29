const clamp = (n, a, b) => Math.min(b, Math.max(a, n));

/** All sounds are synthesized locally; the audio graph starts on a user gesture. */
export class AudioSystem {
  constructor() {
    this.context = null;
    this.volume = 0.55;
    this.muted = false;
    this.lastPlayed = Object.create(null);
  }

  unlock() {
    try {
      if (!this.context) {
        const Context = window.AudioContext || window.webkitAudioContext;
        if (!Context) return;
        this.context = new Context();
        const ctx = this.context;
        this.master = ctx.createGain();
        this.master.gain.value = this.muted ? 0 : this.volume * 0.48;
        const compressor = ctx.createDynamicsCompressor();
        compressor.threshold.value = -15;
        compressor.knee.value = 15;
        compressor.ratio.value = 4;
        this.master.connect(compressor);
        compressor.connect(ctx.destination);
        this.engineGain = ctx.createGain();
        this.engineGain.gain.value = 0;
        const engineFilter = ctx.createBiquadFilter();
        engineFilter.type = 'lowpass';
        engineFilter.frequency.value = 450;
        this.engineGain.connect(engineFilter);
        engineFilter.connect(this.master);
        this.engine1 = ctx.createOscillator();
        this.engine1.type = 'sawtooth';
        this.engine1.frequency.value = 46;
        this.engine1.connect(this.engineGain);
        this.engine1.start();
        this.engine2 = ctx.createOscillator();
        this.engine2.type = 'triangle';
        this.engine2.frequency.value = 70;
        this.engine2.connect(this.engineGain);
        this.engine2.start();
        const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
        const data = noise.getChannelData(0);
        let smooth = 0;
        for (let i = 0; i < data.length; i++) { smooth = (smooth + (Math.random() * 2 - 1) * 0.14) / 1.14; data[i] = smooth * 3; }
        this.noiseBuffer = noise;
        const source = ctx.createBufferSource();
        source.buffer = noise;
        source.loop = true;
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 720;
        filter.Q.value = 0.5;
        this.boostGain = ctx.createGain();
        this.boostGain.gain.value = 0;
        source.connect(filter);
        filter.connect(this.boostGain);
        this.boostGain.connect(this.master);
        source.start();
      }
      if (this.context.state === 'suspended') this.context.resume().catch(() => {});
    } catch { this.context = null; }
  }

  setVolume(value, muted = false) {
    this.volume = clamp(Number(value) || 0, 0, 1);
    this.muted = Boolean(muted);
    if (this.master && this.context) this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume * 0.48, this.context.currentTime, 0.04);
  }

  update(speed = 0, boost = false, playing = false) {
    if (!this.context) return;
    const t = this.context.currentTime;
    const drive = clamp(Math.abs(speed) / 48, 0, 1);
    this.engine1.frequency.setTargetAtTime(43 + drive * 145 + (boost ? 22 : 0), t, 0.12);
    this.engine2.frequency.setTargetAtTime(64 + drive * 194, t, 0.16);
    this.engineGain.gain.setTargetAtTime(playing ? 0.025 + drive * 0.025 : 0, t, 0.12);
    this.boostGain.gain.setTargetAtTime(playing && boost ? 0.14 : 0, t, 0.045);
  }

  tone(frequency, duration, volume = 0.12, type = 'sine', endFrequency = frequency, delay = 0) {
    if (!this.context || this.context.state !== 'running') return;
    const ctx = this.context;
    const start = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(15, frequency), start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(15, endFrequency), start + duration);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), start + Math.min(0.012, duration * 0.2));
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(start);
    osc.stop(start + duration + 0.03);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  }

  noise(duration, volume, frequency = 600) {
    if (!this.context || !this.noiseBuffer) return;
    const ctx = this.context;
    const start = ctx.currentTime;
    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = frequency;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(Math.max(0.0001, volume), start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start(start, Math.random() * 0.8);
    source.stop(start + duration + 0.02);
    source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
  }

  play(type, strength = 1) {
    if (!this.context || this.muted) return;
    const now = this.context.currentTime;
    if (now - (this.lastPlayed[type] ?? -999) < (type === 'impact' || type === 'wall' ? 0.07 : 0.035)) return;
    this.lastPlayed[type] = now;
    const s = clamp(Number(strength) || 1, 0.2, 2);
    if (type === 'impact' || type === 'wall') {
      this.tone(120 + s * 50, 0.17, 0.13 * s, 'sine', 28);
      this.noise(0.12, 0.12 * s, type === 'wall' ? 450 : 1500);
    } else if (type === 'jump') {
      this.tone(220, 0.17, 0.12, 'triangle', 570);
      this.noise(0.12, 0.07, 1700);
    } else if (type === 'pickup') {
      this.tone(660, 0.1, 0.09, 'sine', 880);
      this.tone(1100, 0.16, 0.08, 'sine', 1350, 0.07);
    } else if (type === 'countdown') {
      this.tone(520, 0.15, 0.15, 'sine', 520);
    } else if (type === 'go' || type === 'kickoff') {
      this.tone(1040, 0.3, 0.16, 'triangle', 1300);
    } else if (type === 'goal') {
      this.noise(1.2, 0.45, 1300);
      this.tone(75, 0.85, 0.22, 'sine', 28);
      [262, 330, 392, 523, 659].forEach((f, i) => this.tone(f, 0.5, 0.14, 'triangle', f * 1.005, i * 0.09));
    } else if (type === 'end' || type === 'matchEnd') {
      [392, 523, 659, 784].forEach((f, i) => this.tone(f, 0.65, 0.12, 'triangle', f, i * 0.16));
    } else if (type === 'menu') {
      this.tone(650, 0.07, 0.055, 'triangle', 940);
    }
  }
}
