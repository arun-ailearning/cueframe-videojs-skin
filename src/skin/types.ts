import type { CSSProperties, ReactNode } from 'react';

/**
 * The three core working modes of CUEFRAME:
 * - 'view': Default distraction-free screening room experience (P0)
 * - 'review': Expanded scene timeline, timestamped director cues, A-B loop & review slate drawer (P1)
 * - 'inspect': Live decoded stream telemetry, framing guides & stereo audio monitoring (P2)
 */
export type CueframeMode = 'view' | 'review' | 'inspect';

/**
 * Categories for timestamped review cues in REVIEW mode.
 */
export type ReviewCueCategory = 'Picture' | 'Edit' | 'Sound' | 'Fix';

/**
 * A single timestamped review marker attached to a media timeline.
 */
export interface ReviewCue {
  /** Stable unique identifier */
  id: string;
  /** Playback timestamp in seconds (>= 0) */
  timestamp: number;
  /** Optional out-point in seconds for range cues */
  endTimestamp?: number;
  /** Functional department category */
  category: ReviewCueCategory;
  /** Short creative or technical review note */
  note: string;
  /** Reviewer display name or role */
  author: string;
  /** ISO-8601 creation timestamp */
  createdAt: string;
  /** Whether the note has been addressed/resolved */
  resolved?: boolean;
}

/**
 * Timecode display format options.
 * - 'smpte': HH:MM:SS:FF (uses supplied/assumed FPS, explicitly labeled as approximate in browser playback)
 * - 'elapsed': MM:SS / MM:SS standard elapsed time
 * - 'remaining': -MM:SS remaining time + total duration
 */
export type TimecodeDisplayFormat = 'smpte' | 'elapsed' | 'remaining';

/**
 * Cinematographer aspect-ratio and composition overlays available in INSPECT mode.
 */
export type AspectGuidePreset = 'off' | '2.39:1' | '1.85:1' | '16:9' | '9:16' | '4:3';

export interface FramingGuideConfig {
  aspectMask: AspectGuidePreset;
  ruleOfThirds: boolean;
  centerCrosshair: boolean;
  safeActionTitle: boolean;
}

/**
 * Optional externally supplied slate/production metadata.
 * Clearly separated in the UI from browser-exposed runtime telemetry so camera metadata is never fabricated.
 */
export interface SuppliedSlateMetadata {
  productionTitle?: string;
  sceneTake?: string;
  director?: string;
  cinematographer?: string;
  suppliedFps?: number;
  reelId?: string;
  sourceLabel?: 'explicitly-supplied' | 'demo-sample';
}

/**
 * A-B playback loop range state.
 */
export interface ABLoopState {
  inPoint: number | null;
  outPoint: number | null;
  active: boolean;
}

/**
 * Props for the reusable <CueframeSkin /> component.
 * Designed to wrap a Video.js v10 media element (e.g. <Video />) inside <VideoPlayer>.
 */
export interface CueframeSkinProps {
  /** The Video.js v10 media component (e.g. <Video src="..." />) */
  children: ReactNode;
  /** Unique media key used to namespace localStorage persistence for review cues */
  mediaId?: string;
  /** Initial active mode ('view' by default) */
  defaultMode?: CueframeMode;
  /** Controlled mode override if managed externally */
  mode?: CueframeMode;
  /** Callback fired when mode changes */
  onModeChange?: (mode: CueframeMode) => void;
  /**
   * Explicitly supplied frame rate (e.g. 24, 25, 29.97, 30, 60).
   * When provided, enables SMPTE timecode estimation and ~1/fps frame stepping with clear disclosure.
   * When omitted, timecode defaults to standard elapsed MM:SS.
   */
  fps?: number;
  /** Initial seed review cues (merged safely with persisted localStorage cues) */
  initialCues?: ReviewCue[];
  /** Callback fired whenever the review cue list changes */
  onCuesChange?: (cues: ReviewCue[]) => void;
  /** Optional explicitly supplied slate metadata for INSPECT mode */
  slateMetadata?: SuppliedSlateMetadata;
  /** Enable or disable Web Audio API stereo peak meter in INSPECT/REVIEW modes (default: true) */
  enableAudioMeter?: boolean;
  /** Default reviewer name used when adding quick cues */
  defaultReviewer?: string;
  /** Optional CSS class name on the root Container */
  className?: string;
  /** Optional inline CSS variables/styles (e.g. --media-accent-color) */
  style?: CSSProperties;
}
