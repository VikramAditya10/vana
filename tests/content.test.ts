import test from 'node:test';
import assert from 'node:assert/strict';
import { arrangements, fingeringProfiles, lessons, resolveFingering, songs, validateArrangement } from '../src/content/catalog';
import {
  defaults, exportData, getCompletedLessons, getStorageWarning, importData, listAttempts,
  loadSettings, parseImport, resetData, saveAttempt, saveSettings, setLessonComplete,
  validateAttempt, type Attempt,
} from '../src/storage/repository';

class BrowserStorage implements Storage {
  values = new Map<string, string>();
  failWrites = false;
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) {
    if (this.failWrites) throw new Error('QuotaExceededError');
    this.values.set(key, value);
  }
}

const local = new BrowserStorage();
Object.defineProperty(globalThis, 'localStorage', { value: local, configurable: true });

function attempt(overrides: Partial<Attempt> = {}): Attempt {
  return {
    id: 'test-attempt', arrangementId: arrangements[0].id, arrangementVersion: 1, phraseId: 'all',
    saMidi: 60, bpm: 60, speed: 1, mode: 'follow', startedAt: '2026-09-20T12:00:00.000Z',
    activeSeconds: 8, completed: true, pitchAccuracy: null, coverage: null, rhythmMs: null,
    scoringVersion: 'coverage-v1', latencyMs: 0, toleranceCents: 50, ...overrides,
  };
}

test('catalog has six playable original studies, ten complete lessons, and pending songs without invented arrangements', () => {
  assert.ok(arrangements.length >= 6);
  assert.ok(lessons.length >= 10);
  for (const arrangement of arrangements) {
    assert.deepEqual(validateArrangement(arrangement), [], arrangement.id);
    assert.equal(arrangement.status, 'draft');
    assert.match(arrangement.reviewStatus, /awaiting teacher review/);
    assert.match(arrangement.source.permissionStatus, /Original/);
    assert.equal(arrangement.songId, undefined);
  }
  for (const lesson of lessons) {
    assert.ok(lesson.explanation && lesson.illustration && lesson.mistakes.length && lesson.checklist.length);
    assert.ok(arrangements.some(arrangement => arrangement.id === lesson.exerciseId));
  }
  assert.equal(songs.length, 6);
  assert.ok(songs.every(song => song.status === 'pending'));
  assert.ok(arrangements.flatMap(item => item.events).some(event => event.durationTicks === 240));
  assert.ok(arrangements.flatMap(item => item.events).some(event => event.durationTicks === 720));
  assert.ok(arrangements.flatMap(item => item.events).some(event => event.kind === 'rest'));
});

test('fingering resolver never generates hole patterns without teacher verification', () => {
  assert.ok(fingeringProfiles.every(profile => profile.fingerings.length === 0));
  assert.equal(resolveFingering('six-hole-unverified', 'Sa'), undefined);
  assert.equal(resolveFingering('unknown', 'some-fingering'), undefined);
});

test('score validator catches overlaps, silent gaps, duplicate IDs, invalid timing, spelling, and broken references', () => {
  const mutations: ((score: typeof arrangements[number]) => void)[] = [
    score => { score.events[1].startTick = 1; },
    score => { score.events[1].startTick += 1; },
    score => { score.events[1].id = score.events[0].id; },
    score => { score.events[0].durationTicks = 0; },
    score => { score.events[0].startTick = -1; },
    score => { score.events[0].durationTicks = 0.5; },
    score => { score.bpm = Number.NaN; },
    score => { score.bpm = Number.POSITIVE_INFINITY; },
    score => { if (score.events[0].kind === 'note') score.events[0].semitonesFromSa = 1; },
    score => { if (score.events[0].kind === 'note') score.events[0].alteration = 'komal'; },
    score => { if (score.events[0].kind === 'note') score.events[0].fingeringId = 'invented'; },
    score => { score.phrases[0].endTick = 241; },
    score => { score.phrases[1].id = score.phrases[0].id; },
    score => { score.breathMarks[0].tick = 200000; },
    score => { score.instrumentProfileIds = ['unknown']; },
    score => { score.prerequisites = ['unknown']; },
    score => { score.songId = 'unknown'; },
  ];
  for (const mutate of mutations) {
    const changed = structuredClone(arrangements[0]);
    mutate(changed);
    assert.ok(validateArrangement(changed).length > 0, String(mutate));
  }
  assert.ok(validateArrangement(null).length > 0);
  assert.ok(validateArrangement({ events: [null] }).length > 0);
});

test('score spelling accounts for lower and upper octaves and supported alterations', () => {
  const changed = structuredClone(arrangements[0]);
  if (changed.events[0].kind !== 'note') throw new Error('Expected note fixture');
  Object.assign(changed.events[0], { swara: 'Re', alteration: 'komal', octave: -1, semitonesFromSa: -11 });
  assert.deepEqual(validateArrangement(changed), []);
  Object.assign(changed.events[0], { swara: 'Ma', alteration: 'tivra', octave: 1, semitonesFromSa: 18 });
  assert.deepEqual(validateArrangement(changed), []);
});

test('settings, completed lessons, and attempt history survive save/export/import without a database', async () => {
  local.failWrites = false;
  await resetData();
  saveSettings({ ...defaults, theme: 'dark', saMidi: 62, setupDone: true });
  setLessonComplete(lessons[0].id, true);
  await saveAttempt(attempt());
  await saveAttempt(attempt({ id: 'test-attempt-2', startedAt: '2026-09-20T13:00:00.000Z', activeSeconds: 4, completed: false }));
  const backup = await exportData();
  await resetData();
  assert.equal((await listAttempts()).length, 0);
  await importData(backup);
  assert.equal(loadSettings().theme, 'dark');
  assert.equal(loadSettings().saMidi, 62);
  assert.deepEqual(getCompletedLessons(), [lessons[0].id]);
  const history = await listAttempts();
  assert.equal(history.length, 2);
  assert.equal(history[0].id, 'test-attempt-2');
  assert.equal(history[0].completed, false);
  await saveAttempt(attempt({ activeSeconds: 9 }));
  assert.equal((await listAttempts()).length, 2, 'Same attempt ID updates instead of double counting');
  assert.equal((await listAttempts()).find(item => item.id === 'test-attempt')?.activeSeconds, 9);
});

test('malformed imports fail before changing settings or progress', async () => {
  await resetData();
  saveSettings({ ...defaults, saMidi: 64 });
  setLessonComplete(lessons[1].id, true);
  const good = JSON.parse(await exportData());
  const malformed = [
    'not json', '{}', JSON.stringify({ ...good, schemaVersion: 2 }),
    JSON.stringify({ ...good, unknown: 'unexpected field' }),
    JSON.stringify({ ...good, settings: { ...good.settings, saMidi: 1000 } }),
    JSON.stringify({ ...good, settings: { ...good.settings, showWestern: 'yes' } }),
    JSON.stringify({ ...good, completedLessons: ['unknown-lesson'] }),
    JSON.stringify({ ...good, attempts: [attempt(), attempt()] }),
    JSON.stringify({ ...good, attempts: [attempt({ arrangementId: 'unknown' })] }),
    JSON.stringify({ ...good, attempts: [attempt({ activeSeconds: -10 })] }),
  ];
  for (const json of malformed) {
    assert.throws(() => parseImport(json));
    await assert.rejects(importData(json));
    assert.equal(loadSettings().saMidi, 64);
    assert.deepEqual(getCompletedLessons(), [lessons[1].id]);
  }
});

test('attempt validation rejects fabricated reference scores and inadequate coverage', () => {
  assert.equal(validateAttempt(attempt()), true);
  assert.equal(validateAttempt(attempt({ mode: 'listen', pitchAccuracy: 100, coverage: 100 })), false);
  assert.equal(validateAttempt(attempt({ mode: 'microphone', pitchAccuracy: 100, coverage: 0 })), false);
  assert.equal(validateAttempt(attempt({ mode: 'microphone', pitchAccuracy: 95, coverage: null })), false);
  assert.equal(validateAttempt(attempt({ mode: 'microphone', pitchAccuracy: null, coverage: 0 })), true);
  assert.equal(validateAttempt(attempt({ mode: 'microphone', pitchAccuracy: 90, coverage: 85 })), true);
  assert.equal(validateAttempt(attempt({ mode: 'note-by-note', pitchAccuracy: 90, coverage: 85, rhythmMs: 10 })), false);
  assert.equal(validateAttempt(attempt({ phraseId: 'invented' })), false);
  assert.equal(validateAttempt(attempt({ startedAt: 'yesterday' })), false);
});

test('quota failures retain newer settings and lessons in memory for export', async () => {
  await resetData();
  saveSettings({ ...defaults, saMidi: 60 });
  setLessonComplete(lessons[0].id, true);
  await saveAttempt(attempt({ activeSeconds: 3 }));
  local.failWrites = true;
  saveSettings({ ...defaults, saMidi: 65 });
  setLessonComplete(lessons[1].id, true);
  await saveAttempt(attempt({ activeSeconds: 12 }));
  assert.equal(loadSettings().saMidi, 65);
  assert.deepEqual(getCompletedLessons(), [lessons[0].id, lessons[1].id]);
  const exported = parseImport(await exportData());
  assert.equal(exported.settings.saMidi, 65);
  assert.equal(exported.completedLessons.length, 2);
  assert.equal(exported.attempts[0].activeSeconds, 12);
  assert.match(getStorageWarning() ?? '', /full|unavailable/);
  local.failWrites = false;
  await resetData();
});
