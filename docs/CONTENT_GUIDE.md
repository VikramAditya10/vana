# Content editing guide

Content lives in [`src/content/catalog.ts`](../src/content/catalog.ts). It is local TypeScript so the production site needs no content server. Musical events use integer ticks, and every playable arrangement is validated when the catalogue module loads. Run `pnpm test` and `pnpm build` after edits.

## Change the name

Change `APP_NAME` in the catalogue and the document title in `index.html`. Keep any source credits accurate rather than renaming their original authors.

## Add a beginner lesson

Add an entry to `lessonContent`. Supply a stable unique `id`, title, short description, explanation, labelled `illustration` text, common `mistakes`, a completion `checklist`, an existing `exerciseId`, and estimated `durationMinutes`. The exported `lessons` list adds the ordering number and draft review status.

Lesson IDs are used in saved completion records and arrangement prerequisites; avoid renaming published IDs. Link an original exercise that actually teaches the concept. The illustration is instructional text alongside the app's six-hole anatomy drawing; a new anatomical illustration requires a matching accessible component.

The existing ten lessons cover holding, first tone, breath, hole numbering, relative pitch/octaves, sargam, beats/rests, alankars, articulation, and phrase practice. They are drafts awaiting a competent bansuri teacher's review. Do not replace that review status with a generic claim of verification.

## Add an original teaching exercise

The `exercise(...)` helper creates an `Arrangement` from a title, description, base BPM, written note list, phrase definitions, note-range label, and prerequisite lesson IDs. Each written note is:

```ts
[swaraOrRest, quarterNoteBeats, relativeOctave?, articulation?]

// Examples of musical event data, without invented fingering claims:
['Sa', 1]                // Middle Sa, one quarter note
['Re', 0.5]              // Middle Re, half a quarter-note beat
['Sa', 1.5, 1]           // Upper Sa, dotted quarter
['rest', 1]              // Explicit silence, one quarter note
['Sa', 1, 0, 'tongued']  // Repeated-note articulation metadata
```

The helper creates sequential natural-swara events. It does not produce reviewed fingerings. `articulation` describes intended technique; the current simple synthesiser does not reproduce every articulation or ornament faithfully.

Supply phrase definitions as `[label, startBeat, endBeat]`. Beats in this helper are quarter notes. For example, a four-beat phrase spans `0` through `4`, and the next may span `4` through `8`. Phrase bounds are half open: `[startTick, endTick)`. An event at the end belongs to the next phrase. Phrases must meet at event boundaries and cover the entire score in order.

The six included studies are:

| Arrangement ID | Title |
| --- | --- |
| `steady-sa` | Your first steady Sa |
| `breath-and-rest` | Room to breathe |
| `first-steps` | Sa, Re, Ga — first steps |
| `sargam-ladder` | The sargam ladder |
| `adjacent-alankar` | Small steps, clear changes |
| `phrase-builder` | A little morning phrase |

All are original, playable teaching material with draft musical review status. They are not transcriptions of the pending catalogue songs.

## Edit exact musical timing

`PPQ` is **480 ticks per quarter note**. Store timing in `startTick` and `durationTicks`, never screen positions or rounded milliseconds.

| Duration | Ticks |
| --- | ---: |
| Eighth note | 240 |
| Quarter note | 480 |
| Dotted quarter | 720 |
| Half note | 960 |
| Four-quarter bar | 1920 |

At 60 quarter-note BPM, 480 ticks lasts one second; at 120 BPM it lasts half a second. Slowing the synthesised melody stretches durations without changing pitch. `timeSignature` describes notation; it does not change BPM into dotted-quarter BPM. All shipped exercises are 4/4. A future 6/8 score also needs reviewed beat grouping in the interface before publishing; tala and its divisions require separate metadata and teaching content.

For an explicitly authored `Arrangement`, provide note spelling (`swara`, `alteration`, `octave`) and matching `semitonesFromSa`. Natural middle-octave offsets are Sa 0, Re 2, Ga 4, Ma 5, Pa 7, Dha 9, Ni 11. Add 12 for upper octave or subtract 12 for lower. Komal lowers Re/Ga/Dha/Ni by one semitone; tivra raises Ma by one. The validator rejects other alterations. This pitch convention defines equal-tempered reference sound, not authoritative Hindustani intonation.

Every intended gap needs a `kind: 'rest'` event. Events must be sorted, contiguous, monophonic, and non-overlapping, with positive integer durations and unique IDs. Set `breathMarks` on event boundaries using `{ tick, text }`; the helper derives them from rest starts. Put `fingeringId` on a note only if it resolves to an explicitly reviewed profile entry.

## Sources, permissions, and review

An arrangement needs its version, source author/reference, permission status, arrangement author, credits, review status, type/simplification notes, prerequisites, range, reference tonic, and instrument-profile IDs. Every audio asset needs separate provenance. A traditional composition and a commercial recording have different rights; a reference-video link alone is not a playable timed arrangement or permission grant.

Increment `version` when changing a published arrangement's musical content so saved attempts remain interpretable. Keep the status `draft` until the musical review is complete. Record specific reviewer and source information; never treat successful code validation as teacher review.

## Add a song or publish an approved arrangement

Add proposed titles to `songs` with a unique ID, title, language, `status: 'pending'`, and a description of the missing material. Unicode titles are supported. Pending entries deliberately have no guessed difficulty or attached score.

Lag Ja Gale, Kal Ho Naa Ho, Tum Hi Ho, Pehla Nasha, Kesariya, and Vaseegara all remain pending. To publish any familiar song, obtain a reviewed event list and provenance/permissions first. The current `Song` type only represents pending entries, and `Arrangement.language`/validation currently identify instrumental teaching studies. Extend those contracts and the catalogue/detail views to represent reviewed song arrangements, connect `songId`, validate the references, and expose a practice action only after those checks pass. Adding a title alone does not make a song playable.

## Add a verified instrument fingering profile

The shipped profile, `six-hole-unverified`, contains **no hole patterns**. The six numbered positions in the anatomy illustration are not a fingering prescription.

For a real profile, have a competent bansuri teacher confirm the instrument, orientation, Sa convention, range, register changes, and every note pattern. Add its unique ID, name, convention, review status, and explicit `Fingering` records to `fingeringProfiles`. Each record needs:

- A stable unique `id` and matching `profileId`.
- Exactly six `holes` values, ordered nearest to farthest from the blowing end: `open`, `closed`, or `half`.
- `register` (`lower`, `middle`, or `upper`), any required breath/register instruction, and an attributable `verifiedBy`.

`resolveFingering(profileId, fingeringId)` intentionally returns nothing without `verifiedBy`. Connect the profile to arrangement `instrumentProfileIds` and each note's `fingeringId`, and add profile selection and reviewed-pattern rendering to `FingeringDiagram`. The current diagram renders anatomy and an unavailable state only. Include textual hole states and register instructions when extending it. Do not derive patterns from swara names, transpose a Western-flute chart, or imply that changing the tonic changes the physical flute's range.

## Storage and migrations

Preferences, manual lesson completion, and attempts belong to this browser. Keep content IDs and arrangement versions stable so historical records resolve correctly. Browser backup files include a schema version; update validation and migration logic deliberately when changing the storage contract. A JSON import must be validated before replacing existing local progress. Never import raw audio recordings as part of a progress backup.
