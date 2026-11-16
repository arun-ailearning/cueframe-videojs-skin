# CUEFRAME — The Cinematic Review Console for Visual Storytellers

> *"The footage is the hero. The interface is the instrument."*

**CUEFRAME** is a reusable, production-grade cinematic viewing, technical inspection, and timestamped dailies review skin built on **[Video.js v10](https://videojs.org/docs/framework/react/guides/skins)** (`@videojs/react` `10.3.0`) for the **[Contra Video.js Skins Design Challenge](https://contra.com/community/topic/videojsskinschallenge)**.

Designed specifically for film directors, editors, cinematographers (DOPs), colourists, sound designers, and creative studios, CUEFRAME bridges the gap between a passive web video player and a heavyweight NLE workstation—without cluttering the frame or fabricating camera-original telemetry.

## Quick Start (Install, Run, Test & Build)

Ensure Node.js (`>= 20`) and `npm` are installed (on macOS with Homebrew, `/opt/homebrew/bin` is used):

```bash
# 1. Install dependencies
npm install

# 2. Start the interactive development & demonstration workbench
npm run dev

# 3. Run TypeScript static verification
npm run typecheck

# 4. Run the automated Vitest + React Testing Library test suite
npm test

# 5. Build the production bundle
npm run build
```

## Three-Mode Progressive Architecture

CUEFRAME organizes professional post-production review around three complementary working states inside a single `<CueframeSkin />` container:

1. **MODE 01 — `VIEW` (Default Screening Room — P0)**
   - 100% unobstructed viewport with D65 color-neutral carbon-graphite capsules (`oklch(0.14 0.004 260 / 0.88)`) that never bias human color perception.
   - Auto-hides smoothly after `2.4s` of pointer inactivity during playback while remaining visible whenever focused via keyboard (`:focus-within`).
   - Multi-format clickable timecode readout (`HH:MM:SS:FF` SMPTE, `MM:SS` Elapsed, `-MM:SS` Remaining) rendered in tabular monospace numerals (`font-variant-numeric: tabular-nums`).

2. **MODE 02 — `REVIEW` (Director's Dailies & Annotation Console — P1)**
   - **Expandable Scene Timeline**: Renders WebVTT `kind="chapters"` cues as labeled scene blocks alongside a **Vernier Fine-Scrub Scale** and **Storyboard Hover Thumbnails** (`kind="metadata" label="thumbnails"`).
   - **Timestamped Review Cues (`N` Key)**: Press `N` or click `+ Add Cue` to drop a color-coded diamond marker pin at the exact playhead timestamp across four production categories:
     - `Picture` (Cyan `#38bdf8`) — Framing, lighting, lens & composition notes
     - `Edit` (Cinema Amber `#e5a93c`) — Cut timing, pacing & transition notes
     - `Sound` (Signal Green `#4ade80`) — Dialogue, mix, stems & peak notes
     - `Fix` (Signal Red `#fb7185`) — Paint-outs, VFX & technical fixes
   - **Review Slate Drawer & Cut-List Exports**: Filter cues by department, click any timecode badge to jump immediately to that frame, edit or resolve notes inline, persist automatically to `localStorage`, and export with 1 click to **Markdown (`.md`)**, **RFC 4180 CSV (`.csv`)**, or **CMX 3600 EDL (`.edl`)**.
   - **A–B Range Loop (`B` Key)**: Cycle In-Point `A` → Out-Point `B` → Clear to loop a specific cut transition continuously.

3. **MODE 03 — `INSPECT` (Cinematographer & Sound Telemetry — P2)**
   - **Honest Provenance Separation**: Clearly distinguishes **Browser-Verified Stream Telemetry** (`HTMLVideoElement.videoWidth × videoHeight`, aspect ratio, active rendition tier from `useQualityOptions`, audio tracks from `useAudioTrackOptions`, caption tracks from `useCaptionsOptions`, and buffered duration) from **Explicitly Supplied Slate Props** (`fps`, `productionTitle`, `sceneTake`). Camera EXIF fields not present in web streams (ISO, T-stop, shutter angle) are never fabricated.
   - **Cinematographer Framing Guides**: Toggle non-destructive SVG overlays for `2.39:1` Scope, `1.85:1` Flat, `16:9`, `9:16`, `4:3`, Rule of Thirds, Center Crosshair reticle, and SMPTE 90%/80% Action/Title Safe bounds.
   - **Progressive-Enhancement Stereo Peak Meter**: Uses a CORS-guarded, singleton `WeakMap<HTMLMediaElement, AudioGraph>` Web Audio API analyser to render L/R peak bars without ever risking duplicate `MediaElementAudioSourceNode` errors or muting cross-origin media.

## Reusable Skin Usage (Decoupled from Demo Workbench)

Import `<CueframeSkin />` directly from `src/skin` around any `@videojs/react/video` `<Video />` component:

```tsx
import { Video, VideoPlayer } from '@videojs/react/video';
import { CueframeSkin } from './skin';

export function ScreeningPlayer() {
  return (
    <VideoPlayer title="Dailies Cut 04">
      <CueframeSkin
        mediaId="project-meridian-cut-04"
        defaultMode="view"
        fps={24}
        slateMetadata={{
          productionTitle: 'MERIDIAN // CUT 04',
          sceneTake: 'SC 01-05 · TK 03',
          director: 'A. Rostova',
          suppliedFps: 24,
          sourceLabel: 'explicitly-supplied',
        }}
        style={{
          '--media-accent-color': '#e5a93c',
          '--media-border-radius': '8px',
        } as React.CSSProperties}
      >
        <Video
          src="https://stream.mux.com/BV3YZtogl89mg9VcNBhhnHm02Y34zI1nlMuMQfAbl3dM/highest.mp4"
          crossOrigin="anonymous"
          playsInline
        >
          <track kind="chapters" src="/tracks/chapters-cinema.vtt" srcLang="en" default />
          <track kind="metadata" label="thumbnails" src="/tracks/thumbnails-cinema.vtt" default />
          <track kind="captions" src="/tracks/captions-en.vtt" srcLang="en" label="English" default />
        </Video>
      </CueframeSkin>
    </VideoPlayer>
  );
}
```

## Supported Public CSS Custom Properties

CUEFRAME supports the [Video.js v10 public skin styling contract](https://videojs.org/docs/framework/react/guides/customize-skins) plus scoped `--cueframe-*` tokens:

| CSS Variable | Default | Description |
| :--- | :--- | :--- |
| `--media-accent-color` | `#e5a93c` | Primary highlight, playhead needle, active mode pill & focus ring |
| `--media-accent-text-color` | `#09090b` | Foreground ink color on accent surfaces |
| `--media-border-color` | `oklch(1 0 0 / 0.12)` | Outer hairline border around the player container |
| `--media-border-radius` | `8px` | Player container corner radius (`0px` in fullscreen) |
| `--media-font-family` | `'Inter', sans-serif` | Primary UI font stack |
| `--media-object-fit` | `contain` | Video & poster fit policy |
| `--media-object-position` | `center` | Video & poster alignment |
| `--media-scale-unit` | `16px` | Base scaling unit (auto-scales in fullscreen on `>=1920px` displays) |

## Filmmaker Keyboard Shortcuts

All single-key shortcuts include strict input-target guards (`<input>`, `<textarea>`, `<select>`, and `contenteditable` elements are ignored so typing review notes never triggers playback actions):

| Shortcut | Action |
| :--- | :--- |
| `Space` or `K` | Play / Pause |
| `J` / `L` | Shuttle backward `-5s` / forward `+5s` |
| `,` / `.` | Step backward `-1F` / forward `+1F` (pauses and steps by `1/fps` or `40ms` fallback) |
| `N` | Open Review Cue composer at current timestamp (switches to `REVIEW` mode) |
| `1` / `2` / `3` | Switch to `01 VIEW`, `02 REVIEW`, or `03 INSPECT` mode |
| `B` | Cycle A–B Loop (`Set A` → `Set B & Loop` → `Clear`) |
| `M` | Toggle Mute |
| `C` | Toggle Captions / Subtitles |
| `F` | Toggle Fullscreen |
| `ArrowLeft` / `ArrowRight` | Seek step on focused timeline slider (`Shift + Arrow` for `±5s`) |
