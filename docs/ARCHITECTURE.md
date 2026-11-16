# CUEFRAME — Technical Architecture & Limitations Documentation

## 1. Layered System Architecture

CUEFRAME is architected into nine cleanly separated responsibilities so the reusable Video.js v10 skin (`src/skin/`) has zero dependency on the demonstration workbench (`src/workbench/`):

```
src/
├── skin/                                 # Reusable Video.js v10 Skin Package
│   ├── CueframeSkin.tsx                  # Root <Container>, mode state, hotkeys & transport bar
│   ├── cueframe.css                      # D65 Reference Graphite tokens, container queries & a11y rules
│   ├── types.ts                          # Public TypeScript interfaces & contracts
│   ├── index.ts                          # Public barrel exports
│   ├── components/
│   │   ├── FramingGuidesOverlay.tsx      # 2.39:1, 1.85:1, 16:9, 9:16, 4:3, Thirds, Safe Area & Crosshair
│   │   ├── InspectTelemetryPanel.tsx     # Browser-verified telemetry vs. supplied slate metadata
│   │   └── ReviewSlateDrawer.tsx         # Review cue CRUD, category filtering & MD/CSV/EDL export
│   ├── hooks/
│   │   └── useWebAudioMeter.ts           # Singleton-guarded, CORS-checked stereo peak analyser
│   ├── icons/
│   │   └── CueframeIcons.tsx             # Optically centered vector icon set (+0.66px play triangle shift)
│   └── utils/
│       ├── storage.ts                    # Schema validation, deduplication & localStorage recovery
│       └── timecode.ts                   # SMPTE math, frame-step calculation & MD/CSV/EDL serializers
├── workbench/                            # Judge's Interactive Demonstration Workbench
│   ├── WorkbenchApp.tsx                  # Multi-reel switcher, 95 IRE bright test, width slider & tokens
│   ├── sampleData.ts                     # 16:9 Dark, 16:9 Bright & 9:16 Vertical sample presets
│   └── workbench.css                     # Workbench studio layout styling
└── __tests__/                            # Automated Verification Suite
    ├── setup.ts                          # JSDOM media & matchMedia test harness
    └── cueframe.test.tsx                 # Unit & integration tests across P0, P1 & P2 requirements
```

## 2. Video.js v10.3.0 Store & Primitive Integration

Verified directly against `node_modules/@videojs/react/dist/dev/index.d.ts` and `node_modules/@videojs/media/dist/dev/core/state.d.ts`:

- **Player Store Subscriptions**: Uses `usePlayer` from `@videojs/react/video` (`UsePlayerHook<VideoPlayerStore>`) for reactive selectors (`s.paused`, `s.currentTime`, `s.duration`, `s.volume`, `s.muted`, `s.playbackRate`, `s.buffered`, `s.isFullscreen`, `s.subtitlesShowing`, `s.chaptersCues`, `s.thumbnailsTrack`, `s.error`, `s.waiting`) and imperative store actions (`store.play()`, `store.pause()`, `store.seek()`, `store.setVolume()`, `store.setMuted()`, `store.setPlaybackRate()`, `store.toggleSubtitles()`, `store.requestFullscreen()`, `store.exitFullscreen()`).
- **Menu & Track Hooks**: Integrates `useQualityOptions()`, `useAudioTrackOptions()`, `useCaptionsOptions()`, and `usePlaybackRateOptions()` from `@videojs/react`.
- **Accessibility Primitives**: Mounts `<Container>` and `<StatusAnnouncer />` from `@videojs/react`, paired with a dedicated polite ARIA live region (`role="status" aria-live="polite"`) for mode transitions, A–B loop points, and review cue creation/deletion announcements.

## 3. Known Technical & Browser Limitations (Explicit Disclosures)

1. **Browser Frame-Accuracy & Variable Frame Rate (VFR) Media**:
   - **Limitation**: Standard HTML5 `HTMLMediaElement.currentTime` is a double-precision floating-point value in seconds and does not expose the container's native frame table or exact frame rate (`fps`).
   - **Engineering Safeguard**: `<CueframeSkin />` accepts an optional `fps` prop (e.g., `fps={24}` or `fps={30}`). When supplied, SMPTE timecode (`HH:MM:SS:FF`) and `±1F` frame-stepping (`1 / fps` seconds) are enabled and explicitly badged as `24fps (supplied)` / `(approximate in browser)`. When `fps` is omitted, timecode defaults to `MM:SS` (`ELAPSED`) or `HH:MM:SS.d` (`SEC.T (no fps)`), and stepping uses a `40ms` increment.

2. **Web Audio API CORS & Autoplay Policy**:
   - **Limitation**: Calling `AudioContext.createMediaElementSource(video)` on a cross-origin `<video>` element that lacks `crossOrigin="anonymous"` causes browsers to silence audio output for security reasons. Additionally, calling `createMediaElementSource` twice on the same DOM element throws an `InvalidStateError`.
   - **Engineering Safeguard**: `useWebAudioMeter.ts` verifies that the media source is either same-origin/blob/data or has `video.crossOrigin` explicitly configured before constructing an `AudioContext`, and stores the connected graph in a module-scoped `WeakMap<HTMLMediaElement, MediaAudioGraph>`. If CORS is absent or Web Audio is unsupported, the meter gracefully reports `cors-restricted` or `unsupported` without touching the audio pipeline.

3. **Camera-Original EXIF / Lens Metadata**:
   - **Limitation**: Web video containers (MP4/HLS/WebM) decoded by browser media engines do not expose ARRI/RED camera metadata (ISO, T-stop, focal length, shutter angle, or color science LUTs).
   - **Engineering Safeguard**: `InspectTelemetryPanel.tsx` strictly separates **Browser-Verified Stream Telemetry** (`videoWidth × videoHeight`, aspect ratio, active rendition, buffer health, audio/caption tracks) from optional **Slate Metadata Props** (`productionTitle`, `sceneTake`, `director`, `suppliedFps`), and never fabricates camera sensor data.

4. **Serverless Persistence Scope**:
   - **Limitation**: Real-time multi-user cloud synchronization requires a backend database and WebSocket service.
   - **Engineering Safeguard**: Review cues are persisted locally per `mediaId` in `window.localStorage` (`cueframe:review-cues:v1:<mediaId>`) with schema validation, corruption recovery, and deterministic **Markdown (`.md`)**, **CSV (`.csv`)**, and **CMX 3600 EDL (`.edl`)** export so notes can be shared immediately across production teams.
