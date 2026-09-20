# Flute Learning Website — Coding Agent Instructions

## 1. Your assignment

Build a working, responsive website that teaches beginners to play Indian bansuri and practise Indian songs with correctly timed notes, fingering guidance, reference audio, and repeatable exercises. Use **Vikram Aditya's Dossier UI** as the design system.

Deliver an interactive learning application, not only a landing page. Prioritise the practice experience: a learner should know **which note to play, which holes to cover, when to start, and how long to hold it**.

Working product name: **Bansuri Practice**. Keep the name configurable.

### Assumptions and scope

- Initial instrument: six-hole transverse Indian bansuri. Do not mix its fingering with Western concert flute or recorder fingering.
- Initial teaching notation: Hindustani sargam, with optional Western note names.
- Interface and explanations: English; support Unicode Indian-language song titles and future localisation.
- Initial users: complete beginners and early intermediate learners practising with a real flute.
- Guest-first, browser-based application; no mandatory account, paid service, or backend for the first release.
- Desktop and mobile; headphones recommended when using microphone feedback.
- Build timed playback, lessons, local progress, and microphone practice in the first release. Publish popular-song lessons only when real arrangements and necessary content permissions are available.

## 2. Mandatory Dossier UI integration

Documentation: https://vikramaditya10.github.io/dossier_ui/

Installation page: https://vikramaditya10.github.io/dossier_ui/#/installation

The documentation's deployed application was inspected while preparing this brief on 20 September 2026. Its installation examples identify these packages and imports:

```bash
pnpm add @vikramaditya1010/react @vikramaditya1010/tokens @vikramaditya1010/icons
```

```tsx
import { DossierProvider, DocumentHeader, Button } from '@vikramaditya1010/react';
import '@vikramaditya1010/react/styles.css';

export function AppShell() {
  return (
    <DossierProvider theme="paper" density="default">
      <DocumentHeader
        kicker="BANSURI PRACTICE"
        title="Learn one phrase at a time"
      />
      <Button variant="solid">Start practice</Button>
    </DossierProvider>
  );
}
```

Before implementation, inspect the installed package exports, peer dependencies, component props, and theme tokens. Resolve compatible versions and commit the lockfile. The owner's recent release was described as v0.1.1; verify published versions rather than assuming a particular version is available or current.

Do not invent imports or copy APIs from another component library. Do not substitute shadcn, Material UI, or a generic Tailwind component kit. If a Dossier component is missing, implement a small accessible component using its tokens and styling conventions. If package installation is unavailable, document the blocker and retain the integration requirement.

### Component mapping

These component names appear in the inspected documentation; confirm their exact props in the installed release.

| Product requirement | Dossier components |
| --- | --- |
| Application navigation | Sidebar, Tabs, Breadcrumb |
| Page and lesson structure | DocumentHeader, Section, Rule, Figure, Annotation |
| Song search and filters | SearchInput, Select, Checkbox, Tag |
| Playback and settings | Button, NumberInput, Switch, Tooltip |
| Practice statistics | Metric, MetricRow, Progress, ChartFrame |
| Song metadata and completion | Metadata, Status, KeyValueList |
| Help and device failures | Callout, Dialog, Toast, EmptyState |
| Small-screen settings | Drawer |

Custom music components: `FingeringDiagram`, `SargamTimeline`, `BeatGrid`, `PitchMeter`, `TransportBar`, `PhraseSelector`, and `PracticeSummary`. These are application components, not claimed Dossier exports.

### Visual direction

- Preserve Dossier's paper surface, strong typography, monospace measurements, fine rules, restrained accent colour, and compact rectangular controls.
- Offer Paper and Midnight appearance; documentation shows `paper` and `dark` theme values. Verify them in the installed version.
- Use the documented tokens; examples include `--dossier-accent-blue` and `--dossier-font-mono`. Inspect before using other token names.
- Give the active note generous space and make the next two notes easy to anticipate.
- Make music feel approachable: plain labels such as “Your next note” and “Try this phrase again”. Avoid developer jargon in the learning UI.
- Use colour plus shape/text for active, upcoming, correct, and missed notes.
- No decorative hero that pushes the practice controls below the fold.

## 3. Learner journeys and pages

### First visit / setup

1. Ask whether the learner has a six-hole bansuri and their experience level.
2. Ask for the flute's labelled scale, but explain that manufacturer naming conventions may vary.
3. Help establish the **actual Sa pitch and octave** using a reference tone or microphone. Store the selected fingering convention separately from the printed instrument label.
4. Choose sargam-only or sargam with Western pitch labels.
5. Offer “Learn the basics”, “Explore songs”, and “Open practice room”.

Allow setup to be skipped and revisited. Defaults must be labelled assumptions, not a claim about the user's instrument.

### Routes

Use hash routing initially so the application can run on static hosting without rewrite rules.

| Route | Required behaviour |
| --- | --- |
| `/#/` | Continue learning, recent song, next exercise, actual local progress |
| `/#/learn` | Ordered beginner curriculum with completion state |
| `/#/learn/:lessonId` | Explanation, diagram, playable exercise, completion checklist |
| `/#/songs` | Searchable song library; filter by difficulty, language, note range, availability |
| `/#/songs/:songId` | Arrangement details, prerequisites, sections, reference preview, practice action |
| `/#/practice/:arrangementId` | Full timed practice workspace |
| `/#/tools/tuner` | Free tuner and reference Sa without a scored song |
| `/#/progress` | Sessions, minutes, attempted phrases, measured results where available |
| `/#/settings` | Instrument, tonic, theme, audio, calibration, local data export/reset |

### Practice workspace

Desktop: lesson/phrase navigation on the left, timeline and current note centrally, fingering and feedback beside it, persistent transport controls below.

Mobile: current note and fingering first, compact timeline second, transport always reachable; secondary controls in a drawer. No page-wide horizontal overflow.

Always display:

- Song/exercise and selected phrase.
- Selected Sa, instrument profile, original arrangement tempo, and current tempo.
- Current sargam note, octave, optional absolute pitch, and duration in beats.
- Animated six-hole diagram, with blowing end and hole numbering clearly labelled.
- Current beat/bar or cycle position, upcoming notes, rests, and breath marks.
- Play/pause, restart, count-in, speed, metronome, reference volume, and loop controls.
- Honest microphone state: off, permission needed, listening, low signal, or unavailable.

## 4. Beginner teaching content

Include at least ten concise lessons with an explanation, labelled illustration, common mistakes, and an interactive exercise where appropriate:

1. Parts of the bansuri and how to hold it without tension.
2. Embouchure and making the first steady tone.
3. Breath control and relaxed sustained notes.
4. Hole numbering, sealing holes, and the chosen fingering convention.
5. Sa, Re, Ga, Ma, Pa, Dha, Ni and relative pitch.
6. Ascending and descending sargam.
7. Beats, rests, long notes, and the count-in.
8. Simple alankars and changing between adjacent notes.
9. Tonguing, smooth transitions, and repeated notes.
10. Learning a melody phrase by phrase and joining the phrases.

Introduce lower/middle/upper octaves explicitly. Add komal/tivra notes, half-holing, meend, and ornamentation as later lessons. Do not imply equal-tempered reference tones are a complete model of Hindustani intonation.

Have a competent bansuri teacher review instructional content and profile-specific fingerings before marking them verified. Do not generate universal hole patterns from note names alone. If a note has no verified fingering for a selected profile, show “Fingering not available” instead of guessing.

## 5. Indian song library

Provide the full catalogue-to-practice workflow. Candidate popular-song targets include **Lag Ja Gale**, **Kal Ho Naa Ho**, **Tum Hi Ho**, **Pehla Nasha**, **Kesariya**, and **Vaseegara**. These are proposed catalogue titles, not supplied or verified transcriptions. Assign difficulty only after reviewing the arrangement's range, rhythm, and techniques.

For each playable arrangement include:

- Title, language, credits, source, arrangement author, version, and review status.
- Difficulty, prerequisites, time signature, base BPM, tonic reference, and note range.
- Intro/verse/refrain or other phrase sections with beat-accurate boundaries.
- Exact sargam events with octave, start position, duration, rests, and breath marks.
- Simplified versus original arrangement labelling, including omissions of ornaments.
- Content permission/source metadata for the arrangement and every audio asset.

Build at least six fully playable original teaching exercises immediately. Add at least three verified Indian-song arrangements when approved content is available. If such content is missing, expose clearly labelled “Arrangement pending” catalogue entries and report the content dependency; never attach invented notes or unrelated audio to a familiar title. Do not claim popular-song support is complete until those lessons are playable.

Use original, licensed, or confirmed public-domain content. Do not scrape song scores, lyrics, or film recordings. A traditional melody and a modern recording require separate provenance checks. A link to a reference video is not a substitute for timed arrangement data.

## 6. Practice modes

### Listen

Play the reference melody with synchronised notes and fingering. Let users hear one note, one phrase, or the whole exercise. A modest synthesised teaching tone is sufficient initially; label it accordingly rather than claiming it is a recorded bansuri.

### Follow along

Count in, then play the timeline while the learner plays their flute. Microphone optional. Offer reference melody mute, independent metronome volume, tempo adjustment, and A–B phrase looping.

### Listen, then repeat

Play a phrase once, count in, mute reference melody, and give the learner the same duration to repeat it. Repeat the cycle or move to the next phrase.

### Microphone practice

Show detected pitch, expected pitch, cents deviation, and signal confidence. During an assessed attempt, mute the reference melody; recommend headphones for metronome leakage. Never treat the application's own reference audio as evidence that the learner played correctly.

### Note-by-note practice

Optionally wait for a sufficiently stable matching note, then advance. Keep this separate from rhythm assessment: there is no meaningful tempo score when the timeline waits for the learner.

## 7. Musical model and data contracts

Store musical time as integer ticks at **480 ticks per quarter note**. Avoid using visual pixel coordinates or rounded milliseconds as the source of truth.

```ts
type Swara = 'Sa' | 'Re' | 'Ga' | 'Ma' | 'Pa' | 'Dha' | 'Ni';
type HoleState = 'open' | 'closed' | 'half';

type EventBase = {
  id: string;
  startTick: number;
  durationTicks: number;
};

type NoteEvent = EventBase & {
  kind: 'note';
  swara: Swara;
  alteration: 'natural' | 'komal' | 'tivra';
  octave: -1 | 0 | 1; // Relative to the selected middle Sa
  semitonesFromSa: number; // Includes octave; validate against swara spelling
  fingeringId?: string;
  articulation?: 'normal' | 'tongued' | 'legato';
};

type RestEvent = EventBase & { kind: 'rest' };
type ScoreEvent = NoteEvent | RestEvent;

type Arrangement = {
  id: string;
  songId?: string;
  version: number;
  title: string;
  status: 'draft' | 'verified' | 'published';
  ppq: 480;
  bpm: number; // Quarter notes per minute
  timeSignature: [number, number];
  referenceSaMidi: number;
  instrumentProfileIds: string[];
  events: ScoreEvent[];
  phrases: { id: string; label: string; startTick: number; endTick: number }[];
  breathMarks: { tick: number; text?: string }[];
  source: { author: string; reference?: string; permissionStatus: string };
};

type Fingering = {
  id: string;
  profileId: string;
  holes: [HoleState, HoleState, HoleState, HoleState, HoleState, HoleState];
  register: 'lower' | 'middle' | 'upper';
  instruction?: string;
  verifiedBy?: string;
};
```

Validate scores at load/build time: unique IDs; finite positive BPM; nonnegative start ticks; positive durations; no overlapping notes in a monophonic score; valid phrase bounds; references resolve; supported swara alterations; pitch/spelling agreement; explicit rests for intended gaps. Fingering register and breath instructions matter even when two notes use the same hole pattern.

Transposition changes the reference pitch while preserving sargam degrees. Resolve fingerings through the selected instrument profile. Never imply that selecting any key makes every flute capable of playing the arrangement's range.

For MVP use one constant tempo per arrangement and simple time signatures. Keep tala/cycle metadata distinct from Western time signature; a future tala view may add sam, khali, and divisions with reviewed content.

## 8. Timing and playback engine

Use Web Audio's clock as the playback authority. Implement a transport outside React rendering with states `idle`, `countIn`, `playing`, `paused`, and `completed`.

For constant tempo:

```text
effectiveBpm = arrangementBpm × speedMultiplier
secondsPerTick = 60 / (effectiveBpm × 480)
eventTime = transportAnchorTime + (eventTick - anchorTick) × secondsPerTick
targetMidi = selectedSaMidi + semitonesFromSa
targetHz = 440 × 2^((targetMidi - 69) / 12)
```

Engineering requirements:

- Start/resume audio from an explicit user gesture.
- Schedule sound ahead on the audio clock; a timer may refill the scheduling queue, but must not determine audible note starts.
- Use animation frames to render current transport position; never advance musical time by incrementing React state on an interval.
- Support 0.5×, 0.75×, 1× and editable speed within a sensible range.
- Keep pitch unchanged when slowing synthesised note playback. Recorded audio needs pitch-preserving time stretching; defer it rather than quietly changing pitch with playback rate.
- On pause, seek, speed change, or loop change: cancel queued sounds, stop active voices with a short fade, preserve the intended musical position, and rebuild the scheduling queue.
- Define loops as `[startTick, endTick)`. Notes crossing the end are truncated/faded; notes ending exactly at the boundary must not sound twice.
- Provide one-bar count-in and optional count-in between loop attempts. Persist the user's preference.
- Freeze and pause on page backgrounding or audio interruption in MVP; show a clear resume action.
- Clean up audio nodes and microphone streams on exit. Avoid stuck notes and duplicated schedulers after route changes.

For 6/8, group the visual beats appropriately and explain that stored BPM is quarter-note BPM. Do not silently use dotted-quarter BPM with quarter-note timing math.

## 9. Microphone feedback and scoring

Microphone access requires a supported browser, a secure context, and explicit permission. Ask only after the learner selects microphone practice. Process audio locally; do not upload or retain raw recordings by default. Permission denial must leave all non-microphone practice usable.

Use a monophonic pitch detector such as a reviewed YIN implementation, with an audio processing pipeline that does not stall the UI. Validate any third-party dependency's API and licence before adoption. Configure input processing for music where the browser supports it, and record the actual settings rather than assuming requested settings were honoured.

Implement noise-floor calibration, confidence gating, sensible frequency bounds, temporal smoothing, and handling for octave/harmonic confusion. The engine cannot directly observe fingers, posture, or embouchure; do not claim that it can.

```text
centsError = 1200 × log2(detectedHz / targetHz)
```

Starting product parameters, to tune with real recordings:

- Beginner pitch tolerance: ±50 cents; stricter mode: ±30 cents.
- Ignore roughly the first 100 ms of a sustained note for pitch scoring, shortening this window for brief notes.
- Require about 150 ms of stable matching pitch for note-by-note advancement; adapt for short notes.
- Provisional onset window: ±150 ms after device-latency correction.

Expose these as configurable heuristics, not universal musical standards. Rests, silence, and low-confidence frames must not be scored as correct notes.

Record separate metrics:

1. Pitch accuracy over confident voiced frames in assessable note windows.
2. Coverage: assessed expected voiced time divided by expected voiced time.
3. Rhythm: onset error only where a reliable onset can be matched one-to-one with an expected event.
4. Completion and actual active practice duration.

Suppress a headline pitch score when coverage is insufficient; show “Not enough clear audio”. Do not inflate success because silence was excluded from the pitch denominator. Repeated same-pitch notes require onset detection; continuous pitch alone cannot establish their rhythm. If onset detection is unreliable, show rhythm as unavailable rather than fabricating precision.

Provide optional latency calibration and a manual offset. Keep capture timestamps and transport clock aligned. Include the offset, thresholds, coverage, and scoring version in saved attempts so results are interpretable.

## 10. Suggested implementation architecture

Use React + TypeScript + Vite, compatible with the installed Dossier release. Use native Web Audio, local JSON lesson/score content, and IndexedDB for session history. Small preferences can use localStorage. No backend is required for the initial product.

```text
src/
  app/                 routing, shell, Dossier provider
  components/music/    timeline, fingering, beat grid, pitch meter
  features/learn/      curriculum and lesson views
  features/songs/      search, filters, arrangement details
  features/practice/   workspace, modes, summary
  features/progress/   history and local statistics
  audio/               transport, scheduler, synth, microphone, detector
  music/               pitch conversion, notation, fingering resolution
  content/             reviewed lessons, exercises, song metadata
  storage/             schema versions, migrations, repositories
  validation/          score and content validation
```

Persist learner settings, lesson completion, bookmarks, and attempts. An attempt should include arrangement ID/version, phrase, selected tonic, tempo, mode, timestamps, active duration, scoring version, and nullable measured metrics. Manual practice completion is distinct from assessed performance.

Handle unavailable or full storage gracefully. Provide JSON export/import with schema validation and a confirmed “Delete my local progress” action. Explain that progress belongs to this browser until account sync is introduced.

## 11. Accessibility and browser behaviour

- All controls keyboard-operable, with visible focus and accessible names.
- Space toggles playback outside text inputs; keyboard shortcuts must not hijack typing.
- At least 44px touch targets for frequent practice actions.
- Provide textual hole states alongside the diagram.
- Do not announce every rapidly changing pitch sample to screen readers; announce status changes and offer a quiet textual summary.
- Respect reduced motion and offer manual timeline scrolling.
- Check contrast in both themes; never rely only on red/green.
- Test desktop Chromium and Firefox, Android Chrome, and iOS Safari; record actual versions and capability gaps.
- Provide clear states for missing microphone, denied access, interrupted audio, missing assets, incompatible content, and loading failures.
- Static hosting must support the deployed base path and HTTPS. Do not require server APIs for guest practice.

## 12. Implementation order

1. Verify Dossier packages and build the responsive shell, navigation, and themes.
2. Define and validate music schemas; implement pitch conversion and verified fingering profiles.
3. Build one end-to-end original exercise: audio, notes, fingering, tempo, pause, count-in, and loop.
4. Add the beginner curriculum and six original exercises with persistence.
5. Build song catalogue and phrase navigation; import reviewed arrangements when available.
6. Add microphone pitch feedback, calibration, honest coverage-aware scoring, and failure states.
7. Add history, export/import, accessibility fixes, and browser verification.

Finish each stage with working behaviour. Do not fill the UI with fake scores, invented progress, placeholder click handlers, or unrelated song data.

## 13. Acceptance criteria and meaningful tests

### Music and transport

- At 60 BPM, a 480-tick note lasts 1 second; at 120 BPM it lasts 0.5 seconds.
- At 50% speed durations double and reference pitches stay unchanged.
- Changing Sa by two semitones shifts every reference pitch by two semitones while retaining sargam labels.
- Pause/resume preserves tick position; seek and repeated loops produce no stale or duplicate notes.
- Count-in, rests, dotted durations, fractional beats, phrase boundaries, and notes ending at loop boundaries behave correctly.
- Audio and visual note changes remain within a target 50 ms on tested foreground reference devices, with no accumulating drift during a three-minute exercise. Report measured behaviour and device limitations.

### Feedback

- Known synthetic tones exercise cents conversion, octave errors, noise rejection, and silence handling.
- Real flute recordings or live teacher trials validate the pitch detector beyond synthetic fixtures.
- The system does not award a perfect attempt for silence, background noise, or reference playback.
- Denied microphone permission leaves lessons and timed practice fully usable.
- Unreliable onset data produces no invented timing score.

### Product

- A new learner can complete setup, open a lesson, hear an exercise, slow it down, loop a phrase, and save progress.
- Every playable song has actual reviewed timing and note data; pending arrangements are visibly unavailable.
- Reload preserves progress and preferences; malformed imports fail with a readable message.
- Dossier components and tokens are used throughout, with readable desktop and mobile practice layouts.
- All primary actions work without a mouse; the console has no unhandled errors in the tested flow.

## 14. Required handover

Deliver source code, dependency lockfile, setup/run/build instructions, environment requirements, content editing guide, and a short test report. Include:

- How to add a lesson, song, arrangement, and verified fingering profile.
- How to set tempo, note duration, phrase boundaries, breath marks, and content provenance.
- Which popular songs are playable and which await reviewed content.
- Which browser/device combinations were tested and any microphone limitations.
- Any unimplemented requirements, with no claim that a partial feature is complete.

The first demo should open directly to a usable learning or practice screen. Keep infrastructure minimal until the teaching and practice experience works well.

## 15. Technical references

- Dossier UI documentation and installed package declarations are authoritative for component APIs: https://vikramaditya10.github.io/dossier_ui/
- MDN audio scheduling example: https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Advanced_techniques
- MDN microphone permission and secure-context requirements: https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia

The architecture, feature priorities, schema, and scoring thresholds in this document are proposed implementation requirements. They are not claims that Dossier supplies music functionality or that microphone assessment replaces instruction from a flute teacher.
