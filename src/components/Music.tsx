import { useEffect, useRef, useState } from 'react';
import { Button, Status } from '@vikramaditya1010/react';
import { Microphone } from '../audio/microphone';
import { centsError, hzToMidi, midiName } from '../audio/pitch';

export type PitchFrame = { hz: number | null; confidence: number; rms: number; time: number };

export function useMicrophone(onFrame?: (frame: PitchFrame) => void) {
  const [frame, setFrame] = useState<PitchFrame>({ hz: null, confidence: 0, rms: 0, time: 0 });
  const [status, setStatus] = useState('off');
  const [error, setError] = useState('');
  const mic = useRef<Microphone | null>(null);
  const callback = useRef(onFrame);
  callback.current = onFrame;
  useEffect(() => {
    const instance = new Microphone(value => { setFrame(value); callback.current?.(value); });
    mic.current = instance;
    const timer = window.setInterval(() => { setStatus(instance.status); setError(instance.error); }, 120);
    const hide = () => { if (document.hidden) instance.stop(); };
    document.addEventListener('visibilitychange', hide);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', hide); instance.stop(); mic.current = null; };
  }, []);
  return { frame, status, error, start: async () => { setStatus('permission needed'); try { await mic.current?.start(); } catch (e) { setError(e instanceof Error ? e.message : 'Microphone unavailable'); } if (mic.current) { setStatus(mic.current.status); setError(mic.current.error); } }, stop: () => { mic.current?.stop(); setStatus('off'); setFrame({ hz: null, confidence: 0, rms: 0, time: 0 }); }, calibrate: () => mic.current?.calibrate(), actualSettings: () => mic.current?.actualSettings };
}

export function FingeringDiagram({ compact = false, holes, noteLabel }: { compact?: boolean; holes?: ('open' | 'closed' | 'half')[]; noteLabel?: string }) {
  const hasHoles = Boolean(holes && holes.length === 6);
  return <figure className={`flute-figure ${compact ? 'compact' : ''}`}>
    <div className="flute-figure-header">
      <span className="eyebrow">SIX-HOLE BANSURI {noteLabel ? `· ${noteLabel.toUpperCase()}` : '· ANATOMY'}</span>
      {hasHoles ? <span className="hole-summary">{holes!.map((h, i) => `H${i + 1}:${h[0].toUpperCase()}`).join(' ')}</span> : null}
    </div>
    <svg viewBox="0 0 480 140" role="img" aria-label={hasHoles ? `Six-hole transverse bansuri fingering for ${noteLabel || 'note'}: ${holes!.map((h, i) => `hole ${i + 1} is ${h}`).join(', ')}` : "Six-hole transverse bansuri: blowing hole at the left, finger holes numbered one to six from the blowing end. No verified fingering pattern is available."}>
      <defs>
        <linearGradient id="half-hole" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="50%" stopColor="var(--dossier-ink)" />
          <stop offset="50%" stopColor="var(--dossier-paper)" />
        </linearGradient>
      </defs>
      {/* Bamboo tube */}
      <path d="M25 58 Q23 51 31 50 H450 Q460 50 460 60 V84 Q460 92 450 92 H31 Q23 92 25 84 Z" fill="var(--dossier-paper-muted)" stroke="currentColor" strokeWidth="1.5" />
      {/* Traditional decorative thread bindings */}
      <path d="M40 51V91 M47 51V91 M112 51V91 M118 51V91 M432 51V91 M438 51V91" stroke="currentColor" opacity=".3" />
      {/* Blow hole */}
      <ellipse cx="72" cy="71" rx="14" ry="9" fill="var(--dossier-ink)" />
      <path d="M72 42V22 M67 27L72 22L77 27" fill="none" stroke="currentColor" />
      <text x="72" y="14" textAnchor="middle" className="svg-label">BLOWING END</text>
      {/* Six finger holes */}
      {[164, 211, 258, 305, 352, 399].map((x, i) => {
        const state = holes?.[i];
        return (
          <g key={i}>
            <circle
              cx={x}
              cy="71"
              r="10"
              fill={state === 'closed' ? 'var(--dossier-ink)' : state === 'half' ? 'url(#half-hole)' : 'var(--dossier-paper)'}
              stroke="currentColor"
              strokeWidth="1.5"
              strokeDasharray={!hasHoles ? '2 2' : undefined}
            />
            {!hasHoles && <text x={x} y="75" textAnchor="middle" className="svg-question">?</text>}
            <text x={x} y="116" textAnchor="middle" className="svg-number">{i + 1}</text>
          </g>
        );
      })}
    </svg>
    <figcaption>
      {hasHoles ? (
        <div className="hole-text-grid">
          {holes!.map((state, i) => (
            <span key={i} className={`hole-pill hole-${state}`}>Hole {i + 1}: <b>{state}</b></span>
          ))}
        </div>
      ) : (
        <>
          <Status tone="warning">Fingering not available</Status>
          <span>Hole 1 is nearest the blowing end. A teacher-reviewed profile is needed before covered holes can be shown.</span>
        </>
      )}
    </figcaption>
  </figure>;
}

export function PitchMeter({ frame, targetHz, tolerance = 50, status }: { frame: PitchFrame; targetHz: number; tolerance?: number; status: string }) {
  const valid = status === 'listening' && frame.hz !== null && frame.confidence >= .8;
  const cents = valid ? centsError(frame.hz!, targetHz) : null;
  return <div className="pitch-meter">
    <div className="pitch-reading"><strong>{valid ? midiName(Math.round(hzToMidi(frame.hz!))) : '—'}</strong><span>{valid ? `${frame.hz!.toFixed(1)} Hz` : 'Waiting for a clear tone'}</span><Status tone={cents !== null && Math.abs(cents) <= tolerance ? 'success' : 'neutral'}>{cents !== null ? `${cents > 0 ? '+' : ''}${Math.round(cents)} cents` : status}</Status></div>
    <div className="tuning-scale" aria-label={cents === null ? 'No clear pitch detected' : `${Math.round(cents)} cents from reference`}><span className="tuning-target" /><i style={{ left: `${50 + Math.max(-50, Math.min(50, (cents ?? 0) / 2))}%`, visibility: cents === null ? 'hidden' : 'visible' }} /></div>
    <div className="scale-labels"><span>♭ LOW</span><span>IN TUNE · ±{tolerance}¢</span><span>HIGH ♯</span></div>
    <p className="fine-print">Target {targetHz.toFixed(1)} Hz · Confidence {valid ? `${Math.round(frame.confidence * 100)}%` : '—'}</p>
  </div>;
}

export function MicControls({ mic }: { mic: ReturnType<typeof useMicrophone> }) {
  const active = ['listening', 'low signal', 'calibrating', 'permission needed'].includes(mic.status);
  return <><div className="button-row"><Button variant={active ? 'outline' : 'solid'} onClick={() => active ? mic.stop() : void mic.start()}>{active ? 'Turn microphone off' : 'Enable microphone'}</Button>{active && <Button onClick={mic.calibrate}>Calibrate noise</Button>}</div><p className="fine-print">{mic.status === 'calibrating' ? 'Stay quiet while the room noise is measured.' : 'Audio is processed on this device. Headphones help keep the metronome out of your microphone.'}</p>{mic.error && <p role="alert" className="error-text">{mic.error}</p>}</>;
}
