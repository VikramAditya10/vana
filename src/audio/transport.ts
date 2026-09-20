import type { Arrangement } from '../content/catalog';
import { midiToHz } from './pitch';

export type TransportOptions = {
  saMidi: number;
  bpm: number;
  speed: number;
  loop: boolean;
  countIn: boolean;
  metronome: boolean;
  referenceVolume: number;
  metronomeVolume: number;
  mode: 'listen' | 'follow' | 'repeat' | 'microphone';
  startTick: number;
  endTick: number;
};

export type TransportSnapshot = {
  state: 'idle' | 'countIn' | 'playing' | 'paused' | 'completed';
  tick: number;
  beat: number;
  count: number;
  phase: 'listen' | 'repeat';
  activeSeconds: number;
  cycles: number;
};

type Segment = {
  kind: 'countIn' | 'playing';
  phase: 'listen' | 'repeat';
  startTime: number;
  endTime: number;
  startTick: number;
  endTick: number;
  scheduled: Set<string>;
};
type Voice = { oscillator: OscillatorNode; gain: GainNode; start: number; end: number };

export function secondsPerTick(bpm: number, speed = 1, ppq = 480): number {
  if (!(bpm > 0 && speed > 0 && ppq > 0) || !Number.isFinite(bpm * speed * ppq)) {
    throw new Error('Tempo and speed must be positive finite numbers.');
  }
  return 60 / (bpm * speed * ppq);
}

function defaultContext(): AudioContext {
  const audioWindow = globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext };
  const AudioContextClass = audioWindow.AudioContext ?? audioWindow.webkitAudioContext;
  if (!AudioContextClass) throw new Error('This browser does not support Web Audio.');
  return new AudioContextClass({ latencyHint: 'interactive' });
}

/** The audio clock owns timing. UI callers read snapshot() in requestAnimationFrame. */
export class AudioTransport {
  public onComplete?: () => void;
  private context: AudioContext | null = null;
  private options: TransportOptions;
  private segments: Segment[] = [];
  private voices = new Set<Voice>();
  private interval: ReturnType<typeof setInterval> | null = null;
  private state: TransportSnapshot['state'] = 'idle';
  private tick: number;
  private phase: 'listen' | 'repeat' = 'listen';
  private activeSeconds = 0;
  private cycles = 0;
  private running = false;
  private disposed = false;
  private generation = 0;
  private visibilityHandler = () => {
    if (globalThis.document?.hidden) this.pause();
  };

  constructor(
    private arrangement: Arrangement,
    options: Partial<TransportOptions> = {},
    private contextFactory: () => AudioContext = defaultContext,
  ) {
    const endTick = Math.max(...arrangement.events.map(event => event.startTick + event.durationTicks), 480);
    this.options = {
      saMidi: arrangement.referenceSaMidi, bpm: arrangement.bpm, speed: 1,
      loop: false, countIn: true, metronome: true, referenceVolume: 0.6,
      metronomeVolume: 0.3, mode: 'listen', startTick: 0, endTick, ...options,
    };
    this.normaliseOptions();
    this.tick = this.options.startTick;
    globalThis.document?.addEventListener('visibilitychange', this.visibilityHandler);
  }

  private normaliseOptions() {
    const options = this.options;
    options.bpm = Number.isFinite(options.bpm) ? Math.max(30, Math.min(240, options.bpm)) : this.arrangement.bpm;
    options.speed = Number.isFinite(options.speed) ? Math.max(0.25, Math.min(2, options.speed)) : 1;
    options.saMidi = Number.isFinite(options.saMidi) ? Math.max(24, Math.min(96, options.saMidi)) : this.arrangement.referenceSaMidi;
    options.referenceVolume = Number.isFinite(options.referenceVolume) ? Math.max(0, Math.min(1, options.referenceVolume)) : 0.6;
    options.metronomeVolume = Number.isFinite(options.metronomeVolume) ? Math.max(0, Math.min(1, options.metronomeVolume)) : 0.3;
    const end = Math.max(...this.arrangement.events.map(event => event.startTick + event.durationTicks), 480);
    options.startTick = Number.isFinite(options.startTick) ? Math.max(0, Math.min(end - 1, Math.round(options.startTick))) : 0;
    options.endTick = Number.isFinite(options.endTick) ? Math.max(options.startTick + 1, Math.min(end, Math.round(options.endTick))) : end;
  }

  private get spt() { return secondsPerTick(this.options.bpm, this.options.speed, this.arrangement.ppq); }
  private get ticksPerBeat() { return this.arrangement.ppq * 4 / this.arrangement.timeSignature[1]; }

  private async ready(): Promise<AudioContext> {
    if (this.disposed) throw new Error('This audio session has already been closed.');
    if (!this.context) {
      this.context = this.contextFactory();
      this.context.addEventListener('statechange', () => {
        if (this.running && this.context?.state !== 'running') this.pause();
      });
    }
    const context = this.context;
    await context.resume();
    if (this.disposed || this.context !== context) throw new Error('This audio session has already been closed.');
    if (context.state !== 'running') throw new Error('Audio is interrupted. Press play again to resume.');
    return context;
  }

  async play(): Promise<void> {
    if (this.running) return;
    const generation = ++this.generation;
    const context = await this.ready();
    if (generation !== this.generation || this.disposed) return;
    if (this.tick >= this.options.endTick || this.state === 'completed') {
      this.tick = this.options.startTick;
      this.phase = 'listen';
    }
    const useCountIn = this.options.countIn && this.state !== 'paused';
    this.begin(context.currentTime + 0.04, this.tick, this.phase, useCountIn);
  }

  private begin(time: number, tick: number, phase: 'listen' | 'repeat', countIn: boolean) {
    this.running = true;
    this.segments = [this.makeSegment(countIn ? 'countIn' : 'playing', phase, time, tick)];
    this.state = countIn ? 'countIn' : 'playing';
    if (this.interval) clearInterval(this.interval);
    this.interval = setInterval(() => this.pump(), 25);
    this.pump();
  }

  private makeSegment(kind: Segment['kind'], phase: Segment['phase'], startTime: number, startTick = this.options.startTick): Segment {
    const durationTicks = kind === 'countIn'
      ? this.arrangement.timeSignature[0] * this.ticksPerBeat
      : this.options.endTick - startTick;
    return { kind, phase, startTime, endTime: startTime + durationTicks * this.spt,
      startTick, endTick: this.options.endTick, scheduled: new Set() };
  }

  private nextSegment(previous: Segment): Segment | null {
    if (previous.kind === 'countIn') {
      return this.makeSegment('playing', previous.phase, previous.endTime, previous.startTick);
    }
    if (this.options.mode === 'repeat' && previous.phase === 'listen') {
      return this.makeSegment('countIn', 'repeat', previous.endTime);
    }
    if (!this.options.loop) return null;
    return this.makeSegment(this.options.countIn ? 'countIn' : 'playing', 'listen', previous.endTime);
  }

  private pump() {
    if (!this.running || !this.context) return;
    const now = this.context.currentTime;
    const horizon = now + 0.12;
    // Queue the next leg before the boundary, so timers never define its audible onset.
    let tail = this.segments[this.segments.length - 1];
    let planned = 0;
    while (tail && tail.endTime <= horizon && planned++ < 64) {
      const next = this.nextSegment(tail);
      if (!next) break;
      this.segments.push(next);
      tail = next;
    }
    while (this.segments.length && now >= this.segments[0].endTime) {
      const completed = this.segments.shift()!;
      if (completed.kind === 'playing') {
        this.activeSeconds += completed.endTime - completed.startTime;
        if (this.options.mode !== 'repeat' || completed.phase === 'repeat') this.cycles++;
      }
      if (!this.segments.length) {
        const next = this.nextSegment(completed);
        if (next) this.segments.push(next);
        else {
          this.running = false;
          this.state = 'completed';
          this.tick = this.options.endTick;
          this.phase = completed.phase;
          this.stopInterval();
          this.onComplete?.();
          return;
        }
      }
    }
    const current = this.segments[0];
    if (!current) return;
    this.state = current.kind;
    this.phase = current.phase;
    for (const segment of this.segments) this.scheduleSegment(segment, now, horizon);
  }

  private scheduleSegment(segment: Segment, now: number, horizon: number) {
    if (segment.startTime > horizon) return;
    const { metronome, metronomeVolume, mode, referenceVolume, saMidi } = this.options;
    const beats = this.arrangement.timeSignature[0];
    const beatSeconds = this.ticksPerBeat * this.spt;
    if (segment.kind === 'countIn' || metronome) {
      const firstBeat = segment.kind === 'countIn' ? 0 : Math.ceil(segment.startTick / this.ticksPerBeat);
      const lastBeat = segment.kind === 'countIn' ? beats : Math.ceil(segment.endTick / this.ticksPerBeat);
      for (let beat = firstBeat; beat < lastBeat; beat++) {
        const when = segment.kind === 'countIn'
          ? segment.startTime + beat * beatSeconds
          : segment.startTime + (beat * this.ticksPerBeat - segment.startTick) * this.spt;
        if (when > horizon) break;
        const key = `beat:${beat}`;
        if (!segment.scheduled.has(key)) {
          segment.scheduled.add(key);
          if (when >= now - 0.03 && when < segment.endTime) {
            this.tone(beat % beats === 0 ? 1300 : 950, Math.max(when, now), 0.045, metronomeVolume * 0.16, true);
          }
        }
      }
    }
    if (segment.kind !== 'playing' || mode === 'microphone' || (mode === 'repeat' && segment.phase === 'repeat')) return;
    for (const event of this.arrangement.events) {
      if (event.kind !== 'note' || event.startTick >= segment.endTick || event.startTick + event.durationTicks <= segment.startTick) continue;
      const startTick = Math.max(event.startTick, segment.startTick);
      const endTick = Math.min(event.startTick + event.durationTicks, segment.endTick);
      const when = segment.startTime + (startTick - segment.startTick) * this.spt;
      const end = segment.startTime + (endTick - segment.startTick) * this.spt;
      if (when > horizon || segment.scheduled.has(event.id)) continue;
      segment.scheduled.add(event.id);
      if (end > now) this.tone(midiToHz(saMidi + event.semitonesFromSa), Math.max(when, now), end - Math.max(when, now), referenceVolume * 0.23);
    }
  }

  private tone(hz: number, when: number, duration: number, volume: number, click = false) {
    if (!this.context || duration <= 0 || volume <= 0) return;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    if (click) oscillator.type = 'sine';
    else oscillator.setPeriodicWave(this.context.createPeriodicWave(new Float32Array([0, 0, 0, 0]), new Float32Array([0, 1, 0.15, 0.055])));
    oscillator.frequency.setValueAtTime(hz, when);
    const attack = Math.min(0.015, duration / 4);
    const release = Math.min(0.035, duration / 3);
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(volume, when + attack);
    gain.gain.setValueAtTime(volume, Math.max(when + attack, when + duration - release));
    gain.gain.linearRampToValueAtTime(0, when + duration);
    oscillator.connect(gain);
    gain.connect(this.context.destination);
    const voice = { oscillator, gain, start: when, end: when + duration };
    this.voices.add(voice);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); this.voices.delete(voice); };
    oscillator.start(when);
    oscillator.stop(when + duration);
  }

  snapshot(): TransportSnapshot {
    if (this.running) this.pump();
    const segment = this.running ? this.segments[0] : undefined;
    const now = this.context?.currentTime ?? 0;
    const elapsed = segment ? Math.max(0, Math.min(now, segment.endTime) - segment.startTime) : 0;
    const tick = segment?.kind === 'playing' ? Math.min(segment.endTick, segment.startTick + elapsed / this.spt) : segment?.startTick ?? this.tick;
    return {
      state: this.state, tick,
      beat: Math.floor(tick / this.ticksPerBeat) % this.arrangement.timeSignature[0] + 1,
      count: segment?.kind === 'countIn' ? Math.min(this.arrangement.timeSignature[0], Math.floor(elapsed / (this.ticksPerBeat * this.spt)) + 1) : 0,
      phase: this.phase,
      activeSeconds: this.activeSeconds + (segment?.kind === 'playing' ? elapsed : 0),
      cycles: this.cycles,
    };
  }

  pause() {
    ++this.generation;
    if (this.running) {
      const snapshot = this.snapshot();
      this.tick = snapshot.tick;
      this.activeSeconds = snapshot.activeSeconds;
      this.phase = snapshot.phase;
      if (this.running) this.state = 'paused';
    }
    this.running = false;
    this.segments = [];
    this.stopInterval();
    this.cancelVoices();
  }

  async restart(): Promise<void> {
    this.pause();
    this.tick = this.options.startTick;
    this.phase = 'listen';
    this.state = 'idle';
    await this.play();
  }

  seek(tick: number) {
    const wasRunning = this.running;
    this.pause();
    this.tick = Math.max(this.options.startTick, Math.min(this.options.endTick, Number.isFinite(tick) ? tick : this.options.startTick));
    this.state = 'paused';
    if (wasRunning && this.tick < this.options.endTick && this.context) this.begin(this.context.currentTime + 0.015, this.tick, this.phase, false);
  }

  configure(options: Partial<TransportOptions>) {
    const wasRunning = this.running;
    const wasCountIn = this.state === 'countIn';
    const priorMode = this.options.mode;
    this.pause();
    this.options = { ...this.options, ...options };
    this.normaliseOptions();
    this.tick = Math.max(this.options.startTick, Math.min(this.options.endTick, this.tick));
    if (priorMode !== this.options.mode) this.phase = 'listen';
    if (wasRunning && this.context && this.tick < this.options.endTick) this.begin(this.context.currentTime + 0.015, this.tick, this.phase, wasCountIn);
  }

  async preview(midi: number, duration = 0.9): Promise<void> {
    if (this.running && (this.options.mode === 'microphone' || (this.options.mode === 'repeat' && this.phase === 'repeat'))) return;
    const context = await this.ready();
    if (!Number.isFinite(midi)) return;
    this.tone(midiToHz(midi), context.currentTime + 0.015, Math.max(0.05, Math.min(8, duration)), this.options.referenceVolume * 0.23);
  }

  private stopInterval() {
    if (this.interval) clearInterval(this.interval);
    this.interval = null;
  }

  private cancelVoices() {
    if (!this.context) return;
    const now = this.context.currentTime;
    for (const voice of this.voices) {
      const parameter = voice.gain.gain;
      if (voice.start > now) {
        parameter.cancelScheduledValues(now);
        parameter.setValueAtTime(0, now);
        voice.oscillator.stop(now);
      } else {
        if (typeof parameter.cancelAndHoldAtTime === 'function') parameter.cancelAndHoldAtTime(now);
        else { parameter.cancelScheduledValues(now); parameter.setValueAtTime(parameter.value, now); }
        parameter.linearRampToValueAtTime(0, now + 0.012);
        voice.oscillator.stop(now + 0.012);
      }
    }
  }

  dispose() {
    this.pause();
    this.disposed = true;
    globalThis.document?.removeEventListener('visibilitychange', this.visibilityHandler);
    if (this.context && this.context.state !== 'closed') void this.context.close().catch(() => undefined);
    this.context = null;
  }
}
