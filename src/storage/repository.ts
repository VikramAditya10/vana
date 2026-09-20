import { arrangements, lessons } from '../content/catalog';

export type Settings = {
  theme: 'paper' | 'dark';
  saMidi: number;
  printedScale: string;
  showWestern: boolean;
  hasBansuri: 'yes' | 'no' | 'unsure';
  experience: 'new' | 'some';
  setupDone: boolean;
  countIn: boolean;
  referenceVolume: number;
  metronomeVolume: number;
  latencyMs: number;
  toleranceCents: number;
  reduceMotion: boolean;
};

export const defaults: Settings = {
  theme: 'paper', saMidi: 60, printedScale: '', showWestern: false,
  hasBansuri: 'unsure', experience: 'new', setupDone: false, countIn: true,
  referenceVolume: 0.35, metronomeVolume: 0.25, latencyMs: 0,
  toleranceCents: 50, reduceMotion: false,
};

export type Attempt = {
  id: string;
  arrangementId: string;
  arrangementVersion: number;
  phraseId: string;
  saMidi: number;
  bpm: number;
  speed: number;
  mode: 'listen' | 'follow' | 'repeat' | 'microphone' | 'note-by-note';
  startedAt: string;
  activeSeconds: number;
  completed: boolean;
  pitchAccuracy: number | null;
  coverage: number | null;
  rhythmMs: number | null;
  scoringVersion: string;
  latencyMs: number;
  toleranceCents: number;
};

export type DataExport = {
  schemaVersion: 1;
  exportedAt: string;
  settings: Settings;
  completedLessons: string[];
  attempts: Attempt[];
};

const SETTINGS_KEY = 'bansuri-practice:settings:v1';
const LESSONS_KEY = 'bansuri-practice:lessons:v1';
const ATTEMPTS_KEY = 'bansuri-practice:attempts:v1';
const DATABASE_NAME = 'bansuri-practice';
let storageWarning: string | null = null;
let memorySettings: Settings = { ...defaults };
let memoryLessons: string[] = [];
let memoryAttempts: Attempt[] = [];
let databasePromise: Promise<IDBDatabase | null> | undefined;
let settingsDirty = false;
let lessonsDirty = false;
let attemptsDirty = false;

export function getStorageWarning(): string | null { return storageWarning; }

function storage(): Storage | null {
  try {
    if (typeof globalThis.localStorage !== 'undefined') return globalThis.localStorage;
  } catch { /* Some private modes throw on the property access. */ }
  storageWarning = 'Browser storage is unavailable. Progress is kept only while this page stays open; export it before leaving.';
  return null;
}

function readLocal(key: string): unknown {
  const local = storage();
  if (!local) return undefined;
  try {
    const raw = local.getItem(key);
    return raw === null ? undefined : JSON.parse(raw);
  } catch {
    storageWarning = 'Some saved browser data could not be read. Your current session is still usable; export a backup.';
    return undefined;
  }
}

function writeLocal(key: string, data: unknown): boolean {
  const local = storage();
  if (!local) return false;
  try { local.setItem(key, JSON.stringify(data)); return true; }
  catch {
    storageWarning = 'Browser storage is full or unavailable. New changes are held for this page session; export your progress before leaving.';
    return false;
  }
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const numberIn = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
const stringIn = (value: unknown, max = 200): value is string => typeof value === 'string' && value.length > 0 && value.length <= max;
const integerIn = (value: unknown, min: number, max: number): value is number => numberIn(value, min, max) && Number.isInteger(value);

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
}

const settingKeys = Object.keys(defaults);
export function validateSettings(value: unknown): value is Settings {
  if (!record(value) || !exactKeys(value, settingKeys)) return false;
  return (value.theme === 'paper' || value.theme === 'dark') && integerIn(value.saMidi, 36, 84) &&
    typeof value.printedScale === 'string' && value.printedScale.length <= 80 &&
    ['yes', 'no', 'unsure'].includes(String(value.hasBansuri)) && ['new', 'some'].includes(String(value.experience)) &&
    ['showWestern', 'setupDone', 'countIn', 'reduceMotion'].every(key => typeof value[key] === 'boolean') &&
    numberIn(value.referenceVolume, 0, 1) && numberIn(value.metronomeVolume, 0, 1) &&
    numberIn(value.latencyMs, -1000, 1000) && numberIn(value.toleranceCents, 10, 100);
}

function validLessons(value: unknown): value is string[] {
  return Array.isArray(value) && value.length <= lessons.length && new Set(value).size === value.length &&
    value.every(id => typeof id === 'string' && lessons.some(lesson => lesson.id === id));
}

const attemptKeys: (keyof Attempt)[] = ['id', 'arrangementId', 'arrangementVersion', 'phraseId', 'saMidi', 'bpm', 'speed',
  'mode', 'startedAt', 'activeSeconds', 'completed', 'pitchAccuracy', 'coverage', 'rhythmMs', 'scoringVersion', 'latencyMs', 'toleranceCents'];

export function validateAttempt(value: unknown): value is Attempt {
  if (!record(value) || !exactKeys(value, attemptKeys)) return false;
  const arrangement = arrangements.find(item => item.id === value.arrangementId);
  // Allow older arrangement versions so historical results remain meaningful after a content update.
  if (!arrangement || !integerIn(value.arrangementVersion, 1, arrangement.version) ||
    !(value.phraseId === 'all' || value.phraseId === 'whole' || arrangement.phrases.some(phrase => phrase.id === value.phraseId))) return false;
  if (!stringIn(value.id) || !integerIn(value.saMidi, 36, 84) || !numberIn(value.bpm, 10, 600) || !numberIn(value.speed, 0.25, 2) ||
    !['listen', 'follow', 'repeat', 'microphone', 'note-by-note'].includes(String(value.mode)) ||
    !stringIn(value.startedAt, 40) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/.test(value.startedAt) || !Number.isFinite(Date.parse(value.startedAt)) ||
    !numberIn(value.activeSeconds, 0, 86400) || typeof value.completed !== 'boolean' || !stringIn(value.scoringVersion, 100) ||
    !numberIn(value.latencyMs, -1000, 1000) || !numberIn(value.toleranceCents, 10, 100)) return false;
  if (!(value.pitchAccuracy === null || numberIn(value.pitchAccuracy, 0, 100)) ||
    !(value.coverage === null || numberIn(value.coverage, 0, 100)) ||
    !(value.rhythmMs === null || numberIn(value.rhythmMs, -10000, 10000))) return false;
  // Manual or reference playback cannot be promoted to measured performance in an imported history.
  if (!['microphone', 'note-by-note'].includes(String(value.mode)) &&
    (value.pitchAccuracy !== null || value.coverage !== null || value.rhythmMs !== null)) return false;
  if (value.pitchAccuracy !== null && (value.coverage === null || value.coverage < 20)) return false;
  if (value.mode === 'note-by-note' && value.rhythmMs !== null) return false;
  return true;
}

function validAttempts(value: unknown): value is Attempt[] {
  return Array.isArray(value) && value.length <= 50000 && value.every(validateAttempt) && new Set(value.map(item => item.id)).size === value.length;
}

export function loadSettings(): Settings {
  if (settingsDirty) return { ...memorySettings };
  const saved = readLocal(SETTINGS_KEY);
  if (validateSettings(saved)) memorySettings = { ...saved };
  else if (saved !== undefined) storageWarning = 'Saved settings were incompatible. Default settings are being used.';
  return { ...memorySettings };
}

export function saveSettings(settings: Settings): void {
  if (!validateSettings(settings)) throw new Error('Settings are invalid. Check the tonic, volume, and calibration values.');
  memorySettings = { ...settings };
  settingsDirty = !writeLocal(SETTINGS_KEY, memorySettings);
}

export function getCompletedLessons(): string[] {
  if (lessonsDirty) return [...memoryLessons];
  const saved = readLocal(LESSONS_KEY);
  if (validLessons(saved)) memoryLessons = [...saved];
  else if (saved !== undefined) storageWarning = 'Some saved lesson completion data was incompatible and could not be loaded.';
  return [...memoryLessons];
}

export function setLessonComplete(id: string, complete: boolean): void {
  if (!lessons.some(lesson => lesson.id === id)) throw new Error('This lesson does not exist.');
  const completed = new Set(getCompletedLessons());
  if (complete) completed.add(id); else completed.delete(id);
  memoryLessons = [...completed];
  lessonsDirty = !writeLocal(LESSONS_KEY, memoryLessons);
}

async function database(): Promise<IDBDatabase | null> {
  if (databasePromise) return databasePromise;
  databasePromise = new Promise(resolve => {
    let factory: IDBFactory;
    try {
      if (typeof globalThis.indexedDB === 'undefined') { resolve(null); return; }
      factory = globalThis.indexedDB;
    } catch { resolve(null); return; }
    let settled = false;
    const finish = (db: IDBDatabase | null) => {
      if (settled) { db?.close(); return; }
      settled = true; clearTimeout(timeout); resolve(db);
    };
    const timeout = setTimeout(() => {
      storageWarning = 'The practice database could not open. A browser-storage backup is being used.';
      finish(null);
    }, 3000);
    try {
      const request = factory.open(DATABASE_NAME, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains('attempts')) request.result.createObjectStore('attempts', { keyPath: 'id' });
      };
      request.onsuccess = () => {
        request.result.onversionchange = () => { request.result.close(); databasePromise = undefined; };
        finish(request.result);
      };
      request.onerror = () => finish(null);
      request.onblocked = () => {
        storageWarning = 'Another tab is blocking the practice database. A browser-storage backup is being used.';
        finish(null);
      };
    } catch { finish(null); }
  });
  return databasePromise;
}

async function readDatabase(db: IDBDatabase): Promise<Attempt[]> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('attempts', 'readonly');
    const request = transaction.objectStore('attempts').getAll();
    let result: Attempt[] = [];
    request.onsuccess = () => {
      if (!validAttempts(request.result)) { reject(new Error('Saved attempts are incompatible.')); return; }
      result = request.result;
    };
    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(transaction.error ?? new Error('Cannot read practice history.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('Practice history read was interrupted.'));
  });
}

async function writeDatabase(db: IDBDatabase, attempts: Attempt[], replace: boolean): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('attempts', 'readwrite');
    const store = transaction.objectStore('attempts');
    if (replace) store.clear();
    for (const attempt of attempts) store.put(attempt);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('Cannot save practice history.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('Practice history save was interrupted.'));
  });
}

function backupAttempts(): Attempt[] | undefined {
  const backup = readLocal(ATTEMPTS_KEY);
  if (validAttempts(backup)) return backup;
  if (backup !== undefined) storageWarning = 'The history backup could not be read. Existing valid session data is still available.';
  return undefined;
}

function mergeAttempts(...groups: Attempt[][]): Attempt[] {
  const byId = new Map<string, Attempt>();
  for (const group of groups) for (const attempt of group) byId.set(attempt.id, { ...attempt });
  return [...byId.values()].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export async function listAttempts(): Promise<Attempt[]> {
  if (attemptsDirty) return memoryAttempts.map(attempt => ({ ...attempt }));
  // A fallback snapshot is authoritative until successfully migrated to IndexedDB.
  // This prevents old database rows from reappearing after a replacement import.
  const backup = backupAttempts();
  if (backup) {
    memoryAttempts = mergeAttempts(backup);
    return memoryAttempts.map(attempt => ({ ...attempt }));
  }
  const db = await database();
  let stored: Attempt[] = [];
  if (db) {
    try { stored = await readDatabase(db); }
    catch { storageWarning = 'The practice database is unavailable. A backup or this page’s session data is being shown.'; }
  }
  memoryAttempts = mergeAttempts(stored, memoryAttempts);
  return memoryAttempts.map(attempt => ({ ...attempt }));
}

export async function saveAttempt(attempt: Attempt): Promise<void> {
  if (!validateAttempt(attempt)) throw new Error('This practice attempt contains invalid or incompatible data and was not saved.');
  const db = await database();
  memoryAttempts = mergeAttempts(await listAttempts(), [attempt]);
  if (db) {
    try {
      // Include fallback rows when recovering a formerly unavailable database.
      await writeDatabase(db, memoryAttempts, true);
      const local = storage();
      try { local?.removeItem(ATTEMPTS_KEY); }
      catch {
        // Keep an existing backup current if it cannot be removed.
        attemptsDirty = !writeLocal(ATTEMPTS_KEY, memoryAttempts);
        return;
      }
      attemptsDirty = false;
      return;
    }
    catch { storageWarning = 'The practice database could not save. A browser-storage backup is being used.'; }
  }
  attemptsDirty = !writeLocal(ATTEMPTS_KEY, memoryAttempts);
}

export async function exportData(): Promise<string> {
  const data: DataExport = {
    schemaVersion: 1, exportedAt: new Date().toISOString(), settings: loadSettings(),
    completedLessons: getCompletedLessons(), attempts: await listAttempts(),
  };
  return JSON.stringify(data, null, 2);
}

/** Validates all content before changing any stored data. Import replaces local progress. */
export function parseImport(json: string): DataExport {
  if (json.length > 25000000) throw new Error('The backup is too large. Use a Bansuri Practice JSON export smaller than 25 MB.');
  let value: unknown;
  try { value = JSON.parse(json); }
  catch { throw new Error('This file is not valid JSON. Choose a Bansuri Practice progress export.'); }
  if (!record(value) || !exactKeys(value, ['schemaVersion', 'exportedAt', 'settings', 'completedLessons', 'attempts']) || value.schemaVersion !== 1) {
    throw new Error('Unsupported backup format. Expected a Bansuri Practice export with schemaVersion 1.');
  }
  if (!stringIn(value.exportedAt, 40) || !Number.isFinite(Date.parse(value.exportedAt))) throw new Error('The backup export date is invalid.');
  if (!validateSettings(value.settings)) throw new Error('The backup has invalid settings. No data was imported.');
  if (!validLessons(value.completedLessons)) throw new Error('The backup contains unknown or duplicate lessons. No data was imported.');
  if (!validAttempts(value.attempts)) throw new Error('The backup contains invalid, duplicate, or incompatible practice attempts. No data was imported.');
  return value as DataExport;
}

export async function importData(json: string): Promise<void> {
  const data = parseImport(json);
  const db = await database();
  let databaseSaved = false;
  if (db) {
    try { await writeDatabase(db, data.attempts, true); databaseSaved = true; }
    catch { storageWarning = 'Imported history could not reach the practice database. A browser-storage backup is being used.'; }
  }
  memoryAttempts = data.attempts.map(attempt => ({ ...attempt }));
  // Persist the replacement backup even if the database succeeded, so an old fallback cannot reappear.
  attemptsDirty = !writeLocal(ATTEMPTS_KEY, memoryAttempts);
  memorySettings = { ...data.settings };
  memoryLessons = [...data.completedLessons];
  settingsDirty = !writeLocal(SETTINGS_KEY, memorySettings);
  lessonsDirty = !writeLocal(LESSONS_KEY, memoryLessons);
  if (!databaseSaved && db) {
    // Stop reading stale database rows after a failed replacement in this session.
    db.close(); databasePromise = Promise.resolve(null);
  }
}

/** The caller presents the confirmation UI before invoking this destructive action. */
export async function resetData(): Promise<void> {
  const db = await database();
  if (db) {
    try { await writeDatabase(db, [], true); }
    catch {
      storageWarning = 'The practice database could not be cleared. Close other tabs and try deleting local progress again.';
      throw new Error(storageWarning);
    }
  }
  const local = storage();
  try {
    local?.removeItem(SETTINGS_KEY);
    local?.removeItem(LESSONS_KEY);
    local?.removeItem(ATTEMPTS_KEY);
  } catch {
    storageWarning = 'Some browser data could not be deleted. Please clear site data in your browser settings.';
    throw new Error(storageWarning);
  }
  memorySettings = { ...defaults }; memoryLessons = []; memoryAttempts = [];
  settingsDirty = false; lessonsDirty = false; attemptsDirty = false;
}
