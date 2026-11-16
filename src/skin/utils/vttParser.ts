export interface ParsedVttCue {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
}

/**
 * Parse a WebVTT timestamp string (e.g. "00:01:14.500" or "01:14.500") into seconds.
 */
export function parseVttTimestamp(raw: string): number {
  const cleaned = raw.trim();
  const parts = cleaned.split(':');
  if (parts.length === 3) {
    const hrs = Number(parts[0]);
    const mins = Number(parts[1]);
    const secs = Number(parts[2]);
    if (Number.isFinite(hrs) && Number.isFinite(mins) && Number.isFinite(secs)) {
      return hrs * 3600 + mins * 60 + secs;
    }
  } else if (parts.length === 2) {
    const mins = Number(parts[0]);
    const secs = Number(parts[1]);
    if (Number.isFinite(mins) && Number.isFinite(secs)) {
      return mins * 60 + secs;
    }
  }
  return 0;
}

/**
 * Parse raw WebVTT file content into an array of { id, startTime, endTime, text } cues.
 */
export function parseWebVttText(vttContent: string): ParsedVttCue[] {
  if (!vttContent || typeof vttContent !== 'string') return [];

  const normalized = vttContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const blocks = normalized.split(/\n{2,}/);
  const cues: ParsedVttCue[] = [];

  blocks.forEach((block, index) => {
    const lines = block
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length === 0) return;
    if (lines[0].startsWith('WEBVTT') || lines[0].startsWith('NOTE')) return;

    let timingLineIndex = 0;
    let cueId = `vtt-cue-${index}`;

    if (!lines[0].includes('-->')) {
      if (lines.length < 2 || !lines[1].includes('-->')) return;
      cueId = lines[0];
      timingLineIndex = 1;
    }

    const timingLine = lines[timingLineIndex];
    const arrowParts = timingLine.split('-->');
    if (arrowParts.length < 2) return;

    const startRaw = arrowParts[0].trim();
    const endRaw = arrowParts[1].trim().split(/\s+/)[0];

    const startTime = parseVttTimestamp(startRaw);
    const endTime = parseVttTimestamp(endRaw);
    const textLines = lines.slice(timingLineIndex + 1);
    const text = textLines.join('\n').trim();

    if (endTime > startTime && text.length > 0) {
      cues.push({
        id: cueId,
        startTime,
        endTime,
        text,
      });
    }
  });

  return cues;
}

/**
 * Decode a data:text/vtt URI into raw VTT text if applicable.
 */
export function decodeDataVttUri(src: string): string | null {
  if (!src || !src.startsWith('data:text/vtt')) return null;
  const commaIdx = src.indexOf(',');
  if (commaIdx === -1) return null;
  const meta = src.slice(0, commaIdx);
  const payload = src.slice(commaIdx + 1);
  try {
    if (meta.includes(';base64')) {
      return typeof atob === 'function' ? atob(payload) : null;
    }
    return decodeURIComponent(payload);
  } catch {
    return payload;
  }
}
