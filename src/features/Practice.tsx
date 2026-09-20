import { useEffect, useRef, useState } from 'react';
import { Button, Callout, Checkbox, Drawer, NumberInput, Progress, Select, Status } from '@vikramaditya1010/react';
import { arrangements, type Arrangement } from '../content/catalog';
import { AudioTransport } from '../audio/transport';
import { midiName, midiToHz } from '../audio/pitch';
import { saveAttempt, type Settings, type Attempt } from '../storage/repository';
import { FingeringDiagram, MicControls, PitchMeter, useMicrophone } from '../components/Music';
import { PracticeScorer } from './scoring';

type Mode = 'listen' | 'follow' | 'repeat' | 'microphone';
const modes: { id: Mode; label: string; hint: string }[] = [
  { id: 'listen', label: 'Listen', hint: 'Hear the melody and follow each note. Select any note to move there.' },
  { id: 'follow', label: 'Play along', hint: 'Join the reference with your flute. You can mute the melody in Sound & tempo.' },
  { id: 'repeat', label: 'Listen & repeat', hint: 'Hear the phrase, then play it back during the silent turn.' },
  { id: 'microphone', label: 'Microphone', hint: 'Play with live pitch feedback. The reference melody is muted during your attempt.' },
];
export const timeLabel = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

export function Practice({ arrangement, settings, updateSettings, onSaved }: { arrangement: Arrangement; settings: Settings; updateSettings: (value: Partial<Settings>) => void; onSaved: () => void }) {
  const [phraseId, setPhraseId] = useState('all');
  const [mode, setMode] = useState<Mode>('listen');
  const [bpm, setBpm] = useState(arrangement.bpm);
  const [speed, setSpeed] = useState(1);
  const [loop, setLoop] = useState(false);
  const [metronome, setMetronome] = useState(true);
  const [drawer, setDrawer] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const endOfScore = Math.max(...arrangement.events.map(n => n.startTick + n.durationTicks));
  const phrase = arrangement.phrases.find(p => p.id === phraseId);
  const startTick = phrase?.startTick ?? 0;
  const endTick = phrase?.endTick ?? endOfScore;
  const transport = useRef<AudioTransport | null>(null);
  const scorer = useRef(new PracticeScorer(arrangement, settings.saMidi, settings.toleranceCents, settings.latencyMs));
  const startedAt = useRef(new Date().toISOString());
  const attemptId = useRef(crypto.randomUUID());
  const [snap, setSnap] = useState({ state: 'idle' as string, tick: 0, beat: 1, count: 0, phase: 'listen' as string, activeSeconds: 0, cycles: 0 });
  const current = useRef({ settings, bpm, speed, mode, phraseId, onSaved });
  current.current = { settings, bpm, speed, mode, phraseId, onSaved };
  const mic = useMicrophone(frame => { if (current.current.mode === 'microphone') scorer.current.observe(frame); });
  const micStop = useRef(mic.stop); micStop.current = mic.stop;
  const spt = 60 / (bpm * speed * 480);

  async function save(completed = false, announce = true) {
    if (scorer.current.activeSeconds < .25) { if (announce) setNotice('Play a little first, then save your practice.'); return; }
    const c = current.current;
    const result = c.mode === 'microphone' ? scorer.current.result() : { pitchAccuracy: null, coverage: null, rhythmMs: null };
    const attempt: Attempt = { id: attemptId.current, arrangementId: arrangement.id, arrangementVersion: arrangement.version, phraseId: c.phraseId, saMidi: c.settings.saMidi, bpm: c.bpm, speed: c.speed, mode: c.mode, startedAt: startedAt.current, activeSeconds: scorer.current.activeSeconds, completed, ...result, scoringVersion: 'pitch-windows-1', latencyMs: c.settings.latencyMs, toleranceCents: c.settings.toleranceCents };
    try { await saveAttempt(attempt); c.onSaved(); if (announce) setNotice(completed ? 'Exercise complete. Your practice is saved.' : 'Practice saved on this device.'); }
    catch { if (announce) setError('Your browser could not save this session. Try exporting your data from Settings.'); }
  }
  const saveRef = useRef(save); saveRef.current = save;
  function newAttempt() { void saveRef.current(false, false); scorer.current = new PracticeScorer(arrangement, settings.saMidi, settings.toleranceCents, settings.latencyMs); attemptId.current = crypto.randomUUID(); startedAt.current = new Date().toISOString(); setNotice(''); }

  useEffect(() => {
    const engine = new AudioTransport(arrangement, { saMidi: settings.saMidi, bpm: arrangement.bpm, speed: 1, loop: false, countIn: settings.countIn, metronome: true, referenceVolume: settings.referenceVolume, metronomeVolume: settings.metronomeVolume, mode: 'listen', startTick: 0, endTick: endOfScore });
    transport.current = engine;
    engine.onComplete = () => { micStop.current(); window.setTimeout(() => void saveRef.current(true), 40); };
    let frame = 0;
    const render = () => {
      const next = engine.snapshot();
      const c = current.current;
      scorer.current.advance(next.tick, performance.now() / 1000, next.state === 'playing', 60 / (c.bpm * c.speed * 480));
      setSnap(next);
      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);
    const hide = () => { if (document.hidden) { engine.pause(); void saveRef.current(false, false); setNotice('Practice paused while the page was in the background. Press Play to resume.'); } };
    document.addEventListener('visibilitychange', hide);
    return () => { void saveRef.current(false, false); cancelAnimationFrame(frame); document.removeEventListener('visibilitychange', hide); engine.onComplete = undefined; engine.dispose(); transport.current = null; };
  }, [arrangement]);

  useEffect(() => { transport.current?.configure({ saMidi: settings.saMidi, bpm, speed, loop, countIn: settings.countIn, metronome, referenceVolume: settings.referenceVolume, metronomeVolume: settings.metronomeVolume, mode, startTick, endTick }); }, [settings, bpm, speed, loop, metronome, mode, startTick, endTick]);

  async function play() {
    if (busy) return;
    const engine = transport.current;
    if (!engine) return;
    if (['playing', 'countIn'].includes(engine.snapshot().state)) { engine.pause(); return; }
    setBusy(true); setError('');
    try { if (engine.snapshot().state === 'completed') newAttempt(); await engine.play(); } catch { setError('Sound could not start. Check your browser audio permissions and press Play again.'); } finally { setBusy(false); }
  }
  const playRef = useRef(play); playRef.current = play;
  useEffect(() => {
    const key = (event: KeyboardEvent) => { const target = event.target as HTMLElement; if (event.code === 'Space' && !/INPUT|TEXTAREA|SELECT|BUTTON|A/.test(target.tagName) && !target.isContentEditable && !document.querySelector('dialog[open]')) { event.preventDefault(); void playRef.current(); } };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  }, []);
  const active = arrangement.events.find(n => snap.tick >= n.startTick && snap.tick < n.startTick + n.durationTicks) ?? arrangement.events.filter(n => n.startTick >= startTick)[0];
  const visibleEvents = arrangement.events.filter(n => n.startTick < endTick && n.startTick + n.durationTicks > startTick);
  const upcoming = visibleEvents.filter(n => n.startTick > (active?.startTick ?? 0)).slice(0, 2);
  const isPlaying = ['playing', 'countIn'].includes(snap.state);
  const eventName = active?.kind === 'note' ? active.swara : 'Rest';
  const currentHz = active?.kind === 'note' ? midiToHz(settings.saMidi + active.semitonesFromSa) : midiToHz(settings.saMidi);
  const duration = active ? active.durationTicks / 480 : 0;
  const beatInBar = Math.floor(snap.tick / 480) % arrangement.timeSignature[0];
  function choosePhrase(id: string) { transport.current?.pause(); newAttempt(); setPhraseId(id); const next = arrangement.phrases.find(p => p.id === id); transport.current?.seek(next?.startTick ?? 0); }
  function changeMode(next: Mode) { transport.current?.pause(); newAttempt(); mic.stop(); setMode(next); }
  const settingsPanel = <div className="sound-settings">
    <label>Tempo · quarter notes / minute<NumberInput aria-label="Tempo" min={30} max={180} value={bpm} onChange={e => { const value = Number(e.target.value); if (value >= 30 && value <= 180) { newAttempt(); setBpm(value); } }} /></label>
    <label>Playback speed<Select aria-label="Playback speed" value={speed} onChange={e => { newAttempt(); setSpeed(Number(e.target.value)); }}><option value="0.5">0.50× · half speed</option><option value="0.75">0.75× · take it slowly</option><option value="1">1.00× · original speed</option><option value="1.25">1.25× · a little faster</option></Select></label>
    <label>Fine speed adjustment · {speed.toFixed(2)}×<input aria-label="Fine speed adjustment" type="range" min="0.5" max="1.5" step="0.05" value={speed} onChange={e => { newAttempt(); setSpeed(Number(e.target.value)); }} /></label>
    <Checkbox label="One-bar count-in" checked={settings.countIn} onChange={e => updateSettings({ countIn: e.target.checked })} />
    <Checkbox label="Metronome" checked={metronome} onChange={e => setMetronome(e.target.checked)} />
    <label>Reference volume · {Math.round(settings.referenceVolume * 100)}%<input aria-label="Reference volume" type="range" min="0" max="1" step="0.05" value={settings.referenceVolume} disabled={mode === 'microphone'} onChange={e => updateSettings({ referenceVolume: Number(e.target.value) })} /></label>
    <label>Metronome volume · {Math.round(settings.metronomeVolume * 100)}%<input aria-label="Metronome volume" type="range" min="0" max="1" step="0.05" value={settings.metronomeVolume} onChange={e => updateSettings({ metronomeVolume: Number(e.target.value) })} /></label>
    <p className="fine-print">Slower playback keeps the same pitch. Sound is a synthesized teaching tone. Equal temperament is a reference, not a complete model of Hindustani intonation.</p>
  </div>;

  return <section className="practice-room" aria-label="Practice room">
    <div className="practice-title"><div><span className="eyebrow">YOUR DAILY PRACTICE / ORIGINAL EXERCISE</span><h1>{arrangement.title}</h1><p>{arrangement.description}</p></div><Status tone="success">Ready to play</Status></div>
    <div className="practice-facts"><span>SA <b>{midiName(settings.saMidi)}</b></span><span>FLUTE <b>6-HOLE TRANSVERSE</b></span><span>ORIGINAL <b>{arrangement.bpm} BPM</b></span><span>PLAYING AT <b>{Math.round(bpm * speed)} BPM</b></span><span>METER <b>{arrangement.timeSignature.join('/')}</b></span></div>
    <div className="practice-layout"><aside className="phrase-nav"><label className="eyebrow" htmlFor="exercise">EXERCISE</label><Select id="exercise" value={arrangement.id} onChange={e => { window.location.hash = `/practice/${e.target.value}`; }}>{arrangements.map(a => <option key={a.id} value={a.id}>{a.title}</option>)}</Select><div className="eyebrow phrase-label">PHRASES</div><button className={phraseId === 'all' ? 'selected' : ''} onClick={() => choosePhrase('all')}><span>00</span> Whole exercise<small>{endOfScore / 480} beats</small></button>{arrangement.phrases.map((p, i) => <button className={phraseId === p.id ? 'selected' : ''} key={p.id} onClick={() => choosePhrase(p.id)}><span>{String(i + 1).padStart(2, '0')}</span>{p.label}<small>{(p.endTick - p.startTick) / 480} beats</small></button>)}<div className="practice-tip"><span className="eyebrow">A SMALL REMINDER</span><p>Easy breath.<br />Soft shoulders.<br />One note at a time.</p><a href="#/learn">Build your foundation ↗</a></div></aside>
      <div className="practice-center"><div className="mode-tabs" role="group" aria-label="Practice mode">{modes.map(m => <button key={m.id} aria-pressed={mode === m.id} className={mode === m.id ? 'selected' : ''} onClick={() => changeMode(m.id)}>{m.label}</button>)}</div><p className="mode-description">{modes.find(m => m.id === mode)?.hint}</p>
        <div className="note-stage"><div className="active-note"><div className="eyebrow">{snap.state === 'countIn' ? 'GET READY · COUNT-IN' : snap.state === 'completed' ? 'NICELY PRACTISED' : snap.state === 'playing' ? mode === 'repeat' && snap.phase === 'repeat' ? 'YOUR TURN' : 'PLAY THIS NOTE' : 'YOUR NEXT NOTE'}</div><div className="note-name">{snap.state === 'countIn' ? snap.count : snap.state === 'completed' ? '✓' : eventName}<sup>{active?.kind === 'note' && active.octave !== 0 ? active.octave === 1 ? '·' : '̣' : ''}</sup></div><div className="note-subtitle">{active?.kind === 'note' ? `${active.octave === 0 ? 'Middle' : active.octave === 1 ? 'Upper' : 'Lower'} octave${settings.showWestern ? ` / ${midiName(settings.saMidi + active.semitonesFromSa)}` : ''}` : 'Leave space for breath'}</div><span className="hold-label">HOLD {duration} {duration === 1 ? 'BEAT' : 'BEATS'}</span><Button variant="ghost" disabled={mode === 'microphone' || isPlaying || active?.kind !== 'note'} onClick={() => { if (active?.kind === 'note') void transport.current?.preview(settings.saMidi + active.semitonesFromSa, .8).catch(() => setError('Reference tone could not start.')); }}>♪ Hear this note</Button></div><div className="fingering-stage"><FingeringDiagram /><div className="upcoming"><span className="eyebrow">UP NEXT</span>{upcoming.length ? upcoming.map(n => <span key={n.id}><b>{n.kind === 'note' ? n.swara : 'Rest'}</b><small>{n.durationTicks / 480} beats</small></span>) : <span className="fine-print">Finish with a relaxed breath.</span>}</div></div></div>
        <div className="timeline-heading"><span className="eyebrow">FOLLOW THE PHRASE</span><span>BAR {Math.floor(snap.tick / (480 * arrangement.timeSignature[0])) + 1} · BEAT {beatInBar + 1}</span></div>
        <div className="sargam-timeline" aria-label="Sargam timeline">{visibleEvents.map(n => <button key={n.id} aria-label={`${n.kind === 'note' ? n.swara : 'Rest'}, ${n.durationTicks / 480} beats; seek here`} aria-current={n.id === active?.id ? 'step' : undefined} className={`${n.id === active?.id ? 'active' : ''} ${n.startTick < snap.tick ? 'past' : ''}`} style={{ flexGrow: n.durationTicks / 480 }} onClick={() => { newAttempt(); transport.current?.seek(n.startTick); }}><span>{n.kind === 'note' ? n.swara : '—'}</span><small>{n.durationTicks / 480}b</small>{arrangement.breathMarks.some(b => b.tick === n.startTick + n.durationTicks) && <i title="Breathe after this event">’</i>}</button>)}</div>
        <div className="beat-row"><div className="beat-grid" aria-label={`Beat ${beatInBar + 1} of ${arrangement.timeSignature[0]}`}>{Array.from({ length: arrangement.timeSignature[0] }, (_, i) => <span className={i === beatInBar ? 'lit' : ''} key={i}>{i + 1}</span>)}</div><span className="fine-print">— rest &nbsp; ’ breath &nbsp; · upper octave</span><span className="fine-print">{mode === 'microphone' ? `Microphone ${mic.status}` : 'Synthesized reference'}</span></div>
        {mode === 'microphone' && <div className="mic-panel"><PitchMeter frame={mic.frame} targetHz={currentHz} status={mic.status} tolerance={settings.toleranceCents} /><MicControls mic={mic} /><p className="fine-print">Pitch feedback is provisional. Rhythm scoring is unavailable. Silence and low-confidence audio do not count as correct.</p></div>}
      </div></div>
    <div className="transport"><div className="transport-progress"><Progress value={Math.max(0, Math.min(100, (snap.tick - startTick) / (endTick - startTick) * 100))} label="Phrase progress" showValue={false} /><span>{timeLabel(Math.max(0, snap.tick - startTick) * spt)} / {timeLabel((endTick - startTick) * spt)}</span></div><div className="transport-actions"><div className="button-row"><Button variant="solid" className="play-button" onClick={() => void play()} disabled={busy}>{isPlaying ? 'Ⅱ Pause' : '▶ Play phrase'}</Button><Button aria-label="Restart phrase" onClick={() => { newAttempt(); void transport.current?.restart().catch(() => setError('Sound could not restart.')); }}>↺ Restart</Button></div><div className="transport-options"><Checkbox label="Loop phrase" checked={loop} onChange={e => setLoop(e.target.checked)} /><Button onClick={() => setDrawer(true)}>Sound & tempo</Button><Button onClick={() => { transport.current?.pause(); mic.stop(); void save(); }}>Save practice</Button></div></div><div className="transport-caption"><span>{snap.state === 'countIn' ? `Count-in ${snap.count}` : snap.state === 'paused' ? 'Paused · resume when you are ready' : snap.state === 'completed' ? 'Complete' : `${phrase?.label ?? 'Whole exercise'} · ${mode === 'repeat' ? snap.phase === 'repeat' ? 'Your turn' : 'Listening turn' : modes.find(m => m.id === mode)?.label}`}</span><span>SPACE TO PLAY / PAUSE</span></div></div>
    {notice && <p className="notice" role="status">✓ {notice}</p>}{error && <Callout tone="danger" title="Audio needs attention">{error}</Callout>}
    <Drawer title="Sound & tempo" open={drawer} onOpenChange={setDrawer}>{settingsPanel}</Drawer>
  </section>;
}
