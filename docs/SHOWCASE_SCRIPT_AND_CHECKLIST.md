# CUEFRAME — 45-Second Showcase Script & Submission Readiness Checklist

## 1. 45-Second 60fps Showcase Video Script

Record the live workbench (`npm run dev`) at `1920×1080` (60fps) following this 5-act sequence:

### Act I — The Hero Screening Room (`0:00 – 0:08`)
- **Action**: Start on **Act I · `01 VIEW`** with `Reel 01 · Low-Key Cinema` playing. Let the pointer rest for 2.5 seconds so the floating D65 console fades away completely, leaving 100% pure cinema footage.
- **Action**: Move the cursor and click **Act IV · High-Key 95 IRE Contrast Proof**. Show how the opaque/frosted D65 carbon-graphite plates keep 11:1+ contrast even over blinding white footage.
- **Caption Callout**: *"CUEFRAME for Video.js v10 — The footage is the hero. The interface is the instrument."*

### Act II — The Cinematic Scene Timeline & Vernier Scrub (`0:08 – 0:18`)
- **Action**: Press `2` (or click **Act II · `02 REVIEW`**). The timeline smoothly expands into labeled WebVTT scene blocks (`SC 01` through `SC 05`) with the Vernier fine-scrub scale.
- **Action**: Scrub across the scene blocks to reveal the floating storyboard thumbnail preview, chapter title, and tabular SMPTE timecode (`00:00:14:00`). Press `B` twice to bracket an **A–B Loop** across a scene transition.
- **Caption Callout**: *"Native Video.js v10 Chapters + Storyboard Previews + Vernier Fine-Scrub & A–B Shot Looping."*

### Act III — Non-Interruptive Director's Review Cues (`0:18 – 0:30`)
- **Action**: Press `N` (`+ Add Cue`). Select **Edit**, type *"Trim 4 frames before corridor pan"*, and click **Save Cue**.
- **Action**: Click existing diamond marker pins on the timeline (`Picture`, `Edit`, `Sound`, `Fix`) to jump between department notes in the **Review Slate Drawer**, then click **Markdown** and **EDL** in the Export Cut List bar.
- **Caption Callout**: *"Timestamped Department Cues with 1-Click Markdown, CSV & CMX 3600 EDL Cut-List Export."*

### Act IV — Cinematographer's `INSPECT` Mode (`0:30 – 0:38`)
- **Action**: Press `3` (or click **Act III · `03 INSPECT`**). Highlight the **Stream Telemetry Panel** (showing decoded resolution, aspect ratio, rendition tiers, and honest `24fps (explicitly supplied)` provenance).
- **Action**: Toggle the **`2.39:1`** anamorphic letterbox matte, **Rule of Thirds**, and **Center Crosshair** overlays while the stereo peak meter responds in real time.
- **Caption Callout**: *"Honest Browser-Verified Stream Telemetry & Cinematographer Framing Guides."*

### Act V — Responsive `260px` Stress Test & Public CSS Tokens (`0:38 – 0:45`)
- **Action**: Switch `--media-accent-color` swatches in the Judge's Control Deck (`Cinema Amber` → `Optical Cyan` → `Broadcast Tally Red`), drag the **Container Width Slider** down to `260px` (Min Embed) and switch to `Reel 03 · Vertical Social Cut (9:16)`, then return to `1040px` studio width.
- **Caption Callout**: *"Responsive down to 240px · Full WCAG 2.2 Keyboard & Reduced-Motion Support · Built on @videojs/react v10."*

## 2. Final Contra Submission Readiness Audit

- [x] **Official Challenge Status & Deadline Verified**: [Video.js Skins Design Challenge](https://contra.com/community/topic/videojsskinschallenge) is **LIVE** with deadline **November 16, 2026 at 11:59 PM PST** (November 17, 2026 at 1:29 PM IST).
- [x] **Built on Genuine Video.js v10**: Uses `@videojs/react@10.3.0` (`VideoPlayer`, `Video`, `Container`, `StatusAnnouncer`, `usePlayer`, `useMedia`, `useQualityOptions`, `useAudioTrackOptions`, `useCaptionsOptions`, `usePlaybackRateOptions`).
- [x] **Reusable Skin Decoupled from Demo**: `src/skin/` exports `<CueframeSkin />` with zero hardcoded demo state.
- [x] **Public CSS Custom Properties Supported**: `--media-accent-color`, `--media-accent-text-color`, `--media-border-color`, `--media-border-radius`, `--media-font-family`, `--media-object-fit`, `--media-object-position`, `--media-scale-unit`.
- [x] **Honest Telemetry & Frame Accuracy**: Clearly labels supplied `fps` and slate props vs. browser-verified stream properties; never fabricates camera sensor metadata.
- [x] **Accessibility & Responsiveness Verified**: `240px` to `4K` container queries, `44px` coarse-pointer touch targets, visible `:focus-visible` rings, `StatusAnnouncer` + polite live region, `prefers-reduced-motion`, `prefers-reduced-transparency`, and `forced-colors` support.
- [x] **TypeScript, Automated Tests & Production Build Passing**: Verified via `npm run typecheck`, `npm test`, and `npm run build`.
