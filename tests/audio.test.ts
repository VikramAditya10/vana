import test from 'node:test';
import assert from 'node:assert/strict';
import { arrangements, type Arrangement, type ScoreEvent } from '../src/content/catalog';
import { centsError, detectPitch, hzToMidi, midiName, midiToHz } from '../src/audio/pitch';
import { AudioTransport, secondsPerTick } from '../src/audio/transport';
import { Microphone } from '../src/audio/microphone';

class FakeParameter {
  value = 0;
  events: { method: string; value?: number; time: number }[] = [];
  setValueAtTime(value: number, time: number) { this.value = value; this.events.push({ method: 'set', value, time }); }
  linearRampToValueAtTime(value: number, time: number) { this.events.push({ method: 'ramp', value, time }); }
  cancelScheduledValues(time: number) { this.events.push({ method: 'cancel', time }); }
  cancelAndHoldAtTime(time: number) { this.events.push({ method: 'hold', time }); }
}
class FakeOscillator {
  frequency = new FakeParameter();
  type = 'sine';
  isReference = false;
  started = -1;
  stops: number[] = [];
  onended: (() => void) | null = null;
  connect() {}
  disconnect() {}
  setPeriodicWave() { this.isReference = true; }
  start(time: number) { this.started = time; }
  stop(time: number) { this.stops.push(time); }
}
class FakeContext {
  currentTime = 0;
  state = 'running';
  destination = {};
  oscillators: FakeOscillator[] = [];
  gains: { gain: FakeParameter; connect(): void; disconnect(): void }[] = [];
  async resume() { this.state = 'running'; }
  async close() { this.state = 'closed'; }
  addEventListener() {}
  createPeriodicWave() { return {}; }
  createOscillator() { const oscillator = new FakeOscillator(); this.oscillators.push(oscillator); return oscillator; }
  createGain() { const gain = { gain: new FakeParameter(), connect() {}, disconnect() {} }; this.gains.push(gain); return gain; }
}
function note(id: string, startTick: number, durationTicks: number, semitonesFromSa = 0): ScoreEvent {
  return { id, kind: 'note', swara: semitonesFromSa === 2 ? 'Re' : 'Sa', alteration: 'natural', octave: 0, semitonesFromSa, startTick, durationTicks };
}
function arrangement(events: ScoreEvent[], extra: Partial<Arrangement> = {}): Arrangement {
  return { ...arrangements[0], bpm: 60, ppq: 480, timeSignature: [4, 4], referenceSaMidi: 60, events, ...extra };
}
function tone(hz: number, sampleRate = 48000, length = 4096, amplitude = 0.4) {
  return Float32Array.from({ length }, (_, index) => amplitude * Math.sin(2 * Math.PI * hz * index / sampleRate));
}

test('pitch conversions preserve cents, octave differences and MIDI names', () => {
  assert.equal(midiToHz(69), 440);
  assert.equal(hzToMidi(440), 69);
  assert.equal(centsError(880, 440), 1200);
  assert.ok(Math.abs(centsError(440 * 2 ** (37 / 1200), 440) - 37) < 1e-9);
  assert.equal(midiName(60), 'C4');
  assert.ok(Number.isNaN(hzToMidi(0)));
  assert.ok(Number.isNaN(centsError(0, 440)));
});

test('YIN detects synthetic fundamentals across the flute range at common sample rates', () => {
  for (const sampleRate of [44100, 48000]) {
    for (const hz of [82.41, 130.81, 220, 261.626, 440, 523.251, 1046.502, 1760]) {
      const detected = detectPitch(tone(hz, sampleRate), sampleRate);
      assert.ok(detected.hz, `No pitch detected at ${hz} Hz / ${sampleRate}`);
      assert.ok(Math.abs(centsError(detected.hz!, hz)) < 8, `${hz} became ${detected.hz}`);
      assert.ok(detected.confidence > 0.95);
    }
  }
});

test('silence, DC offset, low-level signal and deterministic noise do not produce a pitch', () => {
  assert.equal(detectPitch(new Float32Array(4096), 48000).hz, null);
  assert.equal(detectPitch(new Float32Array(4096).fill(0.2), 48000).hz, null);
  assert.equal(detectPitch(tone(440, 48000, 4096, 0.0002), 48000).hz, null);
  let seed = 48271;
  const noise = Float32Array.from({ length: 4096 }, () => {
    seed = (seed * 48271) % 2147483647;
    return (seed / 2147483647 - 0.5) * 0.7;
  });
  assert.equal(detectPitch(noise, 48000).hz, null);
});

test('YIN identifies a harmonic-rich tone without mistaking its strongest second harmonic for the fundamental', () => {
  const samples = Float32Array.from({ length: 4096 }, (_, index) => {
    const phase = 2 * Math.PI * 220 * index / 48000;
    return 0.15 * Math.sin(phase) + 0.45 * Math.sin(phase * 2) + 0.2 * Math.sin(phase * 3);
  });
  const detected = detectPitch(samples, 48000);
  assert.ok(detected.hz);
  assert.ok(Math.abs(centsError(detected.hz!, 220)) < 5);
});

test('480 ticks last a second at 60 BPM and half a second at 120 BPM', () => {
  assert.equal(secondsPerTick(60) * 480, 1);
  assert.equal(secondsPerTick(120) * 480, 0.5);
  assert.equal(secondsPerTick(120, 0.5) * 480, 1);
  assert.throws(() => secondsPerTick(0));
  assert.throws(() => secondsPerTick(Number.NaN));
});

test('initial settings configuration retains idle state and a full count-in before playback', async t => {
  const context = new FakeContext();
  const transport = new AudioTransport(arrangement([note('sa', 0, 480)]), { countIn: true, metronome: false }, () => context as unknown as AudioContext);
  t.after(() => transport.dispose());
  transport.configure({ speed: 0.75, referenceVolume: 0.5 });
  assert.equal(transport.snapshot().state, 'idle');
  await transport.play();
  assert.equal(transport.snapshot().state, 'countIn');
  assert.equal(context.oscillators.filter(value => value.isReference).length, 0);
  context.currentTime = 0.6;
  transport.configure({ speed: 1 });
  assert.equal(transport.snapshot().state, 'countIn');
  context.currentTime = 4.615;
  assert.equal(transport.snapshot().state, 'playing');
});

test('reference scheduling preserves pitch when slowed, and transposes all references with Sa', async t => {
  const context = new FakeContext();
  const transport = new AudioTransport(arrangement([note('sa', 0, 480)]), { countIn: false, metronome: false, speed: 0.5, saMidi: 62 }, () => context as unknown as AudioContext);
  t.after(() => transport.dispose());
  await transport.play();
  assert.equal(context.oscillators.length, 1);
  const oscillator = context.oscillators[0];
  assert.equal(oscillator.frequency.value, midiToHz(62));
  assert.ok(Math.abs(oscillator.stops[0] - oscillator.started - 2) < 1e-9);
  context.currentTime = 1.04;
  assert.ok(Math.abs(transport.snapshot().tick - 240) < 1e-7);
});

test('pause/resume retains tick, fades current voices, and cancels sounds queued ahead', async t => {
  const context = new FakeContext();
  const transport = new AudioTransport(arrangement([note('one', 0, 480), note('two', 480, 480, 2)]), { countIn: false, metronome: false }, () => context as unknown as AudioContext);
  t.after(() => transport.dispose());
  await transport.play();
  context.currentTime = 0.98;
  const beforePause = transport.snapshot();
  assert.equal(context.oscillators.length, 2, 'Second note should already be scheduled on the audio clock.');
  transport.pause();
  assert.equal(transport.snapshot().state, 'paused');
  assert.equal(context.oscillators[1].stops.at(-1), 0.98, 'Future note must be cancelled before it starts.');
  assert.ok(Math.abs(context.oscillators[0].stops.at(-1)! - 0.992) < 1e-9);
  context.currentTime = 3;
  assert.equal(transport.snapshot().tick, beforePause.tick);
  await transport.play();
  context.currentTime = 3.14;
  assert.ok(Math.abs(transport.snapshot().tick - (beforePause.tick + 48)) < 1e-7);
});

test('loop boundaries are half-open and crossing notes are truncated', async t => {
  const context = new FakeContext();
  const transport = new AudioTransport(arrangement([note('crossing', 0, 960), note('outside', 960, 480, 2)]), { countIn: false, metronome: false, loop: true, startTick: 240, endTick: 480 }, () => context as unknown as AudioContext);
  t.after(() => transport.dispose());
  await transport.play();
  assert.equal(context.oscillators.length, 1);
  assert.equal(context.oscillators[0].stops[0], 0.54);
  context.currentTime = 0.5;
  transport.snapshot();
  assert.equal(context.oscillators.length, 2);
  assert.equal(context.oscillators[1].started, 0.54);
  context.currentTime = 0.54;
  assert.equal(transport.snapshot().tick, 240);
  assert.equal(transport.snapshot().cycles, 1);
  assert.equal(context.oscillators.length, 2, 'No duplicate note at exact loop boundary.');
});

test('one-bar 6/8 count-in uses quarter-note BPM, then rests and fractional durations retain timing', async t => {
  const context = new FakeContext();
  const transport = new AudioTransport(arrangement([{ id: 'rest', kind: 'rest', startTick: 0, durationTicks: 240 }, note('dotted', 240, 720)], { timeSignature: [6, 8] }), { metronome: false, countIn: true }, () => context as unknown as AudioContext);
  t.after(() => transport.dispose());
  await transport.play();
  assert.equal(transport.snapshot().state, 'countIn');
  for (const time of [0.45, 0.95, 1.45, 1.95, 2.45, 2.95]) { context.currentTime = time; transport.snapshot(); }
  assert.equal(context.oscillators.filter(value => !value.isReference).length, 6);
  context.currentTime = 3.04;
  assert.equal(transport.snapshot().state, 'playing');
  assert.equal(context.oscillators.filter(value => value.isReference).length, 0, 'Rest is silent.');
  context.currentTime = 3.45;
  transport.snapshot();
  const reference = context.oscillators.find(value => value.isReference)!;
  assert.ok(Math.abs(reference.started - 3.54) < 1e-9);
  assert.ok(Math.abs(reference.stops[0] - reference.started - 1.5) < 1e-9);
});

test('listen then repeat inserts a count-in and never plays reference during the repeat', async t => {
  const context = new FakeContext();
  const transport = new AudioTransport(arrangement([note('sa', 0, 480)]), { mode: 'repeat', countIn: false, metronome: false }, () => context as unknown as AudioContext);
  let completed = 0;
  transport.onComplete = () => completed++;
  t.after(() => transport.dispose());
  await transport.play();
  context.currentTime = 1.04;
  assert.equal(transport.snapshot().state, 'countIn');
  assert.equal(transport.snapshot().phase, 'repeat');
  context.currentTime = 5.04;
  assert.equal(transport.snapshot().phase, 'repeat');
  assert.equal(transport.snapshot().state, 'playing');
  assert.equal(context.oscillators.filter(value => value.isReference).length, 1);
  context.currentTime = 6.04;
  assert.equal(transport.snapshot().state, 'completed');
  assert.equal(transport.snapshot().activeSeconds, 2);
  assert.equal(transport.snapshot().cycles, 1);
  assert.equal(completed, 1);
  transport.snapshot();
  assert.equal(completed, 1);
});

test('microphone mode silences references, including after a mode change', async t => {
  const context = new FakeContext();
  const transport = new AudioTransport(arrangement([note('sa', 0, 960)]), { countIn: false, metronome: false }, () => context as unknown as AudioContext);
  t.after(() => transport.dispose());
  await transport.play();
  context.currentTime = 0.2;
  transport.configure({ mode: 'microphone' });
  context.currentTime = 0.5;
  assert.equal(transport.snapshot().state, 'playing');
  assert.equal(context.oscillators.length, 1);
  assert.ok(context.oscillators[0].stops.at(-1)! < 0.22);
});

test('seek and speed changes rebuild the schedule at the preserved musical position', async t => {
  const context = new FakeContext();
  const transport = new AudioTransport(arrangement([note('sa', 0, 480), note('re', 480, 480, 2)]), { countIn: false, metronome: false }, () => context as unknown as AudioContext);
  t.after(() => transport.dispose());
  await transport.play();
  context.currentTime = 0.44;
  const tick = transport.snapshot().tick;
  transport.configure({ speed: 0.5 });
  assert.equal(transport.snapshot().tick, tick);
  context.currentTime = 0.955;
  assert.ok(Math.abs(transport.snapshot().tick - tick - 120) < 1e-7);
  transport.seek(480);
  assert.equal(transport.snapshot().tick, 480);
  assert.equal(context.oscillators.at(-1)!.frequency.value, midiToHz(62));
});

test('three-minute synthetic-clock run has exact repeated onsets without cumulative timing drift', async t => {
  const context = new FakeContext();
  const transport = new AudioTransport(arrangement([note('sa', 0, 480)], { bpm: 120 }), { countIn: false, metronome: false, loop: true }, () => context as unknown as AudioContext);
  t.after(() => transport.dispose());
  await transport.play();
  for (let step = 1; step <= 9000; step++) { context.currentTime = step / 50; transport.snapshot(); }
  assert.ok(context.oscillators.length >= 360);
  for (const [index, oscillator] of context.oscillators.entries()) {
    assert.ok(Math.abs(oscillator.started - (0.04 + index * 0.5)) < 1e-8);
  }
  assert.ok(Math.abs(transport.snapshot().activeSeconds - 179.96) < 1e-8);
});

test('permission denial leaves the microphone unavailable with an actionable error', async t => {
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const originalSecure = Object.getOwnPropertyDescriptor(globalThis, 'isSecureContext');
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { mediaDevices: { getUserMedia: async () => { throw new DOMException('Denied', 'NotAllowedError'); } } } });
  Object.defineProperty(globalThis, 'isSecureContext', { configurable: true, value: true });
  const microphone = new Microphone(() => assert.fail('Denied input must never produce frames.'));
  t.after(() => {
    microphone.dispose();
    if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator); else Reflect.deleteProperty(globalThis, 'navigator');
    if (originalSecure) Object.defineProperty(globalThis, 'isSecureContext', originalSecure); else Reflect.deleteProperty(globalThis, 'isSecureContext');
  });
  await microphone.start();
  assert.equal(microphone.status, 'unavailable');
  assert.match(microphone.error, /permission was denied/);
});
