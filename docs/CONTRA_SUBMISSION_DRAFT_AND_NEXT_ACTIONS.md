# CUEFRAME — Recommended Next Actions & Final Contra Submission Draft

## 1. Immediate Next Actions (Prioritized Execution Sequence)

### Action 1 — Launch & Inspect the Local Workbench (Today, Nov 10)
Because the agent sandbox restricts background TCP socket binding without explicit network approval, you have two immediate ways to launch and interact with the workbench on your Mac:
1. **Zero-Server Instant Preview**: Open [`dist/standalone-workbench.html`](file:///Users/ArunKumar/VSCode%20Projects/Contra%20Challenges/dist/standalone-workbench.html) directly in Chrome or Safari—all JavaScript, CSS, and WebVTT scene/storyboard/caption tracks are self-contained inside that single file.
2. **Live Vite Development Server (`http://localhost:5173`)**: Double-click [`start-workbench.command`](file:///Users/ArunKumar/VSCode%20Projects/Contra%20Challenges/start-workbench.command) in Finder, or run `export PATH="/opt/homebrew/bin:$PATH" && npm run dev` in your VS Code integrated terminal inside [`/Users/ArunKumar/VSCode Projects/Contra Challenges`](file:///Users/ArunKumar/VSCode%20Projects/Contra%20Challenges).

### Action 2 — Push Source to a Public GitHub Repository & Deploy Live Demo (Nov 11 – Nov 12)
Top entries on the [#videojsskinschallenge feed](https://contra.com/community/topic/videojsskinschallenge) pair a public GitHub repository with an instant Vercel/Netlify live URL so judges can test keyboard shortcuts, responsiveness, and custom CSS tokens directly:

```bash
cd "/Users/ArunKumar/VSCode Projects/Contra Challenges"
export PATH="/opt/homebrew/bin:$PATH"

# 1. Commit all verified source, tests, and documentation
git add .
git commit -m "feat: deliver CUEFRAME Video.js v10 cinematic review console skin and workbench"

# 2. Push to your GitHub repository
# git remote add origin https://github.com/<your-username>/cueframe-videojs-v10.git
# git push -u origin main

# 3. Deploy production build to Vercel (or drag-and-drop dist/ to Netlify Drop)
npx vercel --prod
```

### Action 3 — Record the 45-Second 60fps Showcase Reel & Stills (Nov 13 – Nov 14)
Use macOS Screen Recording (`Cmd + Shift + 5`) or CleanShot X / OBS at `1920×1080` (60fps) following the 5-act choreography in [`SHOWCASE_SCRIPT_AND_CHECKLIST.md`](file:///Users/ArunKumar/VSCode%20Projects/Contra%20Challenges/docs/SHOWCASE_SCRIPT_AND_CHECKLIST.md):
- **0:00–0:08 (`01 VIEW`)**: Full-bleed playback + `Act IV · High-Key 95 IRE Contrast Proof` toggle proving 11:1+ contrast over bright and dark footage.
- **0:08–0:18 (`02 REVIEW` Timeline)**: Press `2` to expand the scene-segmented timeline, hover to show storyboard previews + Vernier fine-scrub ticks, and press `B` twice to set an A–B loop.
- **0:18–0:30 (Review Cues & Export)**: Press `N` to drop a timestamped `Edit` cue, click existing `Picture`/`Sound`/`Fix` diamond pins to jump across scenes, and click **Markdown** + **EDL** export.
- **0:30–0:38 (`03 INSPECT` & Framing Guides)**: Press `3` to open the browser-verified Stream Telemetry Panel and toggle the `2.39:1` letterbox matte and Rule of Thirds grid.
- **0:38–0:45 (Responsive & Token Proof)**: Drag the Container Width Slider down to `260px`, switch `--media-accent-color` swatches, and return to `01 VIEW`.

### Action 4 — Publish on Contra Before Deadline (By Nov 15 — 24h Buffer Before Nov 16, 11:59 PM PST)
Submit on the [Video.js Skins Design Challenge page](https://contra.com/community/topic/videojsskinschallenge) at least 24 hours ahead of the **November 16, 2026 at 11:59 PM PST** (**Tuesday, November 17, 2026 at 1:29 PM IST**) deadline using the ready-to-paste submission copy below.

## 2. Ready-to-Publish Contra Submission Copy

### Project Title
**CUEFRAME: A 3-Mode Cinematic Review & Inspection Console Skin for Video.js v10**

### Short Feed Hook (First 3 Lines Visible on the Contra Topic Feed)
**CUEFRAME** turns the Video.js v10 player into a reference-grade screening room and dailies review console for directors, editors, and cinematographers.

*"The footage is the hero. The interface is the instrument."*

Instead of cluttering the picture with permanent HUD telemetry or decorative bezels, CUEFRAME adapts across three focused working modes—**`01 VIEW`**, **`02 REVIEW`**, and **`03 INSPECT`**—while keeping 11:1+ WCAG AAA contrast over both pitch-black night scenes and 95+ IRE snow footage.

### Full Project Description (Body Copy)
**Why We Built CUEFRAME**
When directors, DOPs, and editors watch a cut on the web, they shouldn't have to choose between a bare-bones consumer progress bar and opening a heavyweight NLE workstation. CUEFRAME bridges that gap inside a single, drop-in `@videojs/react` v10 skin component (`<CueframeSkin />`).

**Three Working Modes, One Cohesive Instrument:**
- **`01 VIEW` (Default Screening Room):** Maximum emphasis on the picture. Controls sit inside D65 color-neutral carbon-graphite capsules (`oklch(0.14 0.004 260 / 0.88)`) that never bias color perception and auto-hide smoothly when idle. Clicking the tabular monospace timecode cycles between `HH:MM:SS:FF` (SMPTE), `MM:SS` (Elapsed), and `-MM:SS` (Remaining).
- **`02 REVIEW` (Director's Dailies & Cut-List Console):** Pressing `2` expands the timeline into labeled WebVTT scene blocks (`kind="chapters"`) with storyboard hover previews (`kind="metadata" label="thumbnails"`), a Vernier fine-scrub scale, and an **A–B shot loop (`B` key)**. Pressing `N` drops a color-coded diamond cue pin (`Picture`, `Edit`, `Sound`, `Fix`) at the exact playhead timestamp, persists notes locally, and exports a production-ready cut list in **Markdown (`.md`)**, **RFC 4180 CSV (`.csv`)**, or **CMX 3600 EDL (`.edl`)** with one click.
- **`03 INSPECT` (Cinematographer & Sound Telemetry):** Pressing `3` reveals browser-verified stream specs (decoded resolution, aspect ratio, active rendition tier, audio/caption tracks, buffer health, and a CORS-safe Web Audio stereo peak meter) clearly separated from supplied slate props, alongside toggleable **`2.39:1`**, **`1.85:1`**, **`16:9`**, **`9:16`**, **`4:3`**, **Rule of Thirds**, **Center Crosshair**, and **90%/80% Safe Area** framing guides.

**Engineered for Video.js v10 Standards:**
- **Filmmaker Keyboard Ergonomics:** `Space`/`K` Play/Pause, `J`/`L` Shuttle, `,`/`.` Frame-Step, `N` Add Review Cue, `1`/`2`/`3` Switch Modes, `B` A–B Loop, `C` Captions, `M` Mute, `F` Fullscreen—with strict input guards so typing a review note never triggers hotkeys.
- **Responsive Down to 240px:** Container queries (`@container cueframe`) adapt control density from `4K` fullscreen monitors down to `240px` mobile embeds and `9:16` vertical reels, keeping `44px` touch targets on mobile.
- **Full Accessibility & Public CSS API:** Built with `<Container>` and `<StatusAnnouncer />`, high-visibility `:focus-visible` rings, `prefers-reduced-motion: reduce`, `prefers-reduced-transparency: reduce`, `forced-colors: active`, and full support for `--media-accent-color`, `--media-border-radius`, and `--media-scale-unit`.

**Links & Resources:**
- **Live Interactive Workbench:** *(Paste your deployed Vercel/Netlify URL here)*
- **GitHub Repository:** *(Paste your public GitHub repository URL here)*
- **Built With:** Video.js v10 (`@videojs/react` 10.3.0), React 19, TypeScript, CSS Container Queries, Mux Stream + WebVTT Tracks

**Tags:**
`#videojsskinschallenge` `Mux` `UI Design` `UX Design` `Interaction Design` `Frontend Development` `React` `TypeScript`
