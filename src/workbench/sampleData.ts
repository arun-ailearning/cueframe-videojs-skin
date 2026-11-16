import type { ReviewCue, SuppliedSlateMetadata } from '../skin/types';

export interface DemoReelPreset {
  id: string;
  label: string;
  badge: string;
  aspectRatio: '16:9' | '9:16';
  lightingProfile: 'dark' | 'bright' | 'mixed';
  description: string;
  videoUrl: string;
  fps: number;
  slateMetadata: SuppliedSlateMetadata;
  seedCues: ReviewCue[];
}

const CHAPTERS_VTT = `WEBVTT

chapter-1
00:00:00.000 --> 00:00:12.000
SC 01 · Cold Open — Nocturne Arrival

chapter-2
00:00:12.000 --> 00:00:26.000
SC 02 · The Anamorphic Corridor

chapter-3
00:00:26.000 --> 00:00:42.000
SC 03 · High-Key Daylight Reveal

chapter-4
00:00:42.000 --> 00:00:58.000
SC 04 · Sound Stage Dialogue & Close-Up

chapter-5
00:00:58.000 --> 00:01:15.000
SC 05 · Final Crane Pullback & Tail Slate`;

const CAPTIONS_VTT = `WEBVTT

1
00:00:00.500 --> 00:00:06.000
[DIRECTOR SLATE] Reel 01 — "MERIDIAN" Dailies Cut · 24fps Reference Screening

2
00:00:06.500 --> 00:00:12.000
[AMBIENT SYNTH DRONE & RAIN ON PAVEMENT]

3
00:00:12.500 --> 00:00:25.500
NARRATOR: When the light shifts across the glass, every shadow tells you where the lens stood.

4
00:00:26.500 --> 00:00:41.500
[HIGH-KEY OVEREXPOSURE TEST — 95 IRE DAYLIGHT EXTERIOR]

5
00:00:42.500 --> 00:00:57.500
DIRECTOR (V.O.): Hold the two-shot four frames longer before the whip-pan into the corridor.`;

const THUMBNAILS_VTT = `WEBVTT

00:00:00.000 --> 00:00:12.000
data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="160" height="90" viewBox="0 0 160 90"><rect width="160" height="90" fill="%23090d16"/><circle cx="120" cy="30" r="18" fill="%23e5a93c" opacity="0.35"/><text x="10" y="76" fill="%23f4f4f6" font-family="monospace" font-size="10">SC 01 · NOCTURNE</text></svg>

00:00:12.000 --> 00:00:26.000
data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="160" height="90" viewBox="0 0 160 90"><rect width="160" height="90" fill="%23111827"/><rect x="20" y="15" width="120" height="45" stroke="%2338bdf8" fill="none"/><text x="10" y="76" fill="%23f4f4f6" font-family="monospace" font-size="10">SC 02 · CORRIDOR</text></svg>

00:00:26.000 --> 00:00:42.000
data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="160" height="90" viewBox="0 0 160 90"><rect width="160" height="90" fill="%23f1f5f9"/><circle cx="80" cy="36" r="22" fill="%23e5a93c"/><text x="10" y="76" fill="%230f172a" font-family="monospace" font-size="10">SC 03 · HIGH-KEY</text></svg>

00:00:42.000 --> 00:00:58.000
data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="160" height="90" viewBox="0 0 160 90"><rect width="160" height="90" fill="%231e1b4b"/><path d="M10 45 Q80 10 150 45" stroke="%234ade80" fill="none" stroke-width="2"/><text x="10" y="76" fill="%23f4f4f6" font-family="monospace" font-size="10">SC 04 · SOUND STAGE</text></svg>

00:00:58.000 --> 00:01:15.000
data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="160" height="90" viewBox="0 0 160 90"><rect width="160" height="90" fill="%2309090b"/><line x1="0" y1="20" x2="160" y2="20" stroke="%23e5a93c"/><line x1="0" y1="70" x2="160" y2="70" stroke="%23e5a93c"/><text x="10" y="50" fill="%23e5a93c" font-family="monospace" font-size="10">SC 05 · TAIL SLATE</text></svg>`;

export const INLINE_CHAPTERS_VTT_URI = `data:text/vtt;charset=utf-8,${encodeURIComponent(CHAPTERS_VTT)}`;
export const INLINE_CAPTIONS_VTT_URI = `data:text/vtt;charset=utf-8,${encodeURIComponent(CAPTIONS_VTT)}`;
export const INLINE_THUMBNAILS_VTT_URI = `data:text/vtt;charset=utf-8,${encodeURIComponent(THUMBNAILS_VTT)}`;

export const DEMO_REEL_PRESETS: DemoReelPreset[] = [
  {
    id: 'meridian-dark-16x9',
    label: 'Reel 01 · Low-Key Cinema (16:9 Dark)',
    badge: 'Low-Key Contrast Test',
    aspectRatio: '16:9',
    lightingProfile: 'dark',
    description:
      'High-contrast nocturne cinematography streamed from Mux with VTT scene chapters, storyboard hover previews, and director review cues.',
    videoUrl: 'https://stream.mux.com/BV3YZtogl89mg9VcNBhhnHm02Y34zI1nlMuMQfAbl3dM/highest.mp4',
    fps: 24,
    slateMetadata: {
      productionTitle: 'MERIDIAN // CUT 04 (DIRECTOR REVIEW)',
      sceneTake: 'REEL 01 · SC 01–05 · TK 03',
      director: 'A. Rostova',
      cinematographer: 'K. Takahashi, ASC',
      suppliedFps: 24,
      reelId: 'MRD-2026-R1',
      sourceLabel: 'demo-sample',
    },
    seedCues: [
      {
        id: 'seed-cue-1',
        timestamp: 4.5,
        category: 'Picture',
        note: 'Shadow detail in the lower-left doorway holds clean; check 2.39:1 bottom matte clearance.',
        author: 'K. Takahashi (DOP)',
        createdAt: '2026-11-10T10:15:00.000Z',
        resolved: false,
      },
      {
        id: 'seed-cue-2',
        timestamp: 14.0,
        category: 'Edit',
        note: 'Trim 6 frames before the corridor match-cut so the movement carries across the splice.',
        author: 'A. Rostova (Director)',
        createdAt: '2026-11-10T10:18:00.000Z',
        resolved: false,
      },
      {
        id: 'seed-cue-3',
        timestamp: 28.2,
        category: 'Sound',
        note: 'Sub-bass room tone peaks near -3 dBFS on entry; roll off 40Hz before dialogue cue.',
        author: 'M. Vance (Sound)',
        createdAt: '2026-11-10T10:22:00.000Z',
        resolved: false,
      },
      {
        id: 'seed-cue-4',
        timestamp: 44.0,
        category: 'Fix',
        note: 'Paint out tiny boom reflection in top-right glass pane (frames 1052–1068).',
        author: 'S. Chen (VFX Lead)',
        createdAt: '2026-11-10T10:30:00.000Z',
        resolved: true,
      },
    ],
  },
  {
    id: 'solstice-bright-16x9',
    label: 'Reel 02 · High-Key Daylight (16:9 Bright)',
    badge: 'Overexposed Highlight Test',
    aspectRatio: '16:9',
    lightingProfile: 'bright',
    description:
      'Simulates 95+ IRE snow, sky, and specular white studio backdrops to prove CUEFRAME D65 graphite plates keep 11:1+ contrast over bright footage.',
    videoUrl: 'https://stream.mux.com/BV3YZtogl89mg9VcNBhhnHm02Y34zI1nlMuMQfAbl3dM/highest.mp4',
    fps: 24,
    slateMetadata: {
      productionTitle: 'WHITEHORN GLACIER // HIGH-KEY GRADE',
      sceneTake: 'REEL 02 · EXT. SNOWFIELD · DAY',
      director: 'A. Rostova',
      cinematographer: 'K. Takahashi, ASC',
      suppliedFps: 24,
      reelId: 'WHT-2026-R2',
      sourceLabel: 'demo-sample',
    },
    seedCues: [
      {
        id: 'seed-bright-1',
        timestamp: 6.0,
        category: 'Picture',
        note: 'Notice how the D65 control capsules stay 100% legible even over pure 98 IRE white snow.',
        author: 'Colourist',
        createdAt: '2026-11-10T11:00:00.000Z',
        resolved: false,
      },
      {
        id: 'seed-bright-2',
        timestamp: 19.5,
        category: 'Edit',
        note: 'Hold wide horizon shot for 2 seconds longer to let the title card breathe.',
        author: 'A. Rostova (Director)',
        createdAt: '2026-11-10T11:05:00.000Z',
        resolved: false,
      },
    ],
  },
  {
    id: 'kinetic-vertical-9x16',
    label: 'Reel 03 · Vertical Social Cut (9:16)',
    badge: '9:16 Portrait Layout',
    aspectRatio: '9:16',
    lightingProfile: 'mixed',
    description:
      'Tests CUEFRAME in a 9:16 vertical social/mobile deliverables container with compact single-row controls and bottom-sheet review drawer.',
    videoUrl: 'https://stream.mux.com/BV3YZtogl89mg9VcNBhhnHm02Y34zI1nlMuMQfAbl3dM/highest.mp4',
    fps: 30,
    slateMetadata: {
      productionTitle: 'PULSE // 9:16 SOCIAL DELIVERABLE',
      sceneTake: 'REEL 03 · VERTICAL MASTER',
      director: 'L. Mercer',
      cinematographer: 'D. Okafor',
      suppliedFps: 30,
      reelId: 'PLS-916-V1',
      sourceLabel: 'demo-sample',
    },
    seedCues: [
      {
        id: 'seed-vert-1',
        timestamp: 3.2,
        category: 'Picture',
        note: 'Keep subject centered inside 9:16 safe action zone so platform UI overlays do not clip.',
        author: 'L. Mercer (Director)',
        createdAt: '2026-11-10T12:00:00.000Z',
        resolved: false,
      },
    ],
  },
];

export const ACCENT_COLOR_PRESETS = [
  { name: 'Cinema Amber (Default)', color: '#e5a93c', textColor: '#09090b' },
  { name: 'Broadcast Tally Red', color: '#f43f5e', textColor: '#ffffff' },
  { name: 'Optical Cyan', color: '#38bdf8', textColor: '#09090b' },
  { name: 'Phosphor Signal Green', color: '#4ade80', textColor: '#09090b' },
  { name: 'Monochrome Silver', color: '#f4f4f6', textColor: '#09090b' },
];
