# Bansuri Practice

A browser app for learning and practising six-hole Indian bansuri, built with React, TypeScript, Vite, and [Vikram Aditya's Dossier UI](https://vikramaditya10.github.io/dossier_ui/). It runs as a static GitHub Pages site with no account, backend, API keys, or paid service.

## Run locally

Use Node.js **22.12 or newer** and pnpm **10**. From this `vana` directory:

```powershell
pnpm install --frozen-lockfile
pnpm dev
```

Open the URL printed by Vite. Select **Play** to hear a locally synthesised teaching tone. Browsers require this user interaction before allowing audio. The sound is generated with Web Audio; there are no remote audio assets or recorded bansuri samples to download.

```powershell
pnpm test
pnpm build
pnpm preview
```

`pnpm build` runs the TypeScript check and generates `dist/`. Use the preview server to inspect the production build; opening `index.html` through `file://` is not supported.

## Publish on GitHub Pages

This folder is already a Git repository configured with the remote `git@github.com:VikramAditya10/vana.git`. Publish **the contents of `vana` as the repository root**: `.github/`, `package.json`, `pnpm-lock.yaml`, `index.html`, and `src/` must be at the top level. Do not publish the parent `ai apps` folder or put the application in an extra `vana/` subfolder within this repository.

1. Commit and push the application source and `pnpm-lock.yaml` to the repository's `main` or `master` branch.
2. Open the repository's **Settings → Pages → Build and deployment** and select **GitHub Actions** as the source.
3. Open **Actions → Deploy Bansuri Practice** and run the workflow, or push a new commit to `main` or `master`.
4. After the workflow succeeds, open the page URL shown by the deployment. For the configured repository, the expected URL is [VikramAditya10.github.io/vana/](https://VikramAditya10.github.io/vana/).

The supplied [workflow](.github/workflows/deploy.yml) installs the locked dependencies, runs tests, builds the app, and deploys only the generated `dist/` artifact. Pull requests run the same test and build checks without deploying. No deployment has been performed as part of preparing this source.

Vite uses `base: './'`, and application routes use URL hashes such as `/#/learn` and `/#/practice/first-steps`. This supports GitHub Pages project paths without server rewrites. If you rename the repository, the relative asset paths still work. Keep HTTPS enabled for microphone access. See GitHub's [custom Pages workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages) for repository setup.

## Learning and sound

The app includes beginner lessons, original timed teaching exercises, a song catalogue, a practice room, a reference tone/tuner, settings, and browser-local progress. Paper and Midnight appearances use Dossier's published components and theme tokens. The original exercises provide useful sound immediately; the familiar song titles are visibly pending arrangements.

Play or pause from the transport. Start with a slow speed, listen to a phrase, and repeat it with your instrument. Select your actual Sa and octave in settings; the initial tonic is an assumption, not a claim about your instrument's printed scale. Synthesised reference tones use equal temperament and are not a complete model of Hindustani intonation.

Microphone analysis runs locally and requires explicit browser permission. Use HTTPS or localhost. Denied permission leaves reference playback and lessons usable. Use headphones to reduce metronome leakage. The tuner cannot observe fingering, embouchure, posture, or breath technique; live pitch feedback is not a teacher assessment.

## Content boundaries

- No teacher-reviewed instrument fingering profile was supplied. Unsupported fingerings display **Fingering not available** rather than invented hole patterns. The labelled six-hole illustration teaches hole numbering.
- **Lag Ja Gale, Kal Ho Naa Ho, Tum Hi Ho, Pehla Nasha, Kesariya, and Vaseegara** remain **Arrangement pending**. None has invented notes, an unrelated recording, or a claimed verified difficulty.
- Publishing familiar songs requires approved timed arrangements, source and permission metadata, and a competent musical review. Teacher review of beginner instructions and instrument-specific fingerings is also outstanding.
- Rhythm accuracy is unavailable when reliable onset measurements are absent. Manual completion and time spent practising are distinct from measured musical accuracy.

## Handover

- [Content editing guide](docs/CONTENT_GUIDE.md): lessons, arrangements, tick timing, phrase boundaries, provenance, and verified fingering profiles.
- [Test report and remaining limitations](docs/TEST_REPORT.md): performed checks, browser coverage, and requirements still needing real-instrument validation.
- [Original implementation brief](Flute_Learning_Website_Coding_Agent_Instructions.md).

The older `audioplayer.html` and `Login.html` files are retained as existing material. The Vite application starts from `index.html` and `src/main.tsx`.
