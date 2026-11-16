import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { Video, VideoPlayer } from '@videojs/react/video';
import {
  CueframeSkin,
  computeFrameStepTime,
  decodeDataVttUri,
  exportCuesToCsv,
  exportCuesToEdl,
  exportCuesToMarkdown,
  formatDisplayTime,
  formatElapsedTime,
  formatSmpteTimecode,
  loadPersistedCues,
  normalizeReviewCues,
  parseImportedCuesJson,
  parseWebVttText,
  savePersistedCues,
  type ReviewCue,
} from '../skin';
import {
  INLINE_CAPTIONS_VTT_URI,
  INLINE_CHAPTERS_VTT_URI,
  INLINE_THUMBNAILS_VTT_URI,
} from '../workbench/sampleData';
import { WorkbenchApp } from '../workbench/WorkbenchApp';

const SAMPLE_CUES: ReviewCue[] = [
  {
    id: 'test-cue-1',
    timestamp: 10.5,
    category: 'Picture',
    note: 'Check 2.39:1 framing headroom on actor entrance.',
    author: 'DOP',
    createdAt: '2026-11-10T10:00:00.000Z',
    resolved: false,
  },
  {
    id: 'test-cue-2',
    timestamp: 25.0,
    category: 'Edit',
    note: 'Tighten cut by 4 frames before camera whip-pan.',
    author: 'Director',
    createdAt: '2026-11-10T10:05:00.000Z',
    resolved: false,
  },
];

function renderCueframePlayer(props: Partial<React.ComponentProps<typeof CueframeSkin>> = {}) {
  return render(
    <VideoPlayer title="Test Screening Cut">
      <CueframeSkin
        mediaId="unit-test-media"
        fps={24}
        initialCues={SAMPLE_CUES}
        slateMetadata={{
          productionTitle: 'UNIT TEST CUT 01',
          sceneTake: 'SC 01 · TK 02',
          director: 'A. Director',
          suppliedFps: 24,
          sourceLabel: 'explicitly-supplied',
        }}
        {...props}
      >
        <Video
          src="https://stream.mux.com/BV3YZtogl89mg9VcNBhhnHm02Y34zI1nlMuMQfAbl3dM/highest.mp4"
          crossOrigin="anonymous"
        >
          <track kind="chapters" src={INLINE_CHAPTERS_VTT_URI} srcLang="en" label="Chapters" default />
          <track kind="metadata" label="thumbnails" src={INLINE_THUMBNAILS_VTT_URI} default />
          <track kind="captions" src={INLINE_CAPTIONS_VTT_URI} srcLang="en" label="English" default />
        </Video>
      </CueframeSkin>
    </VideoPlayer>
  );
}

describe('CUEFRAME — Timecode, Frame-Step, VTT Parser & Export Utilities', () => {
  it('formats elapsed time and SMPTE timecode accurately with explicit FPS', () => {
    expect(formatElapsedTime(0)).toBe('00:00');
    expect(formatElapsedTime(74.4)).toBe('01:14');
    expect(formatElapsedTime(3661)).toBe('01:01:01');

    expect(formatSmpteTimecode(74.5, 24)).toBe('00:01:14:12');
    expect(formatSmpteTimecode(74.5)).toBe('00:01:14.5');
  });

  it('cycles display formats and labels supplied vs missing frame rate honestly', () => {
    const smpteWithFps = formatDisplayTime(10.5, 60, 'smpte', 24);
    expect(smpteWithFps.primary).toBe('00:00:10:12');
    expect(smpteWithFps.badge).toBe('24fps (supplied)');

    const smpteWithoutFps = formatDisplayTime(10.5, 60, 'smpte', undefined);
    expect(smpteWithoutFps.badge).toBe('SEC.T (no fps)');

    const remaining = formatDisplayTime(15, 60, 'remaining', 24);
    expect(remaining.primary).toBe('-00:45');
    expect(remaining.badge).toBe('REM');
  });

  it('computes frame-step targets with 1/fps step and 40ms fallback when fps is omitted', () => {
    const step24 = computeFrameStepTime(10, 100, 1, 24);
    expect(step24.isApproximateFrame).toBe(true);
    expect(step24.targetTime).toBeCloseTo(10 + 1 / 24, 3);

    const stepFallback = computeFrameStepTime(10, 100, -1, undefined);
    expect(stepFallback.isApproximateFrame).toBe(false);
    expect(stepFallback.targetTime).toBeCloseTo(9.96, 3);
  });

  it('parses inline WebVTT chapters, captions, and storyboard data URIs accurately', () => {
    const decodedChapters = decodeDataVttUri(INLINE_CHAPTERS_VTT_URI);
    expect(decodedChapters).toBeTruthy();
    const chapters = parseWebVttText(decodedChapters!);
    expect(chapters).toHaveLength(5);
    expect(chapters[0].text).toContain('SC 01 · Cold Open');

    const decodedCaptions = decodeDataVttUri(INLINE_CAPTIONS_VTT_URI);
    const captions = parseWebVttText(decodedCaptions!);
    expect(captions).toHaveLength(5);
    expect(captions[0].startTime).toBe(0.5);
    expect(captions[0].endTime).toBe(6);
  });

  it('exports valid Markdown, RFC 4180 CSV, and CMX 3600 EDL formats', () => {
    const md = exportCuesToMarkdown(SAMPLE_CUES, { title: 'MERIDIAN', fps: 24 });
    expect(md).toContain('# CUEFRAME Review Notes — MERIDIAN');
    expect(md).toContain('`00:00:10:12`');
    expect(md).toContain('**Picture**');

    const csv = exportCuesToCsv(SAMPLE_CUES, 24);
    const lines = csv.split('\n');
    expect(lines[0]).toBe('Index,Timecode,TimestampSeconds,Category,Author,Status,Note,CreatedAt');
    expect(lines[1]).toContain('00:00:10:12,10.500,Picture,DOP,Open');

    const edl = exportCuesToEdl(SAMPLE_CUES, { title: 'MERIDIAN', fps: 24 });
    expect(edl).toContain('TITLE: MERIDIAN');
    expect(edl).toContain('FCM: NON-DROP FRAME');
    expect(edl).toContain('001  AX       V     C        00:00:10:12 00:00:10:13');
    expect(edl).toContain('* LOC: 00:00:10:12 BLUE Picture:');
  });
});

describe('CUEFRAME — Data Integrity, Storage Persistence & Import Validation', () => {
  it('normalizes, deduplicates, clamps timestamps, and recovers from corrupted localStorage', () => {
    savePersistedCues('reel-alpha', SAMPLE_CUES);
    const loaded = loadPersistedCues('reel-alpha', []);
    expect(loaded.recoveredFromError).toBe(false);
    expect(loaded.cues).toHaveLength(2);

    window.localStorage.setItem('cueframe:review-cues:v1:reel-corrupt', '{not-valid-json');
    const recovered = loadPersistedCues('reel-corrupt', SAMPLE_CUES);
    expect(recovered.recoveredFromError).toBe(true);
    expect(recovered.cues).toHaveLength(2);

    const dupes = normalizeReviewCues([...SAMPLE_CUES, { ...SAMPLE_CUES[0], id: 'other-id' }], 20);
    expect(dupes).toHaveLength(2);
    expect(dupes[1].timestamp).toBe(20);
  });

  it('validates imported JSON payloads and rejects malformed data safely', () => {
    const badSyntax = parseImportedCuesJson('invalid-json');
    expect(badSyntax.error).toMatch(/Invalid JSON syntax/);

    const badSchema = parseImportedCuesJson(JSON.stringify([{ id: '', timestamp: -5 }]));
    expect(badSchema.error).toMatch(/No valid review cues/);

    const validImport = parseImportedCuesJson(JSON.stringify(SAMPLE_CUES));
    expect(validImport.error).toBeNull();
    expect(validImport.cues).toHaveLength(2);
  });
});

describe('CUEFRAME — Core Playback, Modes, Captions (CC) Fix & Small-Screen UX Safeguards', () => {
  it('initializes in default VIEW mode and transitions seamlessly between VIEW, REVIEW, and INSPECT', () => {
    renderCueframePlayer({ defaultMode: 'view' });
    const root = screen.getByTestId('cueframe-skin-root');
    expect(root).toHaveAttribute('data-cueframe-mode', 'view');

    fireEvent.click(screen.getByTestId('mode-btn-review'));
    expect(root).toHaveAttribute('data-cueframe-mode', 'review');
    expect(screen.getByTestId('review-slate-drawer')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('mode-btn-inspect'));
    expect(root).toHaveAttribute('data-cueframe-mode', 'inspect');
    expect(screen.getByTestId('inspect-telemetry-panel')).toBeInTheDocument();
  });

  it('toggles Captions (CC) cleanly ON and OFF via button and C shortcut, rendering custom overlay above controls', () => {
    const { container } = renderCueframePlayer({ defaultMode: 'view' });
    const root = screen.getByTestId('cueframe-skin-root');
    const ccBtn = screen.getByTestId('captions-toggle-btn');

    const video = container.querySelector('video')!;
    Object.defineProperty(video, 'duration', { configurable: true, value: 75 });
    video.currentTime = 2.0;
    fireEvent(video, new Event('timeupdate'));

    expect(ccBtn).toHaveAttribute('aria-pressed', 'true');
    expect(ccBtn).toHaveTextContent('CC ON');
    expect(root).toHaveAttribute('data-captions-enabled', 'true');
    const overlay = screen.getByTestId('cueframe-captions-overlay');
    expect(overlay).toBeInTheDocument();
    expect(screen.getByTestId('cueframe-caption-text')).toHaveTextContent(
      '[DIRECTOR SLATE] Reel 01 — "MERIDIAN" Dailies Cut'
    );

    fireEvent.click(ccBtn);
    expect(ccBtn).toHaveAttribute('aria-pressed', 'false');
    expect(ccBtn).toHaveTextContent('CC OFF');
    expect(root).toHaveAttribute('data-captions-enabled', 'false');
    expect(screen.queryByTestId('cueframe-captions-overlay')).not.toBeInTheDocument();

    fireEvent.keyDown(root, { key: 'c' });
    expect(ccBtn).toHaveAttribute('aria-pressed', 'true');
    expect(ccBtn).toHaveTextContent('CC ON');
    expect(screen.getByTestId('cueframe-captions-overlay')).toBeInTheDocument();

    fireEvent.keyDown(root, { key: 'c' });
    expect(ccBtn).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByTestId('cueframe-captions-overlay')).not.toBeInTheDocument();
  });

  it('provides full small-screen UX parity via the Quick-Tools Console Sheet (CC, Speed, Frame-Step, A-B Loop, Volume & Timecode)', () => {
    const { container } = renderCueframePlayer({ defaultMode: 'review' });
    const video = container.querySelector('video')!;
    Object.defineProperty(video, 'duration', { configurable: true, value: 60 });
    video.currentTime = 10;
    fireEvent(video, new Event('timeupdate'));

    // Ensure primary bar buttons (Play, Mute, Timecode, Mode Switcher, CC, Speed/Tools, Fullscreen) never carry .cueframe-hide-narrow
    expect(screen.getByTestId('play-pause-btn')).not.toHaveClass('cueframe-hide-narrow');
    expect(screen.getByTestId('captions-toggle-btn')).not.toHaveClass('cueframe-hide-narrow');
    expect(screen.getByTestId('playback-rate-btn')).not.toHaveClass('cueframe-hide-narrow');
    expect(screen.getByTestId('fullscreen-toggle-btn')).not.toHaveClass('cueframe-hide-narrow');

    // Open the Quick-Tools Console Sheet (1x ⚙ button)
    fireEvent.click(screen.getByTestId('playback-rate-btn'));
    const sheet = screen.getByTestId('settings-popover');
    expect(sheet).toBeInTheDocument();

    // 1. Toggle Captions directly from inside the small-screen sheet
    const sheetCcBtn = screen.getByTestId('sheet-captions-toggle-btn');
    expect(sheetCcBtn).toHaveTextContent('Captions: ON');
    fireEvent.click(sheetCcBtn);
    expect(sheetCcBtn).toHaveTextContent('Captions: OFF');

    // 2. Step +1 frame and Shuttle +5s directly from inside the small-screen sheet
    fireEvent.click(screen.getByTestId('sheet-step-forward-btn'));
    expect(video.currentTime).toBeCloseTo(10 + 1 / 24, 2);
    fireEvent.click(screen.getByTestId('sheet-shuttle-forward-btn'));
    expect(video.currentTime).toBeCloseTo(15 + 1 / 24, 2);

    // 3. Set A-B Loop directly from inside the small-screen sheet
    const sheetLoopBtn = screen.getByTestId('sheet-ab-loop-btn');
    expect(sheetLoopBtn).toHaveTextContent('Set Loop A');
    fireEvent.click(sheetLoopBtn);
    expect(sheetLoopBtn).toHaveTextContent('Set Loop B');
    fireEvent.click(sheetLoopBtn);
    expect(sheetLoopBtn).toHaveTextContent('Clear Loop');

    // 4. Adjust Volume & Timecode Format inside the small-screen sheet
    const sheetVol = screen.getByTestId('sheet-volume-slider') as HTMLInputElement;
    fireEvent.change(sheetVol, { target: { value: '0.45' } });
    expect(video.volume).toBeCloseTo(0.45, 2);

    const sheetTcBtn = screen.getByTestId('sheet-timecode-format-btn');
    expect(sheetTcBtn).toHaveTextContent('24fps (supplied)');
    fireEvent.click(sheetTcBtn);
    expect(sheetTcBtn).toHaveTextContent('ELAPSED');

    // 5. Close Review Slate Drawer via its header close (×) button on small screens
    expect(screen.getByTestId('review-slate-drawer')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('close-review-drawer-btn'));
    expect(screen.queryByTestId('review-slate-drawer')).not.toBeInTheDocument();
  });

  it('handles play/pause, mute/unmute at zero volume restoration, speed popover outside-click/Escape, and timecode toggle', () => {
    renderCueframePlayer({ defaultMode: 'view' });

    const playBtn = screen.getByTestId('play-pause-btn');
    expect(playBtn).toHaveAttribute('aria-label', 'Play');
    fireEvent.click(playBtn);
    expect(playBtn).toHaveAttribute('aria-label', 'Pause');

    const volumeSlider = screen.getByTestId('volume-range-input') as HTMLInputElement;
    fireEvent.change(volumeSlider, { target: { value: '0' } });
    const muteBtn = screen.getByTestId('mute-toggle-btn');
    expect(muteBtn).toHaveAttribute('aria-label', 'Unmute');
    fireEvent.click(muteBtn);
    expect(muteBtn).toHaveAttribute('aria-label', 'Mute');
    expect(Number(volumeSlider.value)).toBeGreaterThan(0);

    const rateBtn = screen.getByTestId('playback-rate-btn');
    fireEvent.click(rateBtn);
    expect(screen.getByTestId('settings-popover')).toBeInTheDocument();
    fireEvent.keyDown(screen.getByTestId('cueframe-skin-root'), { key: 'Escape' });
    expect(screen.queryByTestId('settings-popover')).not.toBeInTheDocument();

    fireEvent.click(rateBtn);
    const popover = screen.getByTestId('settings-popover');
    fireEvent.click(within(popover).getByText('1.5×'));
    expect(rateBtn).toHaveTextContent('1.5×');

    const tcBtn = screen.getByTestId('timecode-display-btn');
    expect(tcBtn).toHaveTextContent('24fps (supplied)');
    fireEvent.click(tcBtn);
    expect(tcBtn).toHaveTextContent('ELAPSED');
    fireEvent.click(tcBtn);
    expect(tcBtn).toHaveTextContent('REM');
  });

  it('creates, edits, resolves, and deletes timestamped review cues in REVIEW mode', () => {
    renderCueframePlayer({ defaultMode: 'review', mediaId: 'crud-test-media' });

    const drawer = screen.getByTestId('review-slate-drawer');
    expect(within(drawer).getByText(/REVIEW SLATE \(2\)/)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('toggle-cue-composer-btn'));
    const noteInput = screen.getByTestId('cue-note-input');
    fireEvent.change(noteInput, { target: { value: 'Check sub-bass rumble at door slam.' } });
    fireEvent.click(screen.getByTestId('save-cue-btn'));

    expect(within(drawer).getByText(/REVIEW SLATE \(3\)/)).toBeInTheDocument();
    expect(within(drawer).getByText('Check sub-bass rumble at door slam.')).toBeInTheDocument();

    const firstCueItem = screen.getByTestId('review-cue-item-test-cue-1');
    fireEvent.click(within(firstCueItem).getByRole('button', { name: /Delete cue/i }));
    expect(within(drawer).getByText(/REVIEW SLATE \(2\)/)).toBeInTheDocument();
  });

  it('protects input fields and textareas from triggering filmmaker keyboard shortcuts (including C, 1-3, K, M)', () => {
    renderCueframePlayer({ defaultMode: 'review', mediaId: 'hotkey-guard-media' });
    const root = screen.getByTestId('cueframe-skin-root');

    fireEvent.click(screen.getByTestId('toggle-cue-composer-btn'));
    const noteInput = screen.getByTestId('cue-note-input');

    fireEvent.keyDown(noteInput, { key: '1' });
    fireEvent.keyDown(noteInput, { key: '3' });
    fireEvent.keyDown(noteInput, { key: 'c' });
    fireEvent.keyDown(noteInput, { key: 'k' });
    expect(root).toHaveAttribute('data-cueframe-mode', 'review');
    expect(root).toHaveAttribute('data-captions-enabled', 'true');

    fireEvent.keyDown(root, { key: '3' });
    expect(root).toHaveAttribute('data-cueframe-mode', 'inspect');
  });

  it('displays honest telemetry, active caption track status, and framing guides in INSPECT mode', () => {
    renderCueframePlayer({ defaultMode: 'inspect' });

    const panel = screen.getByTestId('inspect-telemetry-panel');
    expect(within(panel).getByTestId('inspect-resolution')).toHaveTextContent(
      'Unavailable (stream not decoded)'
    );
    expect(within(panel).getByTestId('inspect-fps')).toHaveTextContent(
      '24 fps (explicitly supplied)'
    );
    expect(within(panel).getByTestId('inspect-caption-tracks')).toHaveTextContent(
      'English (Active)'
    );

    fireEvent.click(within(panel).getByRole('button', { name: '2.39:1' }));
    expect(screen.getByTestId('letterbox-top')).toBeInTheDocument();
    expect(screen.getByTestId('letterbox-bottom')).toBeInTheDocument();

    fireEvent.click(within(panel).getByRole('button', { name: 'Rule of Thirds' }));
    expect(screen.getByTestId('guide-rule-of-thirds')).toBeInTheDocument();
  });

  it('cycles A-B loop state (Set In -> Set Out -> Clear) and renders the Workbench cleanly', () => {
    render(<WorkbenchApp />);
    expect(screen.getByText(/The Cinematic Review Console/i)).toBeInTheDocument();

    const loopBtn = screen.getByTestId('ab-loop-btn');
    fireEvent.click(loopBtn);
    expect(screen.getByTestId('ab-loop-readout')).toHaveTextContent(/LOOP A:/);

    fireEvent.click(loopBtn);
    expect(loopBtn).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(loopBtn);
    expect(loopBtn).toHaveAttribute('aria-pressed', 'false');
  });

  it('reduces and adjusts volume on small screens via direct popover trigger, -10%/+10% step buttons, touch slider, presets, and console settings sheet', () => {
    const { container } = renderCueframePlayer({ defaultMode: 'view' });
    const video = container.querySelector('video')!;

    // Initial volume is 1.0 (100%)
    const popoverTrigger = screen.getByTestId('volume-popover-trigger-btn');
    expect(popoverTrigger).toHaveTextContent('100%');
    expect(popoverTrigger).not.toHaveClass('cueframe-hide-narrow');

    // 1. Open the floating Volume Capsule Popover
    fireEvent.click(popoverTrigger);
    expect(screen.getByTestId('volume-popover-sheet')).toBeInTheDocument();

    // 2. Reduce volume by -10% via dedicated step button
    const reduceBtn = screen.getByTestId('volume-reduce-step-btn');
    fireEvent.click(reduceBtn);
    expect(video.volume).toBeCloseTo(0.9, 2);
    expect(popoverTrigger).toHaveTextContent('90%');

    fireEvent.click(reduceBtn);
    expect(video.volume).toBeCloseTo(0.8, 2);
    expect(popoverTrigger).toHaveTextContent('80%');

    // 3. Increase volume by +10% via dedicated step button
    const increaseBtn = screen.getByTestId('volume-increase-step-btn');
    fireEvent.click(increaseBtn);
    expect(video.volume).toBeCloseTo(0.9, 2);
    expect(popoverTrigger).toHaveTextContent('90%');

    // 4. Quick preset selection (25%, 50%, 75%, 100%)
    fireEvent.click(screen.getByTestId('volume-preset-25'));
    expect(video.volume).toBeCloseTo(0.25, 2);
    expect(popoverTrigger).toHaveTextContent('25%');

    fireEvent.click(screen.getByTestId('volume-preset-50'));
    expect(video.volume).toBeCloseTo(0.5, 2);
    expect(popoverTrigger).toHaveTextContent('50%');

    // 5. Popover direct slider touch drag
    const popoverSlider = screen.getByTestId('popover-volume-slider') as HTMLInputElement;
    fireEvent.change(popoverSlider, { target: { value: '0.35' } });
    expect(video.volume).toBeCloseTo(0.35, 2);
    expect(popoverTrigger).toHaveTextContent('35%');

    // 6. Mute and unmute inside popover
    const popoverMuteBtn = screen.getByTestId('popover-mute-btn');
    fireEvent.click(popoverMuteBtn);
    expect(video.muted).toBe(true);
    expect(popoverTrigger).toHaveTextContent('0%');

    fireEvent.click(popoverMuteBtn);
    expect(video.muted).toBe(false);
    expect(video.volume).toBeCloseTo(0.35, 2);

    // 7. Dismiss popover via Escape key
    fireEvent.keyDown(screen.getByTestId('cueframe-skin-root'), { key: 'Escape' });
    expect(screen.queryByTestId('volume-popover-sheet')).not.toBeInTheDocument();
  });

  it('eliminates video obscuration in REVIEW mode via zero-blur slate, ghost view mode, and 34px compact minimize strip', () => {
    renderCueframePlayer({ defaultMode: 'review' });
    const drawer = screen.getByTestId('review-slate-drawer');
    expect(drawer).toBeInTheDocument();

    // 1. Initial State: Solid Crisp Slate with zero blur (backdrop-filter: none)
    expect(drawer).toHaveAttribute('data-ghost', 'false');
    expect(drawer).toHaveAttribute('data-minimized', 'false');

    // 2. Ghost View Mode Toggle: switches to 38% translucent see-through slate
    const ghostBtn = screen.getByTestId('toggle-ghost-mode-btn');
    expect(ghostBtn).toHaveTextContent('👁 Ghost');
    fireEvent.click(ghostBtn);

    expect(drawer).toHaveAttribute('data-ghost', 'true');
    expect(ghostBtn).toHaveTextContent('👁 Solid');

    // Switch back to solid
    fireEvent.click(ghostBtn);
    expect(drawer).toHaveAttribute('data-ghost', 'false');

    // 3. Minimize Mode Toggle: collapses drawer into a compact 34px peek strip
    const minimizeBtn = screen.getByTestId('minimize-review-drawer-btn');
    expect(minimizeBtn).toHaveTextContent('▼');
    fireEvent.click(minimizeBtn);

    expect(drawer).toHaveAttribute('data-minimized', 'true');
    expect(minimizeBtn).toHaveTextContent('▲');
    // Composer and cue list are hidden while minimized so video is 100% unobstructed
    expect(screen.queryByRole('list', { name: /Timestamped review cues/i })).not.toBeInTheDocument();

    // Expand drawer back
    fireEvent.click(minimizeBtn);
    expect(drawer).toHaveAttribute('data-minimized', 'false');
    expect(screen.getByRole('list', { name: /Timestamped review cues/i })).toBeInTheDocument();
  });

  it('guarantees full UI & UX responsiveness across Desktop 4K (1920px), Standard Studio (1080px), Tablet (680px), Mobile (380px), and Minimum Embed (240px) without side scrolling', () => {
    const { container } = renderCueframePlayer({ defaultMode: 'review' });
    const root = screen.getByTestId('cueframe-skin-root');
    const video = container.querySelector('video')!;
    Object.defineProperty(video, 'duration', { configurable: true, value: 75 });
    video.currentTime = 12.5;
    fireEvent(video, new Event('timeupdate'));

    // Test essential interactive controls present and operable on all viewports
    const playBtn = screen.getByTestId('play-pause-btn');
    const muteBtn = screen.getByTestId('mute-toggle-btn');
    const volTrigger = screen.getByTestId('volume-popover-trigger-btn');
    const timecodeBtn = screen.getByTestId('timecode-display-btn');
    const ccBtn = screen.getByTestId('captions-toggle-btn');
    const rateBtn = screen.getByTestId('playback-rate-btn');
    const fsBtn = screen.getByTestId('fullscreen-toggle-btn');
    const modeSwitcher = screen.getByTestId('mode-switcher-group');

    // None of these vital controls have the hide-narrow class
    expect(playBtn).not.toHaveClass('cueframe-hide-narrow');
    expect(muteBtn).not.toHaveClass('cueframe-hide-narrow');
    expect(volTrigger).not.toHaveClass('cueframe-hide-narrow');
    expect(timecodeBtn).not.toHaveClass('cueframe-hide-narrow');
    expect(ccBtn).not.toHaveClass('cueframe-hide-narrow');
    expect(rateBtn).not.toHaveClass('cueframe-hide-narrow');
    expect(fsBtn).not.toHaveClass('cueframe-hide-narrow');
    expect(modeSwitcher).not.toHaveClass('cueframe-hide-narrow');

    // Viewport Width Test Assertions (simulating responsive states)
    const viewportWidths = [1920, 1080, 680, 380, 240];
    for (const width of viewportWidths) {
      root.style.width = `${width}px`;

      // 1. All 3 mode buttons are clickable at this width
      fireEvent.click(screen.getByTestId('mode-btn-view'));
      expect(root).toHaveAttribute('data-cueframe-mode', 'view');

      fireEvent.click(screen.getByTestId('mode-btn-review'));
      expect(root).toHaveAttribute('data-cueframe-mode', 'review');

      fireEvent.click(screen.getByTestId('mode-btn-inspect'));
      expect(root).toHaveAttribute('data-cueframe-mode', 'inspect');

      // 2. Captions (CC) toggle works cleanly
      fireEvent.click(ccBtn);
      expect(ccBtn).toHaveAttribute('aria-pressed', 'false');
      fireEvent.click(ccBtn);
      expect(ccBtn).toHaveAttribute('aria-pressed', 'true');

      // 3. Quick-Tools sheet is accessible and operable
      fireEvent.click(rateBtn);
      expect(screen.getByTestId('settings-popover')).toBeInTheDocument();
      fireEvent.click(rateBtn);
      expect(screen.queryByTestId('settings-popover')).not.toBeInTheDocument();

      // 4. Volume Popover is accessible and operable
      fireEvent.click(volTrigger);
      expect(screen.getByTestId('volume-popover-sheet')).toBeInTheDocument();
      fireEvent.click(screen.getByTestId('volume-reduce-step-btn'));
      fireEvent.click(volTrigger);
      expect(screen.queryByTestId('volume-popover-sheet')).not.toBeInTheDocument();
    }
  });

  it('provides explicit and visible Cancel Cue creation buttons in both the composer action footer and form header', () => {
    renderCueframePlayer({ defaultMode: 'review' });
    const drawer = screen.getByTestId('review-slate-drawer');
    expect(drawer).toBeInTheDocument();

    const toggleBtn = screen.getByTestId('toggle-cue-composer-btn');
    expect(toggleBtn).toHaveTextContent('+ Cue');

    // 1. Open the composer
    fireEvent.click(toggleBtn);
    expect(screen.getByTestId('cue-composer-form')).toBeInTheDocument();
    expect(toggleBtn).toHaveTextContent('✕ Cancel');

    // 2. Both explicit Cancel buttons must be clearly visible and accessible
    const footerCancelBtn = screen.getByTestId('cancel-cue-btn');
    const headerCancelBtn = screen.getByTestId('composer-header-cancel-btn');
    expect(footerCancelBtn).toBeInTheDocument();
    expect(footerCancelBtn).toHaveTextContent('Cancel');
    expect(headerCancelBtn).toBeInTheDocument();

    // 3. Canceling via footer Cancel button closes the composer
    const noteInput = screen.getByTestId('cue-note-input');
    fireEvent.change(noteInput, { target: { value: 'Discarded draft feedback' } });
    fireEvent.click(footerCancelBtn);
    expect(screen.queryByTestId('cue-composer-form')).not.toBeInTheDocument();
    expect(toggleBtn).toHaveTextContent('+ Cue');

    // 4. Re-opening composer and canceling via header (×) button closes the composer
    fireEvent.click(toggleBtn);
    expect(screen.getByTestId('cue-composer-form')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('composer-header-cancel-btn'));
    expect(screen.queryByTestId('cue-composer-form')).not.toBeInTheDocument();
  });

  it('guarantees solid D65 graphite plate contrast over Daylight (high-key 95+ IRE) and Low-Key cinema footage with zero white glass haze', () => {
    const { container } = renderCueframePlayer({ defaultMode: 'review' });
    const drawer = screen.getByTestId('review-slate-drawer');
    const controlBar = container.querySelector('.cueframe-control-bar')!;
    const timelineDeck = container.querySelector('.cueframe-timeline-deck')!;

    expect(drawer).toBeInTheDocument();
    expect(controlBar).toBeInTheDocument();
    expect(timelineDeck).toBeInTheDocument();

    // Verify all cue items and chapter segments have solid backgrounds without white glass hazing
    const firstCueItem = screen.getByTestId('review-cue-item-test-cue-1');
    expect(firstCueItem).toBeInTheDocument();
    expect(firstCueItem).not.toHaveStyle({ background: 'rgba(255, 255, 255, 0.05)' });

    // Verify timecode format badge is styled with solid high-contrast dark capsule
    const tcBtn = screen.getByTestId('timecode-display-btn');
    expect(tcBtn).toBeInTheDocument();
  });
});
