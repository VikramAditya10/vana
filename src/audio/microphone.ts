import { centsError, detectPitch, type PitchDetection } from './pitch';

export type MicrophoneFrame = PitchDetection & { time: number };
export type MicrophoneStatus = 'off' | 'permission needed' | 'listening' | 'low signal' | 'unavailable' | 'calibrating';
type WorkerFrame = MicrophoneFrame & { generation: number };

/** Local input only: no recordings, uploads, or reference-audio correctness claims. */
export class Microphone {
  public status: MicrophoneStatus = 'off';
  public error = '';
  public actualSettings: MediaTrackSettings = {};
  public noiseFloor = 0.003;
  private stream: MediaStream | null = null;
  private context: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private worker: Worker | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private busy = false;
  private generation = 0;
  private recentPitches: number[] = [];
  private lastPitch: number | null = null;
  private octaveCandidate: number | null = null;
  private octaveFrames = 0;
  private lastVoicedTime = 0;
  private calibrationUntil = 0;
  private calibrationSamples: number[] = [];
  private visibilityHandler = () => { if (globalThis.document?.hidden) this.stop(); };

  constructor(private onFrame: (frame: MicrophoneFrame) => void) {
    globalThis.document?.addEventListener('visibilitychange', this.visibilityHandler);
  }

  async start(): Promise<void> {
    if (this.stream) return;
    this.stop();
    const generation = this.generation;
    this.error = '';
    if (!globalThis.isSecureContext || !globalThis.navigator?.mediaDevices?.getUserMedia) {
      this.status = 'unavailable';
      this.error = 'Microphone input needs HTTPS (or localhost) and a browser with microphone support.';
      return;
    }
    this.status = 'permission needed';
    let acquired: MediaStream | null = null;
    try {
      acquired = await navigator.mediaDevices.getUserMedia({ audio: {
        channelCount: 1, echoCancellation: false, noiseSuppression: false, autoGainControl: false,
      }, video: false });
      if (generation !== this.generation) { acquired.getTracks().forEach(track => track.stop()); return; }
      this.stream = acquired;
      const audioWindow = globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext };
      const AudioContextClass = audioWindow.AudioContext ?? audioWindow.webkitAudioContext;
      if (!AudioContextClass) throw new Error('This browser does not support microphone audio processing.');
      this.context = new AudioContextClass({ latencyHint: 'interactive' });
      await this.context.resume();
      if (generation !== this.generation) return;
      this.actualSettings = acquired.getAudioTracks()[0]?.getSettings() ?? {};
      this.source = this.context.createMediaStreamSource(acquired);
      this.analyser = this.context.createAnalyser();
      this.analyser.fftSize = 4096;
      this.analyser.smoothingTimeConstant = 0;
      this.source.connect(this.analyser);
      this.context.addEventListener('statechange', () => {
        if (this.context && this.context.state !== 'running' && this.status !== 'off') {
          this.stop();
          this.error = 'Microphone audio was interrupted. Enable the microphone to resume.';
        }
      });
      const track = acquired.getAudioTracks()[0];
      if (track) track.onended = () => {
        if (this.stream) { this.stop(); this.status = 'unavailable'; this.error = 'The microphone was disconnected. Reconnect it and try again.'; }
      };
      try {
        this.worker = new Worker(new URL('./pitch.worker.ts', import.meta.url), { type: 'module' });
        this.worker.onmessage = (event: MessageEvent<WorkerFrame>) => {
          this.busy = false;
          if (event.data.generation === this.generation) this.processFrame(event.data);
        };
        this.worker.onerror = () => {
          this.worker?.terminate(); this.worker = null; this.busy = false;
          // A throttled local fallback preserves tuner support when workers are blocked.
        };
      } catch { this.worker = null; }
      this.status = 'listening';
      this.lastVoicedTime = performance.now() / 1000;
      this.timer = setInterval(() => this.capture(), 50);
    } catch (cause) {
      acquired?.getTracks().forEach(track => track.stop());
      if (generation !== this.generation) return;
      this.stop();
      this.status = 'unavailable';
      const name = cause instanceof DOMException ? cause.name : '';
      this.error = name === 'NotAllowedError' || name === 'SecurityError'
        ? 'Microphone permission was denied. Allow it in your browser settings, then try again. Listening and lessons still work.'
        : name === 'NotFoundError'
          ? 'No microphone was found. Connect a microphone, then try again.'
          : name === 'NotReadableError'
            ? 'The microphone is busy or could not be read. Close other apps using it and try again.'
            : cause instanceof Error ? cause.message : 'Microphone input is unavailable on this device.';
    }
  }

  private capture() {
    if (!this.context || !this.analyser || this.busy) return;
    const samples = new Float32Array(this.analyser.fftSize);
    this.analyser.getFloatTimeDomainData(samples);
    // Samples describe the most recent analysis window; use its centre as capture time.
    const time = performance.now() / 1000 - samples.length / (2 * this.context.sampleRate);
    if (this.worker) {
      this.busy = true;
      this.worker.postMessage({ samples, sampleRate: this.context.sampleRate, time, generation: this.generation }, [samples.buffer]);
    } else {
      this.processFrame({ ...detectPitch(samples, this.context.sampleRate), time });
    }
  }

  private processFrame(frame: MicrophoneFrame) {
    if (this.calibrationUntil > 0) {
      this.calibrationSamples.push(frame.rms);
      if (performance.now() / 1000 >= this.calibrationUntil) {
        const sorted = this.calibrationSamples.slice().sort((a, b) => a - b);
        const background = sorted[Math.floor(sorted.length * 0.85)] ?? 0.001;
        this.noiseFloor = Math.max(0.003, background * 2.5);
        this.calibrationUntil = 0;
        this.status = 'listening';
      }
      this.onFrame({ ...frame, hz: null, confidence: 0 });
      return;
    }
    let hz = frame.hz;
    if (frame.rms < this.noiseFloor || frame.confidence < 0.85) hz = null;
    if (hz && this.lastPitch) {
      const leap = Math.abs(centsError(hz, this.lastPitch));
      // Require repeated evidence for octave-sized leaps; do not silently fold octaves.
      if (leap > 1050 && leap < 1350) {
        if (this.octaveCandidate && Math.abs(centsError(hz, this.octaveCandidate)) < 60) this.octaveFrames++;
        else { this.octaveCandidate = hz; this.octaveFrames = 1; }
        if (this.octaveFrames < 3) hz = null;
      } else { this.octaveCandidate = null; this.octaveFrames = 0; }
    }
    if (hz) {
      if (this.lastPitch && Math.abs(centsError(hz, this.lastPitch)) > 100) this.recentPitches = [];
      this.recentPitches.push(hz);
      if (this.recentPitches.length > 3) this.recentPitches.shift();
      const sorted = this.recentPitches.slice().sort((a, b) => a - b);
      hz = sorted[Math.floor(sorted.length / 2)];
      this.lastPitch = hz;
      this.lastVoicedTime = frame.time;
      this.status = 'listening';
    } else if (frame.time - this.lastVoicedTime > 0.45) {
      this.status = 'low signal';
      this.lastPitch = null;
      this.recentPitches = [];
    }
    this.onFrame({ ...frame, hz });
  }

  /** Stay quiet for 1.5 seconds; establishes a conservative ambient RMS gate. */
  calibrate() {
    if (!this.stream) { this.error = 'Enable the microphone before calibrating background noise.'; return; }
    this.calibrationSamples = [];
    this.calibrationUntil = performance.now() / 1000 + 1.5;
    this.status = 'calibrating';
    this.lastPitch = null;
    this.recentPitches = [];
  }

  stop() {
    this.generation++;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.worker?.terminate(); this.worker = null;
    this.busy = false;
    this.source?.disconnect(); this.source = null;
    this.analyser?.disconnect(); this.analyser = null;
    const stream = this.stream;
    this.stream = null;
    stream?.getTracks().forEach(track => { track.onended = null; track.stop(); });
    const context = this.context;
    this.context = null;
    if (context && context.state !== 'closed') void context.close().catch(() => undefined);
    this.status = 'off';
    this.calibrationUntil = 0;
    this.recentPitches = [];
    this.lastPitch = null;
    this.octaveCandidate = null;
    this.octaveFrames = 0;
  }

  dispose() {
    this.stop();
    globalThis.document?.removeEventListener('visibilitychange', this.visibilityHandler);
  }
}
