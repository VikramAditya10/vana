import { useEffect, useRef, useState } from 'react';
import { Button, DocumentHeader, Section, Status, Tag } from '@vikramaditya1010/react';
import {
  arrangements, getFingeringForNote, standardSixHoleFingerings,
  type Alteration, type Fingering, type Swara,
} from '../content/catalog';
import { FingeringDiagram } from '../components/Music';
import { AudioTransport } from '../audio/transport';
import { midiName, midiToHz } from '../audio/pitch';
import type { Settings } from '../storage/repository';

type Register = 'middle' | 'lower' | 'upper';

interface SwaraOption {
  swara: Swara;
  alteration: 'natural' | 'komal' | 'tivra';
  octave: -1 | 0 | 1;
  label: string;
  sublabel: string;
  semitones: number;
}

const REGISTER_OPTIONS: { id: Register; title: string; subtitle: string; octave: -1 | 0 | 1 }[] = [
  { id: 'middle', title: 'Madhya Saptak', subtitle: 'Middle octave (primary natural range)', octave: 0 },
  { id: 'lower', title: 'Mandra Saptak', subtitle: 'Lower octave (deep, meditative tones)', octave: -1 },
  { id: 'upper', title: 'Taar Saptak', subtitle: 'Upper octave (faster airstream, overblowing)', octave: 1 },
];

const SWARAS_BY_REGISTER: Record<Register, SwaraOption[]> = {
  middle: [
    { swara: 'Sa', alteration: 'natural', octave: 0, label: 'Sa', sublabel: 'Shuddh', semitones: 0 },
    { swara: 'Re', alteration: 'komal', octave: 0, label: 're', sublabel: 'Komal', semitones: 1 },
    { swara: 'Re', alteration: 'natural', octave: 0, label: 'Re', sublabel: 'Shuddh', semitones: 2 },
    { swara: 'Ga', alteration: 'komal', octave: 0, label: 'ga', sublabel: 'Komal', semitones: 3 },
    { swara: 'Ga', alteration: 'natural', octave: 0, label: 'Ga', sublabel: 'Shuddh', semitones: 4 },
    { swara: 'Ma', alteration: 'natural', octave: 0, label: 'Ma', sublabel: 'Shuddh', semitones: 5 },
    { swara: 'Ma', alteration: 'tivra', octave: 0, label: "Ma'", sublabel: 'Tivra', semitones: 6 },
    { swara: 'Pa', alteration: 'natural', octave: 0, label: 'Pa', sublabel: 'Shuddh', semitones: 7 },
    { swara: 'Dha', alteration: 'komal', octave: 0, label: 'dha', sublabel: 'Komal', semitones: 8 },
    { swara: 'Dha', alteration: 'natural', octave: 0, label: 'Dha', sublabel: 'Shuddh', semitones: 9 },
    { swara: 'Ni', alteration: 'komal', octave: 0, label: 'ni', sublabel: 'Komal', semitones: 10 },
    { swara: 'Ni', alteration: 'natural', octave: 0, label: 'Ni', sublabel: 'Shuddh', semitones: 11 },
  ],
  lower: [
    { swara: 'Pa', alteration: 'natural', octave: -1, label: 'P̣a', sublabel: 'Mandra Pa', semitones: -5 },
    { swara: 'Dha', alteration: 'komal', octave: -1, label: 'ḍha', sublabel: 'Mandra Komal Dha', semitones: -4 },
    { swara: 'Dha', alteration: 'natural', octave: -1, label: 'Ḍha', sublabel: 'Mandra Shuddh Dha', semitones: -3 },
    { swara: 'Ni', alteration: 'komal', octave: -1, label: 'ṉi', sublabel: 'Mandra Komal Ni', semitones: -2 },
    { swara: 'Ni', alteration: 'natural', octave: -1, label: 'Ṇi', sublabel: 'Mandra Shuddh Ni', semitones: -1 },
  ],
  upper: [
    { swara: 'Sa', alteration: 'natural', octave: 1, label: 'Ṡa', sublabel: 'Taar Sa', semitones: 12 },
    { swara: 'Re', alteration: 'komal', octave: 1, label: 'ṙe', sublabel: 'Taar Komal Re', semitones: 13 },
    { swara: 'Re', alteration: 'natural', octave: 1, label: 'Ṙe', sublabel: 'Taar Shuddh Re', semitones: 14 },
    { swara: 'Ga', alteration: 'komal', octave: 1, label: 'ġa', sublabel: 'Taar Komal Ga', semitones: 15 },
    { swara: 'Ga', alteration: 'natural', octave: 1, label: 'Ġa', sublabel: 'Taar Shuddh Ga', semitones: 16 },
    { swara: 'Ma', alteration: 'natural', octave: 1, label: 'Ṁa', sublabel: 'Taar Shuddh Ma', semitones: 17 },
    { swara: 'Ma', alteration: 'tivra', octave: 1, label: "Ṁa'", sublabel: 'Taar Tivra Ma', semitones: 18 },
    { swara: 'Pa', alteration: 'natural', octave: 1, label: 'Ṗa', sublabel: 'Taar Pa', semitones: 19 },
  ],
};

function holesSymbols(holes: Fingering['holes']): string {
  return holes.map(h => (h === 'closed' ? '●' : h === 'half' ? '◐' : '○')).join(' ');
}

export function FingeringPage({ settings }: { settings: Settings }) {
  const [register, setRegister] = useState<Register>('middle');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const player = useRef<AudioTransport | null>(null);

  useEffect(() => {
    const instance = new AudioTransport(arrangements[0], { countIn: false, referenceVolume: settings.referenceVolume });
    player.current = instance;
    return () => {
      instance.dispose();
      player.current = null;
    };
  }, [settings.referenceVolume]);

  const currentList = SWARAS_BY_REGISTER[register];
  const activeOption = currentList[selectedIdx] || currentList[0];
  const fingering = getFingeringForNote(
    activeOption.swara,
    activeOption.alteration,
    activeOption.octave,
  );

  const noteMidi = settings.saMidi + activeOption.semitones;
  const westernName = midiName(noteMidi);
  const frequencyHz = midiToHz(noteMidi).toFixed(1);

  async function playTone() {
    try {
      player.current?.pause();
      await player.current?.preview(noteMidi, 1.5);
    } catch {
      // Audio permission or device error
    }
  }

  return (
    <div className="fingering-page">
      <DocumentHeader
        kicker="TOOLS / BANSURI FINGERING GUIDE"
        title="Six-Hole Bansuri Fingering Chart"
        description="Traditional Hindustani finger placements for the standard six-hole bansuri (3-hole Sa convention). Inspect hole closures, hand assignments, and audition reference pitches."
        metadata={[
          ['CONVENTION', '3-HOLE SA (HINDUSTANI)'],
          ['SA TONIC', `${midiName(settings.saMidi)} (${midiToHz(settings.saMidi).toFixed(1)} Hz)`],
          ['OCTAVE', register.toUpperCase()],
        ]}
      />

      <div className="two-column">
        <div>
          <Section title="Select octave & swara" index="01" description="Choose a saptak and swara to see the fingerings.">
            {/* Register tabs */}
            <div className="button-row" style={{ marginBottom: 16 }}>
              {REGISTER_OPTIONS.map(reg => (
                <Button
                  key={reg.id}
                  variant={register === reg.id ? 'solid' : 'outline'}
                  onClick={() => {
                    setRegister(reg.id);
                    setSelectedIdx(0);
                  }}
                >
                  {reg.title}
                </Button>
              ))}
            </div>

            {/* Swara buttons */}
            <div className="swara-grid" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
              {currentList.map((item, idx) => (
                <button
                  key={`${item.swara}-${item.alteration}-${item.octave}`}
                  type="button"
                  className={`swara-btn ${selectedIdx === idx ? 'selected' : ''}`}
                  onClick={() => setSelectedIdx(idx)}
                  style={{
                    padding: '8px 14px',
                    border: '1px solid var(--dossier-rule, #dcd8d0)',
                    background: selectedIdx === idx ? 'var(--dossier-ink, #121212)' : 'var(--dossier-paper, #f7f5f0)',
                    color: selectedIdx === idx ? 'var(--dossier-paper, #f7f5f0)' : 'var(--dossier-ink, #121212)',
                    cursor: 'pointer',
                    borderRadius: 2,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    minWidth: 56,
                  }}
                >
                  <strong style={{ fontSize: 16 }}>{item.label}</strong>
                  <small style={{ fontSize: 9, opacity: 0.8 }}>{item.sublabel}</small>
                </button>
              ))}
            </div>

            {/* Fingering Diagram Card */}
            <div className="fingering-focus-card" style={{ border: '1px solid var(--dossier-rule, #dcd8d0)', padding: 18, background: 'var(--dossier-paper, #f7f5f0)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
                <div>
                  <span className="eyebrow">{activeOption.sublabel.toUpperCase()} · {register.toUpperCase()} OCTAVE</span>
                  <h2 style={{ fontSize: 28, margin: '4px 0' }}>
                    {activeOption.label} <small style={{ fontSize: 14, fontWeight: 'normal', color: 'var(--dossier-ink-muted, #737373)' }}>({westernName} · {frequencyHz} Hz)</small>
                  </h2>
                </div>
                <Button variant="solid" onClick={playTone}>
                  ♪ Hear note
                </Button>
              </div>

              <FingeringDiagram
                holes={fingering?.holes}
                noteLabel={`${activeOption.label} (${activeOption.sublabel})`}
                instruction={fingering?.instruction}
                register={fingering?.register}
              />
            </div>
          </Section>

          <Section title="Hand & finger placement guide" index="02">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div style={{ border: '1px solid var(--dossier-rule-light, #e8e4dc)', padding: 14, background: 'var(--dossier-paper-muted, #efece5)' }}>
                <Tag>HOLES 1, 2, 3</Tag>
                <h4 style={{ margin: '8px 0 4px' }}>Left Hand (Upper Hand)</h4>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 11, lineHeight: 1.6, color: 'var(--dossier-ink-soft, #4f4f4f)' }}>
                  <li><b>Hole 1:</b> Left index finger pad</li>
                  <li><b>Hole 2:</b> Left middle finger pad</li>
                  <li><b>Hole 3:</b> Left ring finger pad</li>
                  <li>Left thumb supports beneath hole 2</li>
                </ul>
              </div>

              <div style={{ border: '1px solid var(--dossier-rule-light, #e8e4dc)', padding: 14, background: 'var(--dossier-paper-muted, #efece5)' }}>
                <Tag>HOLES 4, 5, 6</Tag>
                <h4 style={{ margin: '8px 0 4px' }}>Right Hand (Lower Hand)</h4>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 11, lineHeight: 1.6, color: 'var(--dossier-ink-soft, #4f4f4f)' }}>
                  <li><b>Hole 4:</b> Right index finger pad</li>
                  <li><b>Hole 5:</b> Right middle finger pad</li>
                  <li><b>Hole 6:</b> Right ring finger pad</li>
                  <li>Right thumb supports beneath hole 4</li>
                </ul>
              </div>
            </div>
            <p className="fine-print" style={{ marginTop: 10 }}>
              Use the soft fleshy pads (phalanges) of the fingers rather than tips for a reliable airtight seal. Keep fingers flat and wrists relaxed.
            </p>
          </Section>
        </div>

        <aside>
          <Section title="Complete swara reference table" index="03" description="All 19 fingerings on standard 6-hole flute.">
            <div style={{ maxHeight: 680, overflowY: 'auto', border: '1px solid var(--dossier-rule, #dcd8d0)', background: 'var(--dossier-paper, #f7f5f0)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr style={{ background: 'var(--dossier-paper-muted, #efece5)', textAlign: 'left', borderBottom: '1px solid var(--dossier-rule, #dcd8d0)' }}>
                    <th style={{ padding: '8px 10px' }}>Swara</th>
                    <th style={{ padding: '8px 10px' }}>Pitch</th>
                    <th style={{ padding: '8px 10px' }}>Holes (1–6)</th>
                    <th style={{ padding: '8px 10px' }}>Register</th>
                  </tr>
                </thead>
                <tbody>
                  {standardSixHoleFingerings.map(f => {
                    const isSelected = fingering?.id === f.id;
                    const semitoneOffset = f.id.startsWith('sa') ? 0
                      : f.id.startsWith('re-komal') ? 1
                      : f.id.startsWith('re') ? 2
                      : f.id.startsWith('ga-komal') ? 3
                      : f.id.startsWith('ga') ? 4
                      : f.id.startsWith('ma-tivra') ? 6
                      : f.id.startsWith('ma') ? 5
                      : f.id.startsWith('pa') ? 7
                      : f.id.startsWith('dha-komal') ? 8
                      : f.id.startsWith('dha') ? 9
                      : f.id.startsWith('ni-komal') ? 10
                      : 11;
                    const octaveOffset = f.register === 'lower' ? -12 : f.register === 'upper' ? 12 : 0;
                    const pitchMidi = settings.saMidi + semitoneOffset + octaveOffset;

                    return (
                      <tr
                        key={f.id}
                        style={{
                          borderBottom: '1px solid var(--dossier-rule-light, #e8e4dc)',
                          background: isSelected ? 'color-mix(in srgb, var(--dossier-accent-blue, #0d63b8) 10%, transparent)' : 'transparent',
                        }}
                      >
                        <td style={{ padding: '8px 10px', fontWeight: 600 }}>
                          {f.id.split('-')[0].toUpperCase()} {f.id.includes('komal') ? '(k)' : f.id.includes('tivra') ? '(t)' : ''}
                        </td>
                        <td style={{ padding: '8px 10px', color: 'var(--dossier-ink-muted, #737373)' }}>
                          {midiName(pitchMidi)}
                        </td>
                        <td style={{ padding: '8px 10px', fontFamily: 'monospace', letterSpacing: 1.5 }}>
                          {holesSymbols(f.holes)}
                        </td>
                        <td style={{ padding: '8px 10px' }}>
                          <Status tone={f.register === 'middle' ? 'success' : f.register === 'lower' ? 'neutral' : 'info'}>
                            {f.register}
                          </Status>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="fine-print" style={{ marginTop: 8 }}>
              Legend: ● Closed hole &nbsp; ◐ Half-covered hole &nbsp; ○ Open hole
            </p>
          </Section>
        </aside>
      </div>
    </div>
  );
}
