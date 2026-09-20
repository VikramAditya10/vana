import type { Arrangement } from '../content/catalog';
import { midiToHz, centsError } from '../audio/pitch';

/** 20 ms expected windows; silence remains in the coverage denominator. */
export class PracticeScorer {
  private bins = new Map<number, { hz: number; assessed: boolean; correct: boolean }>();
  private previousTime: number | null = null;
  private previousFrameTime: number | null = null;
  activeSeconds = 0;
  constructor(private arrangement: Arrangement, private saMidi: number, private tolerance: number, private latencyMs: number) {}
  advance(tick: number, time: number, playing: boolean, secondsPerTick: number) {
    const last = this.previousTime;
    this.previousTime = time;
    if (!playing || last === null || time - last > .15 || time <= last) return;
    this.activeSeconds += time - last;
    for (let bin = Math.ceil(last / .02); bin * .02 < time; bin++) {
      const eventTick = tick - (time - bin * .02) / secondsPerTick;
      const event = this.arrangement.events.find(e => e.kind === 'note' && eventTick >= e.startTick && eventTick < e.startTick + e.durationTicks);
      if (!event || event.kind !== 'note' || (eventTick - event.startTick) * secondsPerTick < Math.min(.1, event.durationTicks * secondsPerTick * .2)) continue;
      this.bins.set(bin, { hz: midiToHz(this.saMidi + event.semitonesFromSa), assessed: false, correct: false });
    }
  }
  observe(frame: { hz: number | null; confidence: number; time: number }) {
    const time = frame.time - this.latencyMs / 1000;
    const start = Math.max(time - .065, this.previousFrameTime ?? time - .03);
    this.previousFrameTime = time;
    if (!frame.hz || frame.confidence < .8) return;
    for (let key = Math.floor(start / .02); key <= Math.floor(time / .02); key++) {
      const bin = this.bins.get(key);
      if (!bin || bin.assessed) continue;
      bin.assessed = true;
      bin.correct = Math.abs(centsError(frame.hz, bin.hz)) <= this.tolerance;
    }
  }
  result() {
    const bins = [...this.bins.values()];
    const assessed = bins.filter(b => b.assessed);
    const coverage = bins.length ? 100 * assessed.length / bins.length : 0;
    return { coverage, pitchAccuracy: coverage >= 40 && assessed.length >= 10 ? 100 * assessed.filter(b => b.correct).length / assessed.length : null, rhythmMs: null };
  }
}
