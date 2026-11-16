import type { ReviewCue, TimecodeDisplayFormat } from '../types';

/**
 * Clamp a numeric time value to a safe non-negative finite number.
 */
export function sanitizeSeconds(seconds: number): number {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return 0;
  }
  return seconds;
}

/**
 * Pad a whole number to 2 digits with a leading zero.
 */
function pad2(n: number): string {
  return String(Math.floor(Math.max(0, n))).padStart(2, '0');
}

/**
 * Format seconds into standard MM:SS or HH:MM:SS elapsed format.
 */
export function formatElapsedTime(seconds: number): string {
  const safe = sanitizeSeconds(seconds);
  const totalSeconds = Math.floor(safe);
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  if (hrs > 0) {
    return `${pad2(hrs)}:${pad2(mins)}:${pad2(secs)}`;
  }
  return `${pad2(mins)}:${pad2(secs)}`;
}

/**
 * Format seconds into non-drop SMPTE-style timecode (HH:MM:SS:FF) given an explicit frame rate.
 * Note: Browser HTMLMediaElement.currentTime is floating-point seconds; frame numbers are calculated
 * mathematically from the supplied/assumed frame rate and disclosed as approximate in browser playback.
 */
export function formatSmpteTimecode(seconds: number, fps?: number): string {
  const safe = sanitizeSeconds(seconds);
  const validFps = fps && Number.isFinite(fps) && fps > 0 ? Math.round(fps) : null;

  const totalWholeSeconds = Math.floor(safe);
  const hrs = Math.floor(totalWholeSeconds / 3600);
  const mins = Math.floor((totalWholeSeconds % 3600) / 60);
  const secs = totalWholeSeconds % 60;

  if (!validFps) {
    const tenths = Math.floor((safe - totalWholeSeconds) * 10);
    return `${pad2(hrs)}:${pad2(mins)}:${pad2(secs)}.${tenths}`;
  }

  const fractional = safe - totalWholeSeconds;
  const frame = Math.min(validFps - 1, Math.floor((fractional + 1e-6) * validFps));
  return `${pad2(hrs)}:${pad2(mins)}:${pad2(secs)}:${pad2(frame)}`;
}

/**
 * Format playback time according to the user's selected TimecodeDisplayFormat.
 */
export function formatDisplayTime(
  currentTime: number,
  duration: number,
  format: TimecodeDisplayFormat,
  fps?: number
): { primary: string; secondary: string; badge: string } {
  const safeCurrent = sanitizeSeconds(currentTime);
  const safeDuration = sanitizeSeconds(duration);

  if (format === 'smpte') {
    const hasFps = Boolean(fps && Number.isFinite(fps) && fps > 0);
    return {
      primary: formatSmpteTimecode(safeCurrent, fps),
      secondary: formatSmpteTimecode(safeDuration, fps),
      badge: hasFps ? `${fps}fps (supplied)` : 'SEC.T (no fps)',
    };
  }

  if (format === 'remaining') {
    const remaining = Math.max(0, safeDuration - safeCurrent);
    return {
      primary: `-${formatElapsedTime(remaining)}`,
      secondary: formatElapsedTime(safeDuration),
      badge: 'REM',
    };
  }

  return {
    primary: formatElapsedTime(safeCurrent),
    secondary: formatElapsedTime(safeDuration),
    badge: 'ELAPSED',
  };
}

/**
 * Compute safe target time for stepping forward or backward by 1 frame (or fallback increment).
 */
export function computeFrameStepTime(
  currentTime: number,
  duration: number,
  direction: -1 | 1,
  fps?: number
): { targetTime: number; stepSeconds: number; isApproximateFrame: boolean } {
  const hasFps = Boolean(fps && Number.isFinite(fps) && fps > 0);
  const stepSeconds = hasFps ? 1 / (fps as number) : 0.04; // 40ms (~1/25s) fallback when FPS is unknown
  const rawTarget = sanitizeSeconds(currentTime) + direction * stepSeconds;
  const maxDuration = duration > 0 ? duration : Number.MAX_SAFE_INTEGER;
  const targetTime = Math.max(0, Math.min(maxDuration, Number(rawTarget.toFixed(4))));

  return {
    targetTime,
    stepSeconds,
    isApproximateFrame: hasFps,
  };
}

/**
 * Export review cues as clean, studio-grade Markdown review notes.
 */
export function exportCuesToMarkdown(
  cues: ReviewCue[],
  options: { title?: string; fps?: number } = {}
): string {
  const sorted = [...cues].sort((a, b) => a.timestamp - b.timestamp);
  const title = options.title || 'Untitled Screening Cut';
  const fpsNote = options.fps
    ? `${options.fps} fps (explicitly supplied; browser timestamps approximate)`
    : 'Elapsed seconds (frame rate not supplied)';

  const lines: string[] = [
    `# CUEFRAME Review Notes — ${title}`,
    ``,
    `- **Total Review Cues:** ${sorted.length}`,
    `- **Timing Basis:** ${fpsNote}`,
    ``,
    `| # | Timecode | Seconds | Category | Reviewer | Status | Note |`,
    `|---:|:---|---:|:---|:---|:---|:---|`,
  ];

  sorted.forEach((cue, idx) => {
    const tc = formatSmpteTimecode(cue.timestamp, options.fps);
    const secs = `${cue.timestamp.toFixed(2)}s`;
    const status = cue.resolved ? 'Resolved' : 'Open';
    const escapedNote = cue.note.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
    lines.push(
      `| ${idx + 1} | \`${tc}\` | ${secs} | **${cue.category}** | ${cue.author} | ${status} | ${escapedNote} |`
    );
  });

  return lines.join('\n');
}

/**
 * Escape a field for RFC 4180 CSV output.
 */
function escapeCsvField(val: string | number | boolean): string {
  const str = String(val ?? '');
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Export review cues as RFC 4180 compliant CSV compatible with DaVinci Resolve / Premiere / spreadsheet import.
 */
export function exportCuesToCsv(cues: ReviewCue[], fps?: number): string {
  const sorted = [...cues].sort((a, b) => a.timestamp - b.timestamp);
  const headers = [
    'Index',
    'Timecode',
    'TimestampSeconds',
    'Category',
    'Author',
    'Status',
    'Note',
    'CreatedAt',
  ];

  const rows = sorted.map((cue, index) => [
    index + 1,
    formatSmpteTimecode(cue.timestamp, fps),
    cue.timestamp.toFixed(3),
    cue.category,
    cue.author,
    cue.resolved ? 'Resolved' : 'Open',
    cue.note,
    cue.createdAt,
  ]);

  return [
    headers.map(escapeCsvField).join(','),
    ...rows.map((row) => row.map(escapeCsvField).join(',')),
  ].join('\n');
}

/**
 * Export review cues as CMX 3600 locator-annotated EDL when an explicit frame rate is provided.
 * Each cue is emitted as a standard 1-frame marker event with `* FROM CLIP NAME`, `* LOC:` and `* COMMENT:`.
 */
export function exportCuesToEdl(
  cues: ReviewCue[],
  options: { title?: string; fps?: number } = {}
): string {
  const sorted = [...cues].sort((a, b) => a.timestamp - b.timestamp);
  const fps = options.fps && options.fps > 0 ? options.fps : 24;
  const safeTitle = (options.title || 'CUEFRAME_REVIEW')
    .toUpperCase()
    .replace(/[^A-Z0-9_ -]/g, '')
    .slice(0, 40);

  const lines: string[] = [
    `TITLE: ${safeTitle}`,
    `FCM: NON-DROP FRAME`,
    `* NOTE: GENERATED BY CUEFRAME AT ASSUMED ${fps} FPS (BROWSER TIMESTAMPS APPROXIMATE)`,
    ``,
  ];

  sorted.forEach((cue, index) => {
    const eventNum = String(index + 1).padStart(3, '0');
    const inTc = formatSmpteTimecode(cue.timestamp, fps);
    const outTc = formatSmpteTimecode(cue.timestamp + 1 / fps, fps);
    const colorMap: Record<ReviewCue['category'], string> = {
      Picture: 'BLUE',
      Edit: 'YELLOW',
      Sound: 'GREEN',
      Fix: 'RED',
    };
    const cleanNote = cue.note.replace(/\r?\n/g, ' ').trim();
    lines.push(`${eventNum}  AX       V     C        ${inTc} ${outTc} ${inTc} ${outTc}`);
    lines.push(`* FROM CLIP NAME: ${safeTitle}`);
    lines.push(`* COMMENT: [${cue.category.toUpperCase()}] (${cue.author}) ${cleanNote}`);
    lines.push(`* LOC: ${inTc} ${colorMap[cue.category]} ${cue.category}: ${cleanNote.slice(0, 32)}`);
    lines.push(``);
  });

  return lines.join('\n');
}
