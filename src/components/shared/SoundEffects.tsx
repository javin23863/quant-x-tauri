interface SoundType {
  id: string;
  name: string;
  duration: number;
  type: 'ui' | 'arrival' | 'warning' | 'critical' | 'success' | 'data' | 'status' | 'error';
}

class WAVGenerator {
  sampleRate = 22050;
  bitDepth = 8;
  channels = 1;

  private createWAVHeader(dataLength: number): Uint8Array {
    const buffer = new ArrayBuffer(44);
    const view = new DataView(buffer);

    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + dataLength, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, this.channels, true);
    view.setUint32(24, this.sampleRate, true);
    view.setUint32(28, this.sampleRate * this.channels * this.bitDepth / 8, true);
    view.setUint16(32, this.channels * this.bitDepth / 8, true);
    view.setUint16(34, this.bitDepth, true);
    writeString(36, 'data');
    view.setUint32(40, dataLength, true);

    return new Uint8Array(buffer);
  }

  private samplesToBase64WAV(samples: Uint8Array): string {
    const header = this.createWAVHeader(samples.length);
    const combined = new Uint8Array(header.length + samples.length);
    combined.set(header, 0);
    combined.set(samples, header.length);

    let binary = '';
    for (let i = 0; i < combined.length; i++) {
      binary += String.fromCharCode(combined[i]);
    }
    return btoa(binary);
  }

  generateClick(): string {
    const durationMs = 50;
    const numSamples = Math.floor(this.sampleRate * durationMs / 1000);
    const samples = new Uint8Array(numSamples);

    for (let i = 0; i < numSamples; i++) {
      const t = i / numSamples;
      const noise = Math.random() * 2 - 1;
      const envelope = Math.exp(-t * 15) * (1 - t);
      const click = noise * envelope * 0.4;
      samples[i] = Math.floor(128 + click * 127);
    }

    return 'data:audio/wav;base64,' + this.samplesToBase64WAV(samples);
  }

  generatePing(): string {
    const durationMs = 120;
    const numSamples = Math.floor(this.sampleRate * durationMs / 1000);
    const samples = new Uint8Array(numSamples);
    const baseFreq = 1200;
    const freqRange = 600;

    for (let i = 0; i < numSamples; i++) {
      const t = i / numSamples;
      const freq = baseFreq + freqRange * t * t;
      const phase = 2 * Math.PI * freq * i / this.sampleRate;
      const envelope = Math.exp(-t * 8) * (1 - t * t);
      const sample = Math.sin(phase) * envelope * 0.5;
      samples[i] = Math.floor(128 + sample * 127);
    }

    return 'data:audio/wav;base64,' + this.samplesToBase64WAV(samples);
  }

  generateAlert(): string {
    const durationMs = 100;
    const numSamples = Math.floor(this.sampleRate * durationMs / 1000);
    const samples = new Uint8Array(numSamples);
    const startFreq = 1800;
    const endFreq = 800;

    for (let i = 0; i < numSamples; i++) {
      const t = i / numSamples;
      const freq = startFreq - (startFreq - endFreq) * t;
      const phase = 2 * Math.PI * freq * i / this.sampleRate;
      const envelope = Math.exp(-t * 6) * (1 - t * 0.5);
      const harmonic2 = Math.sin(phase * 2) * 0.3;
      const sample = (Math.sin(phase) + harmonic2) * envelope * 0.4;
      samples[i] = Math.floor(128 + sample * 127);
    }

    return 'data:audio/wav;base64,' + this.samplesToBase64WAV(samples);
  }

  generateConnection(): string {
    const durationMs = 150;
    const numSamples = Math.floor(this.sampleRate * durationMs / 1000);
    const samples = new Uint8Array(numSamples);
    const freqs = [440, 554.37, 659.25];

    for (let i = 0; i < numSamples; i++) {
      const t = i / numSamples;
      let sample = 0;
      for (const freq of freqs) {
        const phase = 2 * Math.PI * freq * i / this.sampleRate;
        sample += Math.sin(phase) * 0.3;
      }
      const envelope = Math.exp(-t * 10) * (1 - t);
      sample *= envelope * 0.4;
      samples[i] = Math.floor(128 + sample * 127);
    }

    return 'data:audio/wav;base64,' + this.samplesToBase64WAV(samples);
  }

  generateRiskBreach(): string {
    const durationMs = 140;
    const numSamples = Math.floor(this.sampleRate * durationMs / 1000);
    const samples = new Uint8Array(numSamples);
    const freq1 = 2000;
    const freq2 = 1500;

    for (let i = 0; i < numSamples; i++) {
      const t = i / numSamples;
      const cyclePos = (t * 8) % 1;
      const freq = cyclePos < 0.5 ? freq1 : freq2;
      const phase = 2 * Math.PI * freq * i / this.sampleRate;
      const envelope = Math.exp(-t * 4);
      const sample = Math.sin(phase) * envelope * 0.5;
      samples[i] = Math.floor(128 + sample * 127);
    }

    return 'data:audio/wav;base64,' + this.samplesToBase64WAV(samples);
  }

  generateOrderFilled(): string {
    const durationMs = 100;
    const numSamples = Math.floor(this.sampleRate * durationMs / 1000);
    const samples = new Uint8Array(numSamples);
    const baseFreq = 880;

    for (let i = 0; i < numSamples; i++) {
      const t = i / numSamples;
      const freq = baseFreq * (1 + t * 0.2);
      const phase = 2 * Math.PI * freq * i / this.sampleRate;
      const envelope = Math.sin(t * Math.PI) * Math.exp(-t * 3);
      const sample = Math.sin(phase) * envelope * 0.45;
      samples[i] = Math.floor(128 + sample * 127);
    }

    return 'data:audio/wav;base64,' + this.samplesToBase64WAV(samples);
  }

  generateSignalArrived(): string {
    const durationMs = 80;
    const numSamples = Math.floor(this.sampleRate * durationMs / 1000);
    const samples = new Uint8Array(numSamples);
    const freq = 1600;

    for (let i = 0; i < numSamples; i++) {
      const t = i / numSamples;
      const phase = 2 * Math.PI * freq * i / this.sampleRate;
      const envelope = Math.sin(t * Math.PI) * 0.8;
      const harmonic = Math.sin(phase * 1.5) * 0.2;
      const sample = (Math.sin(phase) + harmonic) * envelope * 0.4;
      samples[i] = Math.floor(128 + sample * 127);
    }

    return 'data:audio/wav;base64,' + this.samplesToBase64WAV(samples);
  }

  generateConnectionLost(): string {
    const durationMs = 130;
    const numSamples = Math.floor(this.sampleRate * durationMs / 1000);
    const samples = new Uint8Array(numSamples);
    const startFreq = 1200;
    const endFreq = 400;

    for (let i = 0; i < numSamples; i++) {
      const t = i / numSamples;
      const freq = startFreq * Math.pow(endFreq / startFreq, t);
      const phase = 2 * Math.PI * freq * i / this.sampleRate;
      const envelope = Math.exp(-t * 5);
      const noise = Math.random() * 0.1 * (1 - t);
      const sample = (Math.sin(phase) + noise) * envelope * 0.45;
      samples[i] = Math.floor(128 + sample * 127);
    }

    return 'data:audio/wav;base64,' + this.samplesToBase64WAV(samples);
  }
}

class SoundEffectsManager {
  private wavGenerator = new WAVGenerator();
  private audioContext: AudioContext | null = null;
  private sounds: Record<string, string> = {};
  private soundDescriptions: Record<string, SoundType> = {};
  private playingNodes: Set<HTMLAudioElement> = new Set();
  enabled = true;
  volume = 0.5;

  constructor() {
    this.sounds = {
      click: this.wavGenerator.generateClick(),
      ping: this.wavGenerator.generatePing(),
      alert: this.wavGenerator.generateAlert(),
      connection: this.wavGenerator.generateConnection(),
      riskBreach: this.wavGenerator.generateRiskBreach(),
      orderFilled: this.wavGenerator.generateOrderFilled(),
      signalArrived: this.wavGenerator.generateSignalArrived(),
      connectionLost: this.wavGenerator.generateConnectionLost(),
    };

    this.soundDescriptions = {
      click: { id: 'click', name: 'UI Click', duration: 50, type: 'ui' },
      ping: { id: 'ping', name: 'Soft Ping', duration: 120, type: 'arrival' },
      alert: { id: 'alert', name: 'Alert Tone', duration: 100, type: 'warning' },
      connection: { id: 'connection', name: 'Connection', duration: 150, type: 'status' },
      riskBreach: { id: 'riskBreach', name: 'Risk Breach', duration: 140, type: 'critical' },
      orderFilled: { id: 'orderFilled', name: 'Order Filled', duration: 100, type: 'success' },
      signalArrived: { id: 'signalArrived', name: 'Signal Arrived', duration: 80, type: 'data' },
      connectionLost: { id: 'connectionLost', name: 'Connection Lost', duration: 130, type: 'error' },
    };
  }

  private initAudioContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext ?? (window as unknown as Record<string, unknown>).webkitAudioContext as typeof AudioContext)();
    }
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
    return this.audioContext;
  }

  canPlay(): boolean {
    if (!this.enabled) return false;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    return true;
  }

  async play(type: string): Promise<boolean> {
    if (!this.canPlay()) return false;
    if (!this.sounds[type]) {
      console.warn(`[SoundEffects] Unknown sound type: ${type}`);
      return false;
    }

    try {
      const ctx = this.initAudioContext();
      const audio = new Audio(this.sounds[type]);
      const source = ctx.createMediaElementSource(audio);
      const gainNode = ctx.createGain();
      gainNode.gain.value = this.volume;
      source.connect(gainNode);
      gainNode.connect(ctx.destination);
      this.playingNodes.add(audio);

      audio.addEventListener('ended', () => {
        this.playingNodes.delete(audio);
        source.disconnect();
        gainNode.disconnect();
      });

      await audio.play();
      return true;
    } catch (error) {
      console.warn(`[SoundEffects] Playback failed for ${type}:`, error);
      return false;
    }
  }

  setVolume(level: number): void {
    this.volume = Math.max(0, Math.min(1, level));
    try { localStorage.setItem('qx-sound-volume', this.volume.toString()); } catch { /* noop */ }
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    try { localStorage.setItem('qx-sound-enabled', enabled.toString()); } catch { /* noop */ }
    if (!enabled) this.stopAll();
  }

  stopAll(): void {
    this.playingNodes.forEach((audio) => {
      try { audio.pause(); audio.currentTime = 0; } catch { /* noop */ }
    });
    this.playingNodes.clear();
  }

  playRiskBreach(): Promise<boolean> { return this.play('riskBreach'); }
  playOrderFilled(): Promise<boolean> { return this.play('orderFilled'); }
  playSignalArrived(): Promise<boolean> { return this.play('signalArrived'); }
  playConnectionLost(): Promise<boolean> { return this.play('connectionLost'); }
  playConnectionEstablished(): Promise<boolean> { return this.play('connection'); }

  getAvailableSounds(): SoundType[] {
    return Object.keys(this.sounds).map((key) => this.soundDescriptions[key]);
  }
}

export const soundEffects = new SoundEffectsManager();
export default soundEffects;