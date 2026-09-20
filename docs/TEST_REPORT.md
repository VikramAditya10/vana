# Verification report

Prepared 21 September 2026. This report records observed checks; a feature's implementation does not imply it has passed physical-device or musical review.

## Environment

- Development host: Windows, PowerShell.
- Available local runtime: Node.js `v25.1.0`, pnpm `10.20.0`.
- GitHub Actions target: Node.js 22, pnpm 10, Ubuntu hosted runner.
- Dossier React package declarations inspected: `@vikramaditya1010/react` `0.1.1`, React peer requirement `>=18`, `paper` and `dark` themes, package `styles.css` export.

## Automated checks

Final application tests and production build are pending integration at the time of this report draft. Update this section with the actual command results before handing over the finished application.

The deployment workflow runs `pnpm install --frozen-lockfile`, `pnpm test`, and `pnpm build` before uploading a Pages artifact. Pull requests run the checks without deploying. GitHub's workflow has been prepared but has not been run against the remote repository.

## Browser and device checks

The final browser pass is pending integration. No Firefox, Android Chrome, or iOS Safari device result is claimed. Microphone accuracy has not been validated with a real bansuri or teacher trial. No measured claim is made about a 50 ms audio/visual alignment target or three-minute drift until device measurements are recorded.

## Content review and limits

- Six-hole numbering illustrations are separate from playable, verified fingering profiles. No teacher verification metadata was supplied.
- The six familiar-song catalogue entries remain unavailable pending approved arrangements, provenance, permissions, and review.
- Reference audio is locally synthesised teaching sound, not a recorded bansuri performance.
- Equal-tempered pitch targets provide a practice reference and do not establish authentic raga intonation.
- Synthetic pitch detector fixtures cannot substitute for real-instrument and noisy-room evaluation.
- The app must not claim rhythm accuracy from sustained pitch detection alone, or score its own reference audio as the learner's playing.

## Scope still awaiting implementation or validation

- Teacher-reviewed note fingerings and their animated covered-hole rendering; the current diagram identifies anatomy and explicitly reports unavailable fingerings.
- Approved, timed popular-song arrangements and the associated reviewed-song catalogue states. All six familiar titles remain pending.
- Automatic device-latency measurement, reliable onset/rhythm scoring, and validation against real flute recordings. A manual latency offset and noise-floor calibration do not establish hardware latency automatically.
- Optional note-by-note advancement, bookmarks, advanced ornaments, and reviewed tala or 6/8 beat grouping.
- Real-device verification of microphone settings, audio/visual latency, interrupted audio, mobile audio restrictions, and long-session drift. Platform differences may affect input latency, microphone processing, and pitch confidence.

## Suggested physical-device acceptance pass

1. On desktop Chromium and Firefox, Android Chrome, and iOS Safari, record actual browser/device versions and try the setup, lesson, playback, slow speed, phrase loop, progress save, reload, and export/import flows.
2. Listen for duplicate or stuck notes after pause, seek, speed change, loop changes, route navigation, and tab backgrounding; measure timing against the Web Audio clock over three minutes.
3. With headphones and a real bansuri, verify microphone allow, deny, unavailable, low signal, calibration, octave handling, and stable known pitches; do not accept silence or speaker leakage as successful playing.
4. Check keyboard focus, Space playback outside form controls, reduced motion, both themes, and narrow mobile layouts.
5. Review all instructional content, fingerings, and any new song arrangement with a competent bansuri teacher before changing review status.
