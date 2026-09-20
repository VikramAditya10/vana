import { detectPitch } from './pitch';

type WorkMessage = { samples: Float32Array; sampleRate: number; time: number; generation: number };

self.onmessage = (event: MessageEvent<WorkMessage>) => {
  const { samples, sampleRate, time, generation } = event.data;
  self.postMessage({ ...detectPitch(samples, sampleRate), time, generation });
};
