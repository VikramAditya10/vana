import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Button, DocumentHeader, Metric, MetricGroup, Progress, Section, Status, Tag
} from '@vikramaditya1010/react';
import { arrangements, lessons, type Lesson } from './content/catalog';
import { AudioTransport } from './audio/transport';
import { midiName, midiToHz } from './audio/pitch';
import {
  getCompletedLessons, listAttempts, loadSettings, saveSettings,
  type Attempt, type Settings
} from './storage/repository';
import { LearnPage, LibraryPage, NotFound, ProgressPage, SettingsPage, TunerPage } from './features/Pages';
import { FingeringPage } from './features/FingeringPage';
import { Practice, timeLabel } from './features/Practice';

type RouteView = 'home' | 'learn' | 'songs' | 'practice' | 'tuner' | 'fingering' | 'progress' | 'settings' | 'not-found';

type RouteState = {
  view: RouteView;
  param?: string;
};

function parseHash(hash: string): RouteState {
  const clean = hash.replace(/^#\/?/, '').trim();
  if (!clean) return { view: 'home' };
  const [segment, param] = clean.split('/');
  if (segment === 'learn') return { view: 'learn', param };
  if (segment === 'songs') return { view: 'songs', param };
  if (segment === 'practice') return { view: 'practice', param: param || arrangements[0].id };
  if (segment === 'tools' && param === 'tuner') return { view: 'tuner' };
  if (segment === 'tuner') return { view: 'tuner' };
  if (segment === 'fingering' || (segment === 'tools' && param === 'fingering')) return { view: 'fingering' };
  if (segment === 'progress') return { view: 'progress' };
  if (segment === 'settings') return { view: 'settings' };
  return { view: 'not-found' };
}

function loadBookmarks(): string[] {
  try {
    const raw = localStorage.getItem('bansuri-practice:bookmarks:v1');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveBookmarks(bookmarks: string[]) {
  try {
    localStorage.setItem('bansuri-practice:bookmarks:v1', JSON.stringify(bookmarks));
  } catch {
    // Storage quota or disabled
  }
}

function HomeView({
  settings,
  completedLessons,
  attempts,
  onDismissSetup,
  onUpdateSettings,
}: {
  settings: Settings;
  completedLessons: string[];
  attempts: Attempt[];
  onDismissSetup: () => void;
  onUpdateSettings: (patch: Partial<Settings>) => void;
}) {
  const nextLesson: Lesson = lessons.find(l => !completedLessons.includes(l.id)) ?? lessons[0];
  const totalMinutes = (attempts.reduce((sum, a) => sum + a.activeSeconds, 0) / 60).toFixed(1);
  const quickArrangement = arrangements[0];
  const quickTransport = useRef<AudioTransport | null>(null);
  const [isPlayingQuick, setIsPlayingQuick] = useState(false);
  const [quickError, setQuickError] = useState('');

  useEffect(() => {
    return () => {
      quickTransport.current?.dispose();
    };
  }, []);

  async function toggleQuickPreview() {
    setQuickError('');
    if (isPlayingQuick) {
      quickTransport.current?.pause();
      setIsPlayingQuick(false);
      return;
    }
    try {
      quickTransport.current?.dispose();
      const engine = new AudioTransport(quickArrangement, {
        saMidi: settings.saMidi,
        countIn: false,
        loop: false,
        metronome: false,
        referenceVolume: settings.referenceVolume,
      });
      quickTransport.current = engine;
      engine.onComplete = () => setIsPlayingQuick(false);
      await engine.play();
      setIsPlayingQuick(true);
    } catch {
      setQuickError('Audio could not start. Click anywhere to activate audio in your browser.');
      setIsPlayingQuick(false);
    }
  }

  return (
    <div className="home-page">
      <DocumentHeader
        kicker="BANSURI PRACTICE / HOME"
        title="Play one phrase with intention."
        description="A quiet, focused practice room for the six-hole Indian bansuri. Follow the notes, see the holes, and let the rhythm stay visible."
        metadata={[
          ['SA PITCH', `${midiName(settings.saMidi)} (${midiToHz(settings.saMidi).toFixed(1)} Hz)`],
          ['PROFILE', '6-HOLE TRANSVERSE'],
          ['CURRICULUM', `${completedLessons.length} OF ${lessons.length} COMPLETE`],
        ]}
        actions={
          <div className="button-row">
            <Button variant="solid" onClick={() => { window.location.hash = `/practice/${quickArrangement.id}`; }}>
              Start practice →
            </Button>
          </div>
        }
      />

      {!settings.setupDone && (
        <div className="onboarding-card">
          <div className="onboarding-header">
            <div>
              <span className="eyebrow">FIRST VISIT SETUP</span>
              <h3>Welcome to Bansuri Practice</h3>
              <p>Take 10 seconds to configure your instrument profile and pitch, or jump straight into practice.</p>
            </div>
            <Status tone="info">Guest mode</Status>
          </div>
          <div className="onboarding-grid">
            <label className="field">
              Do you have a six-hole bansuri?
              <select
                value={settings.hasBansuri}
                onChange={e => onUpdateSettings({ hasBansuri: e.target.value as Settings['hasBansuri'] })}
              >
                <option value="yes">Yes, six-hole transverse</option>
                <option value="no">Not yet — exploring the sound</option>
                <option value="unsure">I'm not sure</option>
              </select>
            </label>
            <label className="field">
              Experience level
              <select
                value={settings.experience}
                onChange={e => onUpdateSettings({ experience: e.target.value as Settings['experience'] })}
              >
                <option value="new">Complete beginner</option>
                <option value="some">I know a few swaras</option>
              </select>
            </label>
            <label className="field">
              Base tonic (Sa)
              <select
                value={settings.saMidi}
                onChange={e => onUpdateSettings({ saMidi: Number(e.target.value) })}
              >
                {[55, 57, 58, 60, 62, 64, 65, 67].map(m => (
                  <option key={m} value={m}>
                    {midiName(m)} · {midiToHz(m).toFixed(1)} Hz
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="button-row onboarding-actions">
            <Button variant="solid" onClick={onDismissSetup}>
              Save and continue
            </Button>
            <Button onClick={() => { window.location.hash = '/tools/tuner'; }}>
              Find Sa with Tuner ↗
            </Button>
            <Button variant="ghost" onClick={onDismissSetup}>
              Skip setup
            </Button>
          </div>
        </div>
      )}

      <div className="home-layout">
        <div className="home-main">
          <Section title="Quick practice room" index="01" description="Listen to the teaching tone or start timed practice.">
            <div className="quick-practice-card">
              <div className="quick-card-header">
                <div>
                  <span className="eyebrow">EXERCISE 01 / {quickArrangement.difficulty.toUpperCase()}</span>
                  <h3>{quickArrangement.title}</h3>
                  <p>{quickArrangement.description}</p>
                </div>
                <Tag>{quickArrangement.bpm} BPM · {quickArrangement.timeSignature.join('/')}</Tag>
              </div>

              <div className="quick-timeline-preview">
                {quickArrangement.events.map((ev, i) => (
                  <span key={i} className={`quick-note ${ev.kind === 'note' ? 'is-note' : 'is-rest'}`}>
                    {ev.kind === 'note' ? ev.swara : '—'}
                  </span>
                ))}
              </div>

              <div className="quick-actions">
                <Button variant={isPlayingQuick ? 'solid' : 'outline'} onClick={toggleQuickPreview}>
                  {isPlayingQuick ? '■ Stop tone' : '♪ Hear melody'}
                </Button>
                <Button variant="solid" onClick={() => { window.location.hash = `/practice/${quickArrangement.id}`; }}>
                  Open practice workspace →
                </Button>
                <span className="fine-print">Synthesized bansuri teaching tone</span>
              </div>
              {quickError && <p role="alert" className="error-text">{quickError}</p>}
            </div>
          </Section>

          <Section title="Recent practice sessions" index="02" description="Practice saved locally on this browser.">
            {attempts.length === 0 ? (
              <div className="empty-session-box">
                <span className="empty-mark">—</span>
                <div>
                  <b>No recorded practice yet</b>
                  <p>Play any exercise in the practice workspace to record your active time and progress.</p>
                </div>
              </div>
            ) : (
              <div className="session-list">
                {attempts.slice(-3).reverse().map(a => (
                  <article key={a.id} className="session-row">
                    <div>
                      <span className="eyebrow">{new Date(a.startedAt).toLocaleDateString()} · {new Date(a.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      <h3>{arrangements.find(x => x.id === a.arrangementId)?.title ?? a.arrangementId}</h3>
                      <p>{a.mode} · {timeLabel(a.activeSeconds)} active · {midiName(a.saMidi)} · {Math.round(a.bpm * a.speed)} BPM</p>
                    </div>
                    <div className="session-result">
                      <Status tone={a.completed ? 'success' : 'neutral'}>
                        {a.completed ? '✓ Completed' : 'Practised'}
                      </Status>
                      {a.mode === 'microphone' && (
                        <small>
                          {a.pitchAccuracy === null ? 'Low signal' : `${Math.round(a.pitchAccuracy)}% accuracy`}
                        </small>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </Section>
        </div>

        <aside className="home-aside">
          <Section title="Next lesson" index="03">
            <div className="next-lesson-card">
              <span className="lesson-badge">LESSON {String(nextLesson.number).padStart(2, '0')}</span>
              <h3>{nextLesson.title}</h3>
              <p>{nextLesson.description}</p>
              <div className="button-row">
                <Button variant="outline" onClick={() => { window.location.hash = `/learn/${nextLesson.id}`; }}>
                  Read lesson →
                </Button>
              </div>
            </div>
          </Section>

          <Section title="Curriculum progress" index="04">
            <div className="progress-card">
              <div className="progress-stat">
                <b>{completedLessons.length} of {lessons.length}</b>
                <span>lessons completed</span>
              </div>
              <Progress value={(completedLessons.length / lessons.length) * 100} label="Curriculum" showValue={false} />
              <a href="#/learn" className="action-link">View all 10 lessons ↗</a>
            </div>
          </Section>

          <Section title="Today's practice" index="05">
            <MetricGroup columns={2}>
              <Metric label="MINUTES" value={totalMinutes} tone="info" />
              <Metric label="SESSIONS" value={String(attempts.length).padStart(2, '0')} tone="success" />
            </MetricGroup>
          </Section>
        </aside>
      </div>
    </div>
  );
}

export function App() {
  const [route, setRoute] = useState<RouteState>(() => parseHash(window.location.hash));
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [completedLessons, setCompletedLessons] = useState<string[]>(() => getCompletedLessons());
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [bookmarks, setBookmarks] = useState<string[]>(() => loadBookmarks());

  useEffect(() => {
    void listAttempts().then(setAttempts).catch(() => setAttempts([]));
  }, []);

  useEffect(() => {
    const handleHashChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.dossierTheme = settings.theme;
  }, [settings.theme]);

  function refreshAll() {
    setSettings(loadSettings());
    setCompletedLessons(getCompletedLessons());
    void listAttempts().then(setAttempts).catch(() => undefined);
  }

  function handleUpdateSettings(patch: Partial<Settings>) {
    setSettings(prev => {
      const updated = { ...prev, ...patch };
      saveSettings(updated);
      return updated;
    });
  }

  function toggleTheme() {
    const next = settings.theme === 'paper' ? 'dark' : 'paper';
    handleUpdateSettings({ theme: next });
  }

  function toggleBookmark(id: string) {
    const next = bookmarks.includes(id) ? bookmarks.filter(b => b !== id) : [...bookmarks, id];
    setBookmarks(next);
    saveBookmarks(next);
  }

  const activeNav = useMemo(() => {
    if (route.view === 'learn') return 'learn';
    if (route.view === 'songs') return 'songs';
    if (route.view === 'practice') return 'practice';
    if (route.view === 'tuner') return 'tuner';
    if (route.view === 'fingering') return 'fingering';
    if (route.view === 'progress') return 'progress';
    if (route.view === 'settings') return 'settings';
    return 'home';
  }, [route.view]);

  return (
    <div className="app-shell" data-dossier-theme={settings.theme}>
      <header className="app-header">
        <a className="app-brand" href="#/">
          <span className="brand-mark">B_</span>
          <span>
            <b>BANSURI</b>
            <small>PRACTICE / 001</small>
          </span>
        </a>

        <nav aria-label="Primary navigation">
          <button
            className={activeNav === 'home' ? 'is-active' : ''}
            onClick={() => { window.location.hash = '/'; }}
          >
            Today
          </button>
          <button
            className={activeNav === 'learn' ? 'is-active' : ''}
            onClick={() => { window.location.hash = '/learn'; }}
          >
            Learn
          </button>
          <button
            className={activeNav === 'songs' ? 'is-active' : ''}
            onClick={() => { window.location.hash = '/songs'; }}
          >
            Song Library
          </button>
          <button
            className={activeNav === 'practice' ? 'is-active' : ''}
            onClick={() => { window.location.hash = `/practice/${arrangements[0].id}`; }}
          >
            Practice Room
          </button>
          <button
            className={activeNav === 'tuner' ? 'is-active' : ''}
            onClick={() => { window.location.hash = '/tools/tuner'; }}
          >
            Tuner
          </button>
          <button
            className={activeNav === 'fingering' ? 'is-active' : ''}
            onClick={() => { window.location.hash = '/fingering'; }}
          >
            Fingering
          </button>
          <button
            className={activeNav === 'progress' ? 'is-active' : ''}
            onClick={() => { window.location.hash = '/progress'; }}
          >
            Progress
          </button>
          <button
            className={activeNav === 'settings' ? 'is-active' : ''}
            onClick={() => { window.location.hash = '/settings'; }}
          >
            Settings
          </button>
        </nav>

        <button
          className="theme-button"
          aria-label="Toggle appearance between Paper and Midnight"
          onClick={toggleTheme}
        >
          {settings.theme === 'paper' ? 'MIDNIGHT' : 'PAPER'}
        </button>
      </header>

      <main>
        <div className="page-context">
          <span>VANA / {activeNav.toUpperCase()}</span>
          <span>LOCAL PRACTICE · NO ACCOUNT REQUIRED</span>
        </div>

        {route.view === 'home' && (
          <HomeView
            settings={settings}
            completedLessons={completedLessons}
            attempts={attempts}
            onDismissSetup={() => handleUpdateSettings({ setupDone: true })}
            onUpdateSettings={handleUpdateSettings}
          />
        )}

        {route.view === 'learn' && (
          <LearnPage
            completed={completedLessons}
            lessonId={route.param}
            refresh={refreshAll}
          />
        )}

        {route.view === 'songs' && (
          <LibraryPage
            songId={route.param}
            bookmarks={bookmarks}
            toggleBookmark={toggleBookmark}
          />
        )}

        {route.view === 'practice' && (
          <Practice
            key={route.param || arrangements[0].id}
            arrangement={arrangements.find(a => a.id === route.param) ?? arrangements[0]}
            settings={settings}
            updateSettings={handleUpdateSettings}
            onSaved={refreshAll}
          />
        )}

        {route.view === 'tuner' && (
          <TunerPage
            settings={settings}
            updateSettings={handleUpdateSettings}
          />
        )}

        {route.view === 'fingering' && (
          <FingeringPage
            settings={settings}
          />
        )}

        {route.view === 'progress' && (
          <ProgressPage
            attempts={attempts}
            completed={completedLessons}
          />
        )}

        {route.view === 'settings' && (
          <SettingsPage
            settings={settings}
            updateSettings={handleUpdateSettings}
            refresh={refreshAll}
          />
        )}

        {route.view === 'not-found' && <NotFound />}
      </main>

      <footer>
        <div className="footer-meta">
          <b>BANSURI PRACTICE</b> / A BEGINNER'S COMPANION FOR SIX-HOLE TRANSVERSE FLUTE
        </div>
        <div className="footer-links">
          <span>BUILD 0.1.0</span>
          <span>·</span>
          <a href="https://vikramaditya10.github.io/dossier_ui/" target="_blank" rel="noreferrer">
            DOSSIER UI SPECIFICATION ↗
          </a>
        </div>
      </footer>
    </div>
  );
}