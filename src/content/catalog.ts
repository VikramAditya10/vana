/** Original teaching material. Instruction and fingerings still need a bansuri teacher's review. */
export const APP_NAME = 'Bansuri Practice';
export const PPQ = 480 as const;

export type Swara = 'Sa' | 'Re' | 'Ga' | 'Ma' | 'Pa' | 'Dha' | 'Ni';
export type HoleState = 'open' | 'closed' | 'half';
export type ScoreEvent = {
  id: string;
  startTick: number;
  durationTicks: number;
} & ({
  kind: 'note';
  swara: Swara;
  alteration: 'natural' | 'komal' | 'tivra';
  octave: -1 | 0 | 1;
  semitonesFromSa: number;
  fingeringId?: string;
  articulation?: 'normal' | 'tongued' | 'legato';
} | { kind: 'rest' });

export type Fingering = {
  id: string;
  profileId: string;
  holes: [HoleState, HoleState, HoleState, HoleState, HoleState, HoleState];
  register: 'lower' | 'middle' | 'upper';
  instruction?: string;
  verifiedBy?: string;
};

export const fingeringProfiles: {
  id: string;
  name: string;
  convention: string;
  reviewStatus: string;
  fingerings: Fingering[];
}[] = [{
  id: 'six-hole-unverified',
  name: 'Six-hole transverse bansuri',
  convention: 'Six finger holes numbered 1–6 from the blowing end. Sa and hole patterns must be established with a teacher for your instrument; a printed scale is not a fingering convention.',
  reviewStatus: 'awaiting teacher review',
  fingerings: [],
}];

/** Return only an explicitly reviewed fingering, never a pattern guessed from a note name. */
export function resolveFingering(profileId: string, fingeringId?: string): Fingering | undefined {
  if (!fingeringId) return undefined;
  return fingeringProfiles.find(profile => profile.id === profileId)?.fingerings
    .find(fingering => fingering.id === fingeringId && Boolean(fingering.verifiedBy));
}

export type Arrangement = {
  id: string;
  songId?: string;
  version: number;
  title: string;
  description: string;
  status: 'draft' | 'verified' | 'published';
  reviewStatus: string;
  difficulty: 'Beginner' | 'Early intermediate';
  prerequisites: string[];
  language: 'Instrumental';
  noteRange: string;
  ppq: 480;
  bpm: number;
  timeSignature: [number, number];
  referenceSaMidi: number;
  instrumentProfileIds: string[];
  events: ScoreEvent[];
  phrases: { id: string; label: string; startTick: number; endTick: number }[];
  breathMarks: { tick: number; text?: string }[];
  source: { author: string; reference?: string; permissionStatus: string };
  credits: string[];
  arrangementAuthor: string;
  arrangementType: string;
  audioAssets: { kind: 'synthesised'; author: string; permissionStatus: string; description: string }[];
};

const semitones: Record<Swara, number> = { Sa: 0, Re: 2, Ga: 4, Ma: 5, Pa: 7, Dha: 9, Ni: 11 };
type WrittenNote = [swara: Swara | 'rest', beats: number, octave?: -1 | 0 | 1, articulation?: 'normal' | 'tongued' | 'legato'];

function score(id: string, notes: WrittenNote[]): ScoreEvent[] {
  let tick = 0;
  return notes.map(([swara, beats, octave = 0, articulation = 'normal'], index): ScoreEvent => {
    const base = { id: `${id}-event-${index + 1}`, startTick: tick, durationTicks: beats * PPQ };
    tick += base.durationTicks;
    return swara === 'rest' ? { ...base, kind: 'rest' } : {
      ...base, kind: 'note', swara, octave, alteration: 'natural',
      semitonesFromSa: semitones[swara] + octave * 12, articulation,
    };
  });
}

function exercise(
  id: string, title: string, description: string, bpm: number, notes: WrittenNote[],
  phraseDefinitions: [string, number, number][], noteRange: string, prerequisites: string[],
  difficulty: Arrangement['difficulty'] = 'Beginner',
): Arrangement {
  const events = score(id, notes);
  return {
    id, version: 1, title, description, difficulty, prerequisites,
    language: 'Instrumental', noteRange, status: 'draft',
    reviewStatus: 'Original exercise · awaiting teacher review',
    ppq: PPQ, bpm, timeSignature: [4, 4], referenceSaMidi: 60,
    instrumentProfileIds: ['six-hole-unverified'], events,
    phrases: phraseDefinitions.map(([label, startBeat, endBeat], i) => ({
      id: `${id}-phrase-${i + 1}`, label, startTick: startBeat * PPQ, endTick: endBeat * PPQ,
    })),
    breathMarks: events.filter(event => event.kind === 'rest').map(event => ({
      tick: event.startTick, text: 'Release the breath; inhale comfortably if needed.',
    })),
    source: {
      author: 'Bansuri Practice',
      permissionStatus: 'Original teaching exercise composed for this application; not a transcription of a commercial song.',
    },
    credits: ['Original score: Bansuri Practice', 'Teaching content: draft; teacher review pending'],
    arrangementAuthor: 'Bansuri Practice',
    arrangementType: 'Original teaching study in equal-tempered reference pitches. No ornaments or recorded performance.',
    audioAssets: [{
      kind: 'synthesised', author: 'Bansuri Practice',
      permissionStatus: 'Generated locally by this application; no third-party recordings.',
      description: 'A synthesised teaching tone, not a recorded bansuri.',
    }],
  };
}

function songArrangement(
  id: string, songId: string, title: string, description: string, bpm: number, notes: WrittenNote[],
  phraseDefinitions: [string, number, number][], noteRange: string, prerequisites: string[],
  difficulty: Arrangement['difficulty'] = 'Beginner',
): Arrangement {
  const events = score(id, notes);
  return {
    id, songId, version: 1, title, description, difficulty, prerequisites,
    language: 'Instrumental', noteRange, status: 'draft',
    reviewStatus: 'Original teaching arrangement · awaiting teacher review',
    ppq: PPQ, bpm, timeSignature: [4, 4], referenceSaMidi: 60,
    instrumentProfileIds: ['six-hole-unverified'], events,
    phrases: phraseDefinitions.map(([label, startBeat, endBeat], i) => ({
      id: `${id}-phrase-${i + 1}`, label, startTick: startBeat * PPQ, endTick: endBeat * PPQ,
    })),
    breathMarks: events.filter(event => event.kind === 'rest').map(event => ({
      tick: event.startTick, text: 'Release the breath; inhale comfortably if needed.',
    })),
    source: {
      author: 'Bansuri Practice',
      permissionStatus: 'Original beginner teaching arrangement based on traditional melody; simplified for practice.',
    },
    credits: ['Arrangement: Bansuri Practice', 'Teaching content: draft; teacher review pending'],
    arrangementAuthor: 'Bansuri Practice',
    arrangementType: 'Simplified teaching melody in equal-tempered reference pitches. No recorded performance.',
    audioAssets: [{
      kind: 'synthesised', author: 'Bansuri Practice',
      permissionStatus: 'Generated locally by this application; no third-party recordings.',
      description: 'A synthesised teaching tone, not a recorded bansuri.',
    }],
  };
}

export const arrangements: Arrangement[] = [
  exercise('steady-sa', 'Your first steady Sa',
    'Listen for a steady pitch. Play a comfortable three-beat tone, then release and rest. Do not force a long breath.',
    60, [['Sa', 3], ['rest', 1], ['Sa', 3], ['rest', 1]],
    [['One comfortable breath', 0, 4], ['Try it once more', 4, 8]], 'Middle Sa', ['first-tone']),
  exercise('breath-and-rest', 'Room to breathe',
    'Alternate two-beat and three-beat tones with explicit silent beats. The rests are part of the music.',
    64, [['Sa', 2], ['rest', 2], ['Sa', 3], ['rest', 1], ['Sa', 2], ['rest', 2], ['Sa', 3], ['rest', 1]],
    [['Short breath, long breath', 0, 8], ['Repeat with ease', 8, 16]], 'Middle Sa', ['breath-control']),
  exercise('first-steps', 'Sa, Re, Ga — first steps',
    'Hear three relative pitches, then descend. Learn these pitches on your own instrument with reviewed fingering guidance.',
    72, [['Sa', 1], ['Re', 1], ['Ga', 1], ['rest', 1], ['Ga', 1], ['Re', 1], ['Sa', 1], ['rest', 1]],
    [['Three notes up', 0, 4], ['Three notes home', 4, 8]], 'Middle Sa–Ga', ['relative-pitch']),
  exercise('sargam-ladder', 'The sargam ladder',
    'Move from middle Sa to upper Sa and return. Upper Sa is an octave above middle Sa; use a comfortable register and stop if you feel strain.',
    76, [['Sa', 1], ['Re', 1], ['Ga', 1], ['Ma', 1], ['Pa', 1], ['Dha', 1], ['Ni', 1], ['Sa', 1, 1],
      ['Sa', 1, 1], ['Ni', 1], ['Dha', 1], ['Pa', 1], ['Ma', 1], ['Ga', 1], ['Re', 1], ['Sa', 1]],
    [['Climb to upper Sa', 0, 8], ['Return to middle Sa', 8, 16]], 'Middle Sa–upper Sa', ['ascending-descending'], 'Early intermediate'),
  exercise('adjacent-alankar', 'Small steps, clear changes',
    'A short original pattern using adjacent notes. Half-beat steps make space for listening; keep shoulders and fingers relaxed.',
    64, [['Sa', .5], ['Re', .5], ['Sa', 1], ['Re', .5], ['Ga', .5], ['Re', 1],
      ['Ga', .5], ['Ma', .5], ['Ga', 1], ['Sa', 1], ['rest', 1],
      ['Ga', .5], ['Re', .5], ['Ga', 1], ['Re', .5], ['Sa', .5], ['Re', 1],
      ['Sa', 1], ['Sa', 1, 0, 'tongued'], ['Sa', 1], ['rest', 1]],
    [['Adjacent notes up', 0, 8], ['Adjacent notes back', 8, 16]], 'Middle Sa–Ma', ['simple-alankars', 'beats-and-rests']),
  exercise('phrase-builder', 'A little morning phrase',
    'Join two original phrases with dotted-quarter and half-beat rhythms. Listen first, repeat slowly, and leave silence at the end.',
    80, [['Sa', 1.5], ['Re', .5], ['Ga', 1], ['Ma', 1], ['Ga', 1.5], ['Re', .5], ['Sa', 1], ['rest', 1],
      ['Ga', 1.5], ['Ma', .5], ['Pa', 1], ['Ga', 1], ['Re', 1], ['Sa', 2], ['rest', 1]],
    [['Phrase A · a gentle rise', 0, 8], ['Phrase B · coming home', 8, 16]], 'Middle Sa–Pa', ['phrase-by-phrase', 'beats-and-rests']),
  songArrangement('arr-lag-ja-gale', 'lag-ja-gale', 'Lag Ja Gale',
    'Classic Hindi melody arranged for six-hole bansuri beginners. Notice the gentle descent to lower Dha and comfortable four-beat breathing rests.',
    68, [
      ['Sa', 1], ['Re', 1], ['Ga', 1.5], ['Ga', .5],
      ['Re', 1], ['Ga', 1], ['Re', 1], ['Sa', 1],
      ['Dha', 1, -1], ['Sa', 1], ['Re', 1.5], ['Re', .5],
      ['Sa', 2], ['rest', 2],
      ['Sa', 1], ['Re', 1], ['Ga', 1.5], ['Ga', .5],
      ['Pa', 1], ['Ga', 1], ['Re', 1], ['Sa', 1],
      ['Dha', 1, -1], ['Sa', 1], ['Re', 1], ['Re', 1],
      ['Sa', 2], ['rest', 2]
    ],
    [['Phrase 1 · Lag ja gale', 0, 16], ['Phrase 2 · Shayad phir is janam', 16, 32]], 'Lower Dha–middle Pa', ['relative-pitch', 'beats-and-rests']),
  songArrangement('arr-kal-ho-naa-ho', 'kal-ho-naa-ho', 'Kal Ho Naa Ho',
    'Heartfelt melody arranged phrase-by-phrase with 4/4 meter. Practise smooth transitions between Ga, Ma, and Pa.',
    76, [
      ['Ga', 1], ['Ma', 1], ['Pa', 1.5], ['Pa', .5],
      ['Ma', 1], ['Ga', 1], ['Re', 1], ['Ga', 1],
      ['Ga', 1], ['Ma', 1], ['Pa', 1.5], ['Pa', .5],
      ['Ma', 1], ['Ga', 1], ['Re', 2],
      ['Re', 1], ['Ga', 1], ['Ma', 1.5], ['Ma', .5],
      ['Ga', 1], ['Re', 1], ['Sa', 1], ['Re', 1],
      ['Re', 1], ['Ga', 1], ['Ma', 1], ['Ga', 1],
      ['Re', 1], ['Sa', 2], ['rest', 1]
    ],
    [['Phrase 1 · Har ghadi badal rahi hai', 0, 16], ['Phrase 2 · Har pal yahan jee bhar jiyo', 16, 32]], 'Middle Sa–Pa', ['simple-alankars', 'beats-and-rests']),
  songArrangement('arr-tum-hi-ho', 'tum-hi-ho', 'Tum Hi Ho',
    'Soulful melody arranged for relaxed phrasing from middle Sa to Pa. Keep your airstream soft and unforced.',
    70, [
      ['Sa', 1], ['Re', 1], ['Ga', 1.5], ['Ga', .5],
      ['Re', 1], ['Ga', 1], ['Re', 1], ['Sa', 1],
      ['Re', 1], ['Ga', 1], ['Ma', 1.5], ['Ga', .5],
      ['Re', 2], ['rest', 2],
      ['Ga', 1], ['Ma', 1], ['Pa', 1.5], ['Pa', .5],
      ['Ma', 1], ['Ga', 1], ['Re', 1], ['Ga', 1],
      ['Re', 1], ['Sa', 1], ['Re', 1.5], ['Re', .5],
      ['Sa', 2], ['rest', 2]
    ],
    [['Phrase 1 · Hum tere bin', 0, 16], ['Phrase 2 · Kyunki tum hi ho', 16, 32]], 'Middle Sa–Pa', ['relative-pitch', 'phrase-by-phrase']),
  songArrangement('arr-pehla-nasha', 'pehla-nasha', 'Pehla Nasha',
    'Gentle romantic melody featuring comfortable leaps and lower Dha grounding. Listen once before repeating.',
    74, [
      ['Ga', 1.5], ['Ga', .5], ['Re', 1], ['Sa', 1],
      ['Re', 1.5], ['Re', .5], ['Sa', 1], ['Dha', 1, -1],
      ['Sa', 1], ['Re', 1], ['Ga', 1], ['Ma', 1],
      ['Ga', 2], ['rest', 2],
      ['Ga', 1.5], ['Ga', .5], ['Re', 1], ['Sa', 1],
      ['Re', 1.5], ['Re', .5], ['Sa', 1], ['Dha', 1, -1],
      ['Sa', 1], ['Re', 1], ['Ga', 1], ['Re', 1],
      ['Sa', 2], ['rest', 2]
    ],
    [['Phrase 1 · Pehla nasha pehla khumaar', 0, 16], ['Phrase 2 · Naya pyaar hai naya intezaar', 16, 32]], 'Lower Dha–middle Ma', ['simple-alankars', 'beats-and-rests']),
  songArrangement('arr-kesariya', 'kesariya', 'Kesariya',
    'Warm contemporary melody arranged with steady beats and approachable middle-octave range.',
    76, [
      ['Pa', 1], ['Dha', 1], ['Sa', 1.5, 1], ['Sa', .5, 1],
      ['Sa', 1, 1], ['Ni', 1], ['Dha', 1], ['Pa', 1],
      ['Ma', 1], ['Ga', 1], ['Re', 1.5], ['Ga', .5],
      ['Re', 2], ['rest', 2],
      ['Ga', 1], ['Ma', 1], ['Pa', 1.5], ['Pa', .5],
      ['Ma', 1], ['Ga', 1], ['Re', 1], ['Sa', 1],
      ['Re', 1], ['Ga', 1], ['Re', 1], ['Re', 1],
      ['Sa', 2], ['rest', 2]
    ],
    [['Phrase 1 · Kesariya tera ishq hai piya', 0, 16], ['Phrase 2 · Rang jaaun jo main haath lagaaun', 16, 32]], 'Middle Sa–upper Sa', ['ascending-descending', 'phrase-by-phrase'], 'Early intermediate'),
  songArrangement('arr-vaseegara', 'vaseegara', 'Vaseegara · வசீகரா',
    'Beloved Tamil melody arranged phrase-by-phrase in middle Sa–Dha range. Follow the four-beat cycle with ease.',
    68, [
      ['Ga', 1], ['Ma', 1], ['Pa', 1.5], ['Dha', .5],
      ['Pa', 1], ['Ma', 1], ['Ga', 1], ['Ma', 1],
      ['Ga', 1], ['Re', 1], ['Sa', 1], ['Re', 1],
      ['Ga', 2], ['rest', 2],
      ['Ga', 1], ['Ma', 1], ['Pa', 1.5], ['Dha', .5],
      ['Pa', 1], ['Ma', 1], ['Ga', 1], ['Re', 1],
      ['Sa', 1], ['Re', 1], ['Ga', 1], ['Re', 1],
      ['Sa', 2], ['rest', 2]
    ],
    [['Phrase 1 · Vaseegara en nenjinikkum', 0, 16], ['Phrase 2 · Un pon madiyil thoonginal podhum', 16, 32]], 'Middle Sa–middle Dha', ['relative-pitch', 'phrase-by-phrase']),
];

export type Lesson = {
  id: string;
  number: number;
  title: string;
  description: string;
  explanation: string;
  illustration: string;
  mistakes: string[];
  checklist: string[];
  exerciseId: string;
  durationMinutes: number;
  reviewStatus: string;
};

const lessonContent: Omit<Lesson, 'number' | 'reviewStatus'>[] = [
  {
    id: 'holding-your-bansuri', title: 'Meet your bansuri', description: 'Find the blowing hole and six finger holes.',
    explanation: 'A six-hole transverse bansuri is held across the body, with the blowing hole near your mouth. The six finger holes run away from that end. Support the instrument without squeezing; let shoulders and wrists stay comfortable. Hand placement can depend on your instrument and playing orientation, so have a teacher check it. You can listen to the exercise before trying to play.',
    illustration: 'Blowing end → blowing hole → finger holes 1 · 2 · 3 · 4 · 5 · 6 → far end. Numbers describe physical position, not a verified fingering.',
    mistakes: ['Squeezing the flute to keep it still.', 'Raising the shoulders or bending the wrists painfully.'],
    checklist: ['I can identify the blowing hole and six finger holes.', 'I can hold the instrument briefly with relaxed shoulders.'],
    exerciseId: 'steady-sa', durationMinutes: 4,
  },
  {
    id: 'first-tone', title: 'Find your first clear tone', description: 'Explore a gentle airstream and comfortable position.',
    explanation: 'Rest the blowing hole comfortably near the lower lip and direct a small, steady stream of air across its edge. Adjust the angle gently rather than blowing harder. Begin with short attempts and pause between them. Your first clear sound does not need to match Sa immediately. The reference tone helps you listen, but this app cannot observe your mouth position.',
    illustration: 'Lips → a narrow airstream → opposite edge of the blowing hole. Make small angle changes; a teacher can demonstrate the placement.',
    mistakes: ['Blowing harder when no tone appears.', 'Tensing the lips, cheeks, or jaw.'],
    checklist: ['I made several short, comfortable tone attempts.', 'I rested and breathed normally between attempts.'],
    exerciseId: 'steady-sa', durationMinutes: 5,
  },
  {
    id: 'breath-control', title: 'Give each note room to breathe', description: 'Practise steady breath with deliberate rests.',
    explanation: 'Inhale comfortably, then release a gentle, even airstream. Begin with two or three beats of sound and use the rest to recover. A steady, unforced note is more useful than the longest possible note. Shorten the exercise or stop if you feel lightheaded. Breath marks are suggestions; your comfortable breath always takes priority.',
    illustration: 'Inhale comfortably → hold a tone for 2–3 beats → silent rest → breathe normally.',
    mistakes: ['Using all your air before the phrase ends.', 'Holding tension during the rest.'],
    checklist: ['I left the rests silent.', 'I kept each attempt comfortable rather than forcing its length.'],
    exerciseId: 'breath-and-rest', durationMinutes: 4,
  },
  {
    id: 'holes-and-seals', title: 'Number the holes; check the seal', description: 'Separate hole positions from a fingering convention.',
    explanation: 'In this app, hole 1 is the finger hole nearest the blowing end and hole 6 is farthest away. A finger pad should seal its hole without excessive pressure. Small leaks can change a note or make it unstable. There is no verified fingering chart in this release: ask a bansuri teacher to establish your instrument’s Sa and hand positions. A manufacturer’s printed scale does not establish our fingering convention.',
    illustration: 'Blowing end → [1] [2] [3] [4] [5] [6]. All six positions are unassigned until a profile is reviewed. Fingering not available.',
    mistakes: ['Assuming a chart for a recorder or Western flute applies.', 'Pressing harder instead of checking where the finger pad rests.'],
    checklist: ['I know which end hole numbering starts from.', 'I understand that this app has no verified hole patterns yet.'],
    exerciseId: 'steady-sa', durationMinutes: 4,
  },
  {
    id: 'relative-pitch', title: 'Sa is your home note', description: 'Meet the seven swaras and the idea of relative pitch.',
    explanation: 'Sargam names seven degrees: Sa, Re, Ga, Ma, Pa, Dha, Ni. They describe a relationship to your chosen Sa, not one fixed Western key. Set the actual pitch and octave of Sa in Settings; C4 is only the initial reference assumption. A lower Sa is one octave below, and an upper Sa is one octave above. Our synthesised equal-tempered tones are a practical listening aid, not a complete model of Hindustani intonation.',
    illustration: 'Lower Sa (octave −1) → middle Sa (octave 0, your selected tonic) → upper Sa (octave +1). Each octave doubles frequency.',
    mistakes: ['Treating the flute’s printed scale as a confirmed pitch and octave.', 'Confusing an upper Sa with a new relative note name.'],
    checklist: ['I can say Sa, Re, Ga, Ma, Pa, Dha, Ni in order.', 'I know that changing the reference Sa changes every absolute pitch.'],
    exerciseId: 'first-steps', durationMinutes: 5,
  },
  {
    id: 'ascending-descending', title: 'Up the ladder, then home', description: 'Listen to ascending and descending sargam.',
    explanation: 'First listen to Sa Re Ga Ma Pa Dha Ni upper Sa, then the return. Practise only the range you can play comfortably with guidance. Upper notes may require a different airstream and register technique; the same diagram cannot teach that transition. Work in short groups before attempting the whole octave, and slow playback while keeping its reference pitch unchanged.',
    illustration: 'Sa → Re → Ga → Ma → Pa → Dha → Ni → upper Sa; reverse the sequence to return.',
    mistakes: ['Rushing downward because the sequence feels familiar.', 'Forcing high notes before the lower range is comfortable.'],
    checklist: ['I listened to both directions.', 'I practised a comfortable group at a slow speed.'],
    exerciseId: 'sargam-ladder', durationMinutes: 6,
  },
  {
    id: 'beats-and-rests', title: 'Count the sound and the silence', description: 'Understand beats, held notes, and count-in.',
    explanation: 'In these 4/4 studies, count four quarter-note beats per bar. At 60 BPM each quarter-note beat lasts one second. A half-beat note lasts half as long; a dotted-quarter lasts one and a half beats. Hold a note for its entire written duration, and keep counting through rests. The count-in gives one bar to settle before the first note.',
    illustration: 'Count: 1 & 2 & 3 & 4 &. One beat = 480 ticks; half beat = 240; one-and-a-half beats = 720. Rest means silence.',
    mistakes: ['Skipping a rest instead of counting its full length.', 'Starting on the first count-in click rather than after the complete bar.'],
    checklist: ['I counted four silent count-in beats.', 'I can hear the difference between one and one-and-a-half beats.'],
    exerciseId: 'phrase-builder', durationMinutes: 5,
  },
  {
    id: 'simple-alankars', title: 'Small patterns build familiarity', description: 'Use adjacent-note patterns as slow exercises.',
    explanation: 'An alankar is a structured note pattern used in practice. This original study explores Sa Re Sa, Re Ga Re, and similar small movements. Listen once, slow the phrase down, then repeat it with an even pulse. Aim for a comfortable transition between known notes, not maximum speed. The study omits ornaments and does not represent a raga lesson.',
    illustration: 'Sa · Re · Sa | Re · Ga · Re | Ga · Ma · Ga. Keep the note order while following the written durations.',
    mistakes: ['Increasing speed before the changes are comfortable.', 'Ignoring the held final note in each small pattern.'],
    checklist: ['I listened to one phrase before repeating.', 'I kept the half-beat steps even at a comfortable speed.'],
    exerciseId: 'adjacent-alankar', durationMinutes: 6,
  },
  {
    id: 'gentle-articulation', title: 'Begin a note; connect a note', description: 'Compare gentle attacks with smooth transitions.',
    explanation: 'Repeated notes need distinct starts; connected notes need a steady airstream through a pitch change. A teacher can demonstrate a light tongue release and suitable breath technique for your instrument. Compare the repeated Sa notes in this exercise with the adjacent-note patterns. Pitch detection alone cannot establish that each repeated note had a separate onset, so this release does not invent a rhythm score.',
    illustration: 'Repeated notes: Sa | Sa | Sa, each with a fresh gentle start. Connected notes: Sa → Re → Ga, with an even airstream.',
    mistakes: ['Using a forceful attack for every note.', 'Assuming a continuously held note counts as three repeated notes.'],
    checklist: ['I listened for separate starts on repeated Sa.', 'I compared repeated notes with a smooth change of pitch.'],
    exerciseId: 'adjacent-alankar', durationMinutes: 5,
  },
  {
    id: 'phrase-by-phrase', title: 'Make a small melody your own', description: 'Listen, repeat, then join two original phrases.',
    explanation: 'Begin with phrase A of this original teaching melody. Listen, count in, repeat, and leave its final rest intact. When it feels familiar, learn phrase B, then join both without rushing the boundary. Manual completion records your practice, not a teacher’s assessment. Komal and tivra swaras, half-holing, meend, and other ornaments belong in later reviewed lessons; they are not taught by this introductory study.',
    illustration: 'Listen to A → repeat A → listen to B → repeat B → join A + B. A–B loop endpoints include the start and exclude the end.',
    mistakes: ['Restarting from the beginning every time instead of isolating a phrase.', 'Losing the silent beat at the phrase boundary.'],
    checklist: ['I practised both phrases separately.', 'I joined them once at a comfortable speed and saved my attempt.'],
    exerciseId: 'phrase-builder', durationMinutes: 7,
  },
];

export const lessons: Lesson[] = lessonContent.map((lesson, index) => ({
  ...lesson, number: index + 1, reviewStatus: 'Draft instructional content · awaiting bansuri teacher review',
}));

export type Song = { id: string; title: string; language: string; status: 'ready' | 'pending'; description: string };
export const songs: Song[] = [
  { id: 'lag-ja-gale', title: 'Lag Ja Gale', language: 'Hindi', status: 'ready', description: 'Classic Hindi melody simplified in Hindustani sargam for six-hole bansuri beginners. Ready for phrase practice.' },
  { id: 'kal-ho-naa-ho', title: 'Kal Ho Naa Ho', language: 'Hindi', status: 'ready', description: 'Uplifting modern melody arranged phrase-by-phrase with 4/4 meter and clear breath rests.' },
  { id: 'tum-hi-ho', title: 'Tum Hi Ho', language: 'Hindi', status: 'ready', description: 'Soulful melody arranged for relaxed phrasing from middle Sa to Pa. Ready to play.' },
  { id: 'pehla-nasha', title: 'Pehla Nasha', language: 'Hindi', status: 'ready', description: 'Gentle romantic melody with comfortable transitions and lower Dha grounding.' },
  { id: 'kesariya', title: 'Kesariya', language: 'Hindi', status: 'ready', description: 'Warm contemporary melody arranged with steady beats and approachable middle-octave range.' },
  { id: 'vaseegara', title: 'Vaseegara · வசீகரா', language: 'Tamil', status: 'ready', description: 'Beloved Tamil melody arranged phrase-by-phrase in middle Sa–Dha range.' },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
const isTick = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const nonempty = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

/** A score must contain explicit rests, fit its phrase boundaries, and spell its pitches correctly. */
export function validateArrangement(value: unknown): string[] {
  if (!isRecord(value)) return ['Arrangement must be an object.'];
  const errors: string[] = [];
  for (const key of ['id', 'title', 'description', 'reviewStatus', 'noteRange', 'arrangementAuthor', 'arrangementType']) {
    if (!nonempty(value[key])) errors.push(`${key} must be a nonempty string.`);
  }
  if (!isTick(value.version) || value.version < 1) errors.push('Version must be a positive integer.');
  if (value.ppq !== PPQ) errors.push('Scores must use 480 ticks per quarter note.');
  if (typeof value.bpm !== 'number' || !Number.isFinite(value.bpm) || value.bpm <= 0) errors.push('BPM must be finite and positive.');
  if (!isTick(value.referenceSaMidi) || value.referenceSaMidi > 127) errors.push('Reference Sa must be a MIDI note from 0 to 127.');
  if (!['draft', 'verified', 'published'].includes(String(value.status))) errors.push('Unknown arrangement status.');
  if (!['Beginner', 'Early intermediate'].includes(String(value.difficulty))) errors.push('Unknown difficulty.');
  if (value.language !== 'Instrumental') errors.push('Teaching exercises must be labelled Instrumental.');
  if (!Array.isArray(value.prerequisites) || value.prerequisites.some(id => !lessons.some(lesson => lesson.id === id))) errors.push('Prerequisite lesson references must resolve.');
  if (value.songId !== undefined && !songs.some(song => song.id === value.songId)) errors.push('Song reference does not resolve.');
  if (!Array.isArray(value.timeSignature) || value.timeSignature.length !== 2 ||
    !isTick(value.timeSignature[0]) || value.timeSignature[0] < 1 || value.timeSignature[0] > 32 ||
    ![1, 2, 4, 8, 16].includes(value.timeSignature[1])) errors.push('Unsupported time signature.');
  if (!Array.isArray(value.instrumentProfileIds) || value.instrumentProfileIds.length === 0 ||
    value.instrumentProfileIds.some(id => !fingeringProfiles.some(profile => profile.id === id))) errors.push('Instrument profile references must resolve.');
  if (!isRecord(value.source) || !nonempty(value.source.author) || !nonempty(value.source.permissionStatus)) errors.push('Source author and permission status are required.');
  if (!Array.isArray(value.credits) || value.credits.length === 0 || value.credits.some(credit => !nonempty(credit))) errors.push('Credits are required.');
  if (!Array.isArray(value.audioAssets) || value.audioAssets.some(asset => !isRecord(asset) || !nonempty(asset.author) || !nonempty(asset.permissionStatus))) errors.push('Every audio asset needs provenance.');
  const ids = new Set<string>();
  const boundaries = new Set<number>([0]);
  let end = 0;
  if (!Array.isArray(value.events) || !value.events.length) return [...errors, 'At least one score event is required.'];
  for (const item of value.events) {
    if (!isRecord(item)) { errors.push('Each event must be an object.'); continue; }
    if (!nonempty(item.id) || ids.has(item.id)) errors.push('Event IDs must be nonempty and unique.');
    if (typeof item.id === 'string') ids.add(item.id);
    if (!isTick(item.startTick) || !isTick(item.durationTicks) || item.durationTicks <= 0 ||
      !Number.isSafeInteger(Number(item.startTick) + Number(item.durationTicks))) {
      errors.push(`Event ${String(item.id)} must have a nonnegative integer start and positive integer duration.`); continue;
    }
    if (item.startTick < end) errors.push(`Event ${String(item.id)} overlaps an earlier event or is out of order.`);
    if (item.startTick > end) errors.push(`Event ${String(item.id)} leaves a gap; add an explicit rest.`);
    end = item.startTick + item.durationTicks;
    boundaries.add(item.startTick); boundaries.add(end);
    if (item.kind === 'note') {
      if (typeof item.swara !== 'string' || !Object.hasOwn(semitones, item.swara)) { errors.push('Unknown swara.'); continue; }
      if (![-1, 0, 1].includes(Number(item.octave)) || typeof item.octave !== 'number') errors.push('Octave must be −1, 0, or 1.');
      const validAlteration = item.alteration === 'natural' ||
        (item.alteration === 'komal' && ['Re', 'Ga', 'Dha', 'Ni'].includes(item.swara)) ||
        (item.alteration === 'tivra' && item.swara === 'Ma');
      if (!validAlteration) errors.push(`Unsupported alteration for ${item.swara}.`);
      const offset = item.alteration === 'komal' ? -1 : item.alteration === 'tivra' ? 1 : 0;
      if (item.semitonesFromSa !== semitones[item.swara as Swara] + Number(item.octave) * 12 + offset) errors.push('Pitch and swara spelling disagree.');
      if (item.articulation !== undefined && !['normal', 'tongued', 'legato'].includes(String(item.articulation))) errors.push('Unsupported articulation.');
      if (item.fingeringId !== undefined && (!Array.isArray(value.instrumentProfileIds) ||
        !value.instrumentProfileIds.some(id => typeof id === 'string' && typeof item.fingeringId === 'string' && resolveFingering(id, item.fingeringId)))) errors.push('Fingering reference is missing or unverified.');
    } else if (item.kind !== 'rest') errors.push('Event kind must be note or rest.');
  }
  const phraseIds = new Set<string>();
  let previousPhraseEnd = 0;
  if (!Array.isArray(value.phrases) || !value.phrases.length) errors.push('At least one phrase is required.');
  else for (const phrase of value.phrases) {
    if (!isRecord(phrase)) { errors.push('Each phrase must be an object.'); continue; }
    if (!nonempty(phrase.id) || phraseIds.has(phrase.id)) errors.push('Phrase IDs must be nonempty and unique.');
    if (typeof phrase.id === 'string') phraseIds.add(phrase.id);
    if (!nonempty(phrase.label)) errors.push('Each phrase needs a label.');
    if (!isTick(phrase.startTick) || !isTick(phrase.endTick) || phrase.endTick <= phrase.startTick || phrase.endTick > end ||
      !boundaries.has(phrase.startTick) || !boundaries.has(phrase.endTick) || phrase.startTick !== previousPhraseEnd) errors.push('Phrase bounds must follow event boundaries and cover the score in order.');
    if (typeof phrase.endTick === 'number') previousPhraseEnd = phrase.endTick;
  }
  if (previousPhraseEnd !== end) errors.push('Phrases must cover the complete score.');
  if (!Array.isArray(value.breathMarks) || value.breathMarks.some(mark => !isRecord(mark) || !isTick(mark.tick) || mark.tick > end || !boundaries.has(mark.tick))) errors.push('Breath marks must be on score boundaries.');
  return errors;
}

const allIds = [...arrangements, ...lessons, ...songs].map(item => item.id);
if (new Set(allIds).size !== allIds.length) throw new Error('Content IDs must be unique.');
for (const arrangement of arrangements) {
  const errors = validateArrangement(arrangement);
  if (errors.length) throw new Error(`Invalid score ${arrangement.id}: ${errors.join(' ')}`);
}
for (const lesson of lessons) {
  if (!arrangements.some(arrangement => arrangement.id === lesson.exerciseId)) throw new Error(`Missing exercise for lesson ${lesson.id}.`);
}
