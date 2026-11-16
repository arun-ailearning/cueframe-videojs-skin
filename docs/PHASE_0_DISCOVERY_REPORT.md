# Phase 0 — Workspace & Project Discovery Report

**Date:** November 10, 2026  
**Target Workspace:** `/Users/ArunKumar/VSCode Projects/Contra Challenges`

## 1. Existing Project Structure & Git Status
- **Workspace Inspection:** The connected directory `/Users/ArunKumar/VSCode Projects/Contra Challenges` was inspected prior to any modifications and found to be an empty directory (`0` files, `0` subdirectories) with no pre-existing `.git` repository or uncommitted files.
- **Safeguards Applied:** No pre-existing files or projects were overwritten or deleted. A clean Git repository (`main` branch) was initialized at the workspace root so the project is immediately runnable from `/Users/ArunKumar/VSCode Projects/Contra Challenges`.

## 2. Local Environment & Toolchain
- **Operating System:** macOS (Apple Silicon / Homebrew toolchain under `/opt/homebrew/bin`).
- **Node.js:** `v25.8.1`
- **Package Manager:** `npm 11.11.0` (`npx 11.11.0`)
- **Git:** `git version 2.53.0`
- **Python 3:** `/usr/bin/python3` (available for local deterministic asset generation)

## 3. Reusable Assets & Identified Risks
- **Reusable Assets:** None pre-existing in the directory; all sample media, WebVTT chapter tracks, WebVTT storyboard sprites, and director review annotations will be generated and bundled locally alongside optional remote Mux H.264/HLS streams so the workbench operates with 100% reliability both online and offline.
- **Identified Technical Risks & Mitigations:**
  1. **Video.js v10 Package Exports Verification:** `@videojs/react` v10.3.0 has specific compound component patterns (`TimeSlider.Root`, `TimeSlider.Chapters`, `Slider.Thumbnail.Root`, `usePlayer`, `useQualityOptions`, `useAudioTrackOptions`, `useCaptionsOptions`). We will inspect the installed `node_modules/@videojs/react` TypeScript declarations immediately after `npm install` to guarantee 100% authentic API usage.
  2. **Browser Frame-Accuracy & VFR Media:** HTML5 `HTMLMediaElement.currentTime` uses floating-point seconds and does not expose native container frame rates (`fps`). CUEFRAME accepts an explicit `fps` prop (clearly labeled as supplied/assumed vs. browser-exposed) and falls back to standard elapsed time when `fps` is omitted.
  3. **Web Audio API CORS & Gesture Constraints:** Creating a `MediaElementAudioSourceNode` on a cross-origin `<video>` without CORS headers silences playback. CUEFRAME isolates the stereo dBFS meter as an opt-in, gesture-gated progressive enhancement with a WeakMap singleton guard per `<HTMLVideoElement>` so it can never create duplicate nodes or break audio playback.
  4. **Offline / Network Resilience:** Remote CDN streams can fail under strict firewalls or offline testing. We will generate local high-contrast (bright snow/daylight vs. dark night/studio) MP4/WebM/Canvas streams and local `.vtt` chapter/storyboard files inside `public/media/` so every feature works deterministically without external credentials.

## 4. Recommended Implementation Approach
1. Install `@videojs/react`, `react`, `react-dom`, `vite`, `typescript`, and `vitest` + `@testing-library/react`.
2. Inspect the exact installed `.d.ts` type definitions in `node_modules/@videojs/react` during Phase 1 validation.
3. Architect a strict separation between:
   - `src/skin/` — The portable, zero-demo-coupling `<CueframeSkin />` component, subcomponents, hooks, utilities, and D65 Reference Graphite CSS tokens (`cueframe.css`).
   - `src/workbench/` — The interactive Judge's Demonstration Workbench (`WorkbenchApp.tsx`) with Bright/Dark footage toggles, `16:9` / `9:16` aspect ratio toggles, responsive container width simulator (`240px`–`100%`), live `--media-accent-color` token switcher, and guided 5-act tour.
   - `src/__tests__/` — Comprehensive Vitest automated tests validating P0, P1, and P2 requirements.
