import type { ReviewCue, ReviewCueCategory } from '../types';

const STORAGE_PREFIX = 'cueframe:review-cues:v1:';
const VALID_CATEGORIES: ReviewCueCategory[] = ['Picture', 'Edit', 'Sound', 'Fix'];

/**
 * Validate whether an unknown object is a well-formed ReviewCue.
 */
export function isValidReviewCue(item: unknown): item is ReviewCue {
  if (!item || typeof item !== 'object') return false;
  const candidate = item as Record<string, unknown>;
  if (typeof candidate.id !== 'string' || candidate.id.trim() === '') return false;
  if (typeof candidate.timestamp !== 'number' || !Number.isFinite(candidate.timestamp) || candidate.timestamp < 0) {
    return false;
  }
  if (!VALID_CATEGORIES.includes(candidate.category as ReviewCueCategory)) return false;
  if (typeof candidate.note !== 'string' || candidate.note.trim() === '') return false;
  if (typeof candidate.author !== 'string' || candidate.author.trim() === '') return false;
  if (typeof candidate.createdAt !== 'string') return false;
  return true;
}

/**
 * Normalize, deduplicate (by id or identical timestamp+note+category), and sort cues chronologically.
 * Optionally clamps timestamps to media duration when duration > 0.
 */
export function normalizeReviewCues(cues: unknown[], maxDuration?: number): ReviewCue[] {
  const valid: ReviewCue[] = [];
  const seenIds = new Set<string>();
  const seenFingerprints = new Set<string>();

  for (const raw of cues) {
    if (!isValidReviewCue(raw)) continue;

    const clampedTime =
      maxDuration && Number.isFinite(maxDuration) && maxDuration > 0
        ? Math.min(Math.max(0, raw.timestamp), maxDuration)
        : Math.max(0, raw.timestamp);

    const normalizedNote = raw.note.trim();
    const fingerprint = `${clampedTime.toFixed(2)}|${raw.category}|${normalizedNote.toLowerCase()}`;

    if (seenIds.has(raw.id) || seenFingerprints.has(fingerprint)) {
      continue;
    }

    seenIds.add(raw.id);
    seenFingerprints.add(fingerprint);

    valid.push({
      id: raw.id,
      timestamp: Number(clampedTime.toFixed(3)),
      endTimestamp:
        typeof raw.endTimestamp === 'number' && Number.isFinite(raw.endTimestamp)
          ? Math.max(clampedTime, raw.endTimestamp)
          : undefined,
      category: raw.category,
      note: normalizedNote,
      author: raw.author.trim(),
      createdAt: raw.createdAt,
      resolved: Boolean(raw.resolved),
    });
  }

  return valid.sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Load persisted review cues from localStorage with graceful fallback to initialCues if missing or corrupted.
 */
export function loadPersistedCues(
  mediaId: string,
  initialCues: ReviewCue[] = []
): { cues: ReviewCue[]; recoveredFromError: boolean } {
  const key = `${STORAGE_PREFIX}${mediaId}`;
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return { cues: normalizeReviewCues(initialCues), recoveredFromError: false };
    }
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      const normalizedSeed = normalizeReviewCues(initialCues);
      if (normalizedSeed.length > 0) {
        window.localStorage.setItem(key, JSON.stringify(normalizedSeed));
      }
      return { cues: normalizedSeed, recoveredFromError: false };
    }

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      const fallback = normalizeReviewCues(initialCues);
      window.localStorage.setItem(key, JSON.stringify(fallback));
      return { cues: fallback, recoveredFromError: true };
    }

    const validCues = normalizeReviewCues(parsed);
    // If all entries in storage were invalid/corrupted but we had non-empty JSON, recover gracefully
    if (parsed.length > 0 && validCues.length === 0 && initialCues.length > 0) {
      const fallback = normalizeReviewCues(initialCues);
      window.localStorage.setItem(key, JSON.stringify(fallback));
      return { cues: fallback, recoveredFromError: true };
    }

    return { cues: validCues, recoveredFromError: false };
  } catch {
    // Corrupted JSON or storage access exception — recover gracefully without losing initialCues
    return { cues: normalizeReviewCues(initialCues), recoveredFromError: true };
  }
}

/**
 * Persist review cues to localStorage safely.
 */
export function savePersistedCues(mediaId: string, cues: ReviewCue[]): boolean {
  const key = `${STORAGE_PREFIX}${mediaId}`;
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return false;
    }
    const normalized = normalizeReviewCues(cues);
    window.localStorage.setItem(key, JSON.stringify(normalized));
    return true;
  } catch {
    return false;
  }
}

/**
 * Parse and validate an imported JSON review cue payload.
 */
export function parseImportedCuesJson(
  jsonText: string,
  maxDuration?: number
): { cues: ReviewCue[]; error: string | null } {
  try {
    const parsed: unknown = JSON.parse(jsonText);
    const list = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === 'object' && Array.isArray((parsed as { cues?: unknown[] }).cues)
        ? (parsed as { cues: unknown[] }).cues
        : null;

    if (!list) {
      return { cues: [], error: 'Import payload must be a JSON array of review cues.' };
    }

    const validated = normalizeReviewCues(list, maxDuration);
    if (list.length > 0 && validated.length === 0) {
      return { cues: [], error: 'No valid review cues found in the provided JSON data.' };
    }
    return { cues: validated, error: null };
  } catch {
    return { cues: [], error: 'Invalid JSON syntax in imported review cues.' };
  }
}
