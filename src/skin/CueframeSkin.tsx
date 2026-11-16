import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Container,
  StatusAnnouncer,
  useAudioTrackOptions,
  useCaptionsOptions,
  useMedia,
  usePlaybackRateOptions,
  useQualityOptions,
} from '@videojs/react';
import { usePlayer } from '@videojs/react/video';
import type {
  ABLoopState,
  CueframeMode,
  CueframeSkinProps,
  FramingGuideConfig,
  ReviewCue,
  ReviewCueCategory,
  TimecodeDisplayFormat,
} from './types';
import {
  computeFrameStepTime,
  formatDisplayTime,
  formatElapsedTime,
  formatSmpteTimecode,
} from './utils/timecode';
import { loadPersistedCues, savePersistedCues } from './utils/storage';
import {
  decodeDataVttUri,
  parseWebVttText,
  type ParsedVttCue,
} from './utils/vttParser';
import { useWebAudioMeter } from './hooks/useWebAudioMeter';
import { FramingGuidesOverlay } from './components/FramingGuidesOverlay';
import {
  InspectTelemetryPanel,
  type RuntimeStreamTelemetry,
} from './components/InspectTelemetryPanel';
import { ReviewSlateDrawer } from './components/ReviewSlateDrawer';
import {
  CaptionsIcon,
  CuePinIcon,
  DrawerIcon,
  FrameGuidesIcon,
  FullscreenEnterIcon,
  FullscreenExitIcon,
  LoopBracketIcon,
  PauseIcon,
  PlayIcon,
  StepBackIcon,
  StepForwardIcon,
  VolumeHighIcon,
  VolumeMutedIcon,
} from './icons/CueframeIcons';
import './cueframe.css';

interface ChapterSegmentItem {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
}

interface ThumbnailCueItem {
  startTime: number;
  endTime: number;
  url: string;
  xywh?: { x: number; y: number; w: number; h: number };
}

/**
 * Determine whether a keyboard event originated inside an editable input, textarea, or dialog control.
 */
function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return Boolean(target.closest('[contenteditable="true"]'));
}

/**
 * Parse optional #xywh=x,y,w,h sprite fragment from a storyboard VTT cue text.
 */
function parseThumbnailCueUrl(rawText: string): {
  url: string;
  xywh?: { x: number; y: number; w: number; h: number };
} {
  const trimmed = rawText.trim();
  const [baseUrl, hash] = trimmed.split('#');
  if (!hash || !hash.startsWith('xywh=')) {
    return { url: trimmed };
  }
  const parts = hash
    .replace('xywh=', '')
    .split(',')
    .map((n) => Number(n));
  if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
    return {
      url: baseUrl,
      xywh: { x: parts[0], y: parts[1], w: parts[2], h: parts[3] },
    };
  }
  return { url: baseUrl };
}

/**
 * CUEFRAME — The Cinematic Review Console for Visual Storytellers.
 * Reusable Video.js v10 skin component implementing MODE 01 (VIEW), MODE 02 (REVIEW), and MODE 03 (INSPECT).
 */
export function CueframeSkin({
  children,
  mediaId = 'default-media',
  defaultMode = 'view',
  mode: controlledMode,
  onModeChange,
  fps,
  initialCues = [],
  onCuesChange,
  slateMetadata,
  enableAudioMeter = true,
  defaultReviewer = 'Director',
  className = '',
  style,
}: CueframeSkinProps) {
  const store = usePlayer();
  const mediaFromContext = useMedia();
  const rootWrapperRef = useRef<HTMLDivElement | null>(null);
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const settingsClusterRef = useRef<HTMLDivElement | null>(null);
  const volumeClusterRef = useRef<HTMLDivElement | null>(null);
  const [isVolumePopoverOpen, setIsVolumePopoverOpen] = useState(false);
  const liveAnnouncementId = useId();

  // Subscribe to Video.js v10 store state
  const storePaused = usePlayer((s) => s.paused);
  const storeCurrentTime = usePlayer((s) => s.currentTime);
  const storeDuration = usePlayer((s) => s.duration);
  const storeVolume = usePlayer((s) => s.volume);
  const storeMuted = usePlayer((s) => s.muted);
  const storePlaybackRate = usePlayer((s) => s.playbackRate);
  const storeBuffered = usePlayer((s) => s.buffered);
  const storeIsFullscreen = usePlayer((s) => s.isFullscreen);
  const storeChaptersCues = usePlayer((s) => s.chaptersCues);
  const storeThumbnailsTrack = usePlayer((s) => s.thumbnailsTrack);
  const storeError = usePlayer((s) => s.error);
  const storeWaiting = usePlayer((s) => s.waiting);

  // Video.js v10 menu option hooks
  const qualityOptions = useQualityOptions();
  const audioTrackOptions = useAudioTrackOptions();
  const captionsOptions = useCaptionsOptions();
  const playbackRateOptions = usePlaybackRateOptions();

  // Explicit, deterministic Captions On/Off state (fixes double-toggle conflict & positions captions above controls)
  const [captionsEnabled, setCaptionsEnabled] = useState<boolean>(true);

  // Direct HTMLVideoElement fallback/sync for native metadata, tracks & tests
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null);
  const [domMediaState, setDomMediaState] = useState({
    paused: true,
    currentTime: 0,
    duration: 0,
    volume: 1,
    muted: false,
    playbackRate: 1,
    videoWidth: 0,
    videoHeight: 0,
    currentSrc: '',
    domChapters: [] as ChapterSegmentItem[],
    domThumbnails: [] as ThumbnailCueItem[],
    domCaptions: [] as ParsedVttCue[],
    captionTrackLabels: [] as string[],
  });

  useEffect(() => {
    const resolved =
      mediaFromContext instanceof HTMLVideoElement
        ? mediaFromContext
        : (rootWrapperRef.current?.querySelector('video') ?? null);
    setVideoEl(resolved);
  }, [mediaFromContext, children]);

  // Synchronize with native HTMLVideoElement events and <track> elements (including inline data:text/vtt URIs)
  useEffect(() => {
    if (!videoEl) return;

    const readTracks = () => {
      const chapters: ChapterSegmentItem[] = [];
      const thumbnails: ThumbnailCueItem[] = [];
      const captions: ParsedVttCue[] = [];
      const captionTrackLabels: string[] = [];

      // 1. Parse <track> elements directly when inline data:text/vtt URIs are supplied
      const trackElements = Array.from(videoEl.querySelectorAll('track'));
      for (const trackEl of trackElements) {
        const kind = (trackEl.getAttribute('kind') || 'subtitles').toLowerCase();
        const label = trackEl.getAttribute('label') || '';
        const src = trackEl.getAttribute('src') || '';
        const decodedVtt = decodeDataVttUri(src);

        if (kind === 'captions' || kind === 'subtitles') {
          captionTrackLabels.push(label || 'Captions');
        }

        if (decodedVtt) {
          const parsed = parseWebVttText(decodedVtt);
          if (kind === 'chapters') {
            chapters.push(...parsed);
          } else if (kind === 'metadata' && label.toLowerCase() === 'thumbnails') {
            parsed.forEach((c) => {
              const thumb = parseThumbnailCueUrl(c.text);
              thumbnails.push({
                startTime: c.startTime,
                endTime: c.endTime,
                url: thumb.url,
                xywh: thumb.xywh,
              });
            });
          } else if (kind === 'captions' || kind === 'subtitles') {
            captions.push(...parsed);
          }
        }
      }

      // 2. Also read browser TextTrackList cues if populated from remote .vtt files,
      // and force native caption tracks into 'hidden' mode so browser ::cue never draws under controls
      const textTracks = videoEl.textTracks;
      if (textTracks) {
        for (let i = 0; i < textTracks.length; i++) {
          const track = textTracks[i];
          if (track.kind === 'captions' || track.kind === 'subtitles') {
            if (track.mode === 'showing') {
              track.mode = 'hidden';
            }
          } else if (
            track.kind === 'chapters' ||
            (track.kind === 'metadata' && track.label === 'thumbnails')
          ) {
            if (track.mode === 'disabled') {
              track.mode = 'hidden';
            }
          }

          if (track.kind === 'chapters' && chapters.length === 0 && track.cues) {
            for (let c = 0; c < track.cues.length; c++) {
              const cue = track.cues[c] as VTTCue;
              chapters.push({
                id: cue.id || `ch-${c}`,
                startTime: cue.startTime,
                endTime: cue.endTime,
                text: cue.text || `Scene ${c + 1}`,
              });
            }
          } else if (
            track.kind === 'metadata' &&
            track.label === 'thumbnails' &&
            thumbnails.length === 0 &&
            track.cues
          ) {
            for (let c = 0; c < track.cues.length; c++) {
              const cue = track.cues[c] as VTTCue;
              const parsed = parseThumbnailCueUrl(cue.text || '');
              thumbnails.push({
                startTime: cue.startTime,
                endTime: cue.endTime,
                url: parsed.url,
                xywh: parsed.xywh,
              });
            }
          } else if (
            (track.kind === 'captions' || track.kind === 'subtitles') &&
            captions.length === 0 &&
            track.cues
          ) {
            for (let c = 0; c < track.cues.length; c++) {
              const cue = track.cues[c] as VTTCue;
              captions.push({
                id: cue.id || `cap-${c}`,
                startTime: cue.startTime,
                endTime: cue.endTime,
                text: cue.text || '',
              });
            }
          }
        }
      }

      return { chapters, thumbnails, captions, captionTrackLabels };
    };

    const syncFromVideo = () => {
      const { chapters, thumbnails, captions, captionTrackLabels } = readTracks();
      setDomMediaState({
        paused: videoEl.paused,
        currentTime: Number.isFinite(videoEl.currentTime) ? videoEl.currentTime : 0,
        duration: Number.isFinite(videoEl.duration) && videoEl.duration > 0 ? videoEl.duration : 0,
        volume: Number.isFinite(videoEl.volume) ? videoEl.volume : 1,
        muted: videoEl.muted,
        playbackRate: Number.isFinite(videoEl.playbackRate) ? videoEl.playbackRate : 1,
        videoWidth: videoEl.videoWidth || 0,
        videoHeight: videoEl.videoHeight || 0,
        currentSrc: videoEl.currentSrc || videoEl.src || '',
        domChapters: chapters,
        domThumbnails: thumbnails,
        domCaptions: captions,
        captionTrackLabels,
      });
    };

    syncFromVideo();
    const events = [
      'loadedmetadata',
      'durationchange',
      'timeupdate',
      'play',
      'pause',
      'volumechange',
      'ratechange',
      'resize',
      'seeking',
      'seeked',
    ];
    events.forEach((ev) => videoEl.addEventListener(ev, syncFromVideo));
    return () => {
      events.forEach((ev) => videoEl.removeEventListener(ev, syncFromVideo));
    };
  }, [videoEl]);

  // Unified reactive values combining Video.js v10 store and native HTMLVideoElement state
  const paused = storePaused ?? domMediaState.paused;
  const currentTime =
    Number.isFinite(storeCurrentTime) && storeCurrentTime > 0
      ? storeCurrentTime
      : domMediaState.currentTime;
  const duration =
    Number.isFinite(storeDuration) && storeDuration > 0
      ? storeDuration
      : domMediaState.duration;
  const volume = Number.isFinite(storeVolume) ? storeVolume : domMediaState.volume;
  const muted = storeMuted ?? domMediaState.muted;
  const playbackRate =
    Number.isFinite(storePlaybackRate) && storePlaybackRate > 0
      ? storePlaybackRate
      : domMediaState.playbackRate;

  // Mode management (VIEW / REVIEW / INSPECT)
  const [internalMode, setInternalMode] = useState<CueframeMode>(defaultMode);
  const activeMode = controlledMode ?? internalMode;
  const [ariaAnnouncement, setAriaAnnouncement] = useState('');

  const handleSetMode = useCallback(
    (nextMode: CueframeMode) => {
      if (controlledMode === undefined) {
        setInternalMode(nextMode);
      }
      onModeChange?.(nextMode);
      setAriaAnnouncement(`Switched to ${nextMode.toUpperCase()} mode`);
    },
    [controlledMode, onModeChange]
  );

  // Timecode format state (defaults to 'smpte' when fps is supplied, otherwise 'elapsed')
  const [timecodeFormat, setTimecodeFormat] = useState<TimecodeDisplayFormat>(
    fps ? 'smpte' : 'elapsed'
  );

  useEffect(() => {
    if (fps && timecodeFormat === 'elapsed') {
      setTimecodeFormat('smpte');
    }
  }, [fps]);

  const cycleTimecodeFormat = useCallback(() => {
    setTimecodeFormat((prev) => {
      const next = prev === 'smpte' ? 'elapsed' : prev === 'elapsed' ? 'remaining' : 'smpte';
      setAriaAnnouncement(`Timecode format set to ${next}`);
      return next;
    });
  }, []);

  // Review Cues & Persistence
  const [cues, setCues] = useState<ReviewCue[]>(() => {
    return loadPersistedCues(mediaId, initialCues).cues;
  });
  const [isDrawerOpen, setIsDrawerOpen] = useState(true);
  const [isComposerOpen, setIsComposerOpen] = useState(false);

  // Reload cues when mediaId changes
  useEffect(() => {
    const loaded = loadPersistedCues(mediaId, initialCues);
    setCues(loaded.cues);
  }, [mediaId]);

  const updateCuesList = useCallback(
    (updater: (prev: ReviewCue[]) => ReviewCue[]) => {
      setCues((prev) => {
        const next = updater(prev).sort((a, b) => a.timestamp - b.timestamp);
        savePersistedCues(mediaId, next);
        onCuesChange?.(next);
        return next;
      });
    },
    [mediaId, onCuesChange]
  );

  const handleAddCue = useCallback(
    (input: { timestamp: number; category: ReviewCueCategory; note: string; author: string }) => {
      const newCue: ReviewCue = {
        id: `cue-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp: Number(Math.max(0, input.timestamp).toFixed(3)),
        category: input.category,
        note: input.note.trim(),
        author: input.author.trim() || defaultReviewer,
        createdAt: new Date().toISOString(),
        resolved: false,
      };
      updateCuesList((prev) => [...prev, newCue]);
      setAriaAnnouncement(
        `Added ${newCue.category} review cue at ${formatSmpteTimecode(newCue.timestamp, fps)}`
      );
    },
    [defaultReviewer, fps, updateCuesList]
  );

  const handleUpdateCue = useCallback(
    (id: string, patch: Partial<Pick<ReviewCue, 'note' | 'category' | 'resolved'>>) => {
      updateCuesList((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ...patch } : c))
      );
    },
    [updateCuesList]
  );

  const handleDeleteCue = useCallback(
    (id: string) => {
      updateCuesList((prev) => prev.filter((c) => c.id !== id));
      setAriaAnnouncement('Deleted review cue');
    },
    [updateCuesList]
  );

  // Imperative Player Actions
  const seekTo = useCallback(
    (targetSeconds: number) => {
      const maxDur = duration > 0 ? duration : Number.MAX_SAFE_INTEGER;
      const clamped = Math.max(0, Math.min(maxDur, targetSeconds));
      try {
        if (store && typeof store.seek === 'function') {
          store.seek(clamped);
        }
      } catch {
        /* Fallback to videoEl */
      }
      if (videoEl) {
        videoEl.currentTime = clamped;
        videoEl.dispatchEvent(new Event('timeupdate'));
        setDomMediaState((prev) => ({ ...prev, currentTime: clamped }));
      }
    },
    [duration, store, videoEl]
  );

  const togglePlay = useCallback(() => {
    const currentlyPaused = videoEl ? videoEl.paused : paused;
    try {
      if (currentlyPaused) {
        if (store && typeof store.play === 'function') {
          store.play().catch(() => {});
        }
        videoEl?.play?.().catch?.(() => {});
      } else {
        if (store && typeof store.pause === 'function') {
          store.pause();
        }
        videoEl?.pause?.();
      }
    } catch {
      /* Ignore JSDOM play Stub errors */
    }
  }, [paused, store, videoEl]);

  const toggleMute = useCallback(() => {
    const nextMuted = !(videoEl ? videoEl.muted : muted);
    const currentVol = videoEl ? videoEl.volume : volume;
    const restoredVol = !nextMuted && currentVol === 0 ? 0.8 : currentVol;

    try {
      if (store && typeof store.setMuted === 'function') {
        store.setMuted(nextMuted);
      }
      if (!nextMuted && currentVol === 0 && store && typeof store.setVolume === 'function') {
        store.setVolume(restoredVol);
      }
    } catch {
      /* Fallback */
    }
    if (videoEl) {
      videoEl.muted = nextMuted;
      if (!nextMuted && videoEl.volume === 0) {
        videoEl.volume = restoredVol;
      }
      videoEl.dispatchEvent(new Event('volumechange'));
      setDomMediaState((prev) => ({
        ...prev,
        muted: nextMuted,
        volume: restoredVol,
      }));
    }
  }, [muted, store, videoEl, volume]);

  const setVolumeLevel = useCallback(
    (nextVol: number) => {
      const clamped = Math.max(0, Math.min(1, nextVol));
      try {
        if (store && typeof store.setVolume === 'function') {
          store.setVolume(clamped);
        }
        if (clamped > 0 && muted && store && typeof store.setMuted === 'function') {
          store.setMuted(false);
        }
      } catch {
        /* Fallback */
      }
      if (videoEl) {
        videoEl.volume = clamped;
        videoEl.muted = clamped === 0;
        videoEl.dispatchEvent(new Event('volumechange'));
        setDomMediaState((prev) => ({
          ...prev,
          volume: clamped,
          muted: clamped === 0,
        }));
      }
    },
    [muted, store, videoEl]
  );

  const setSpeed = useCallback(
    (rate: number) => {
      try {
        if (store && typeof store.setPlaybackRate === 'function') {
          store.setPlaybackRate(rate);
        }
      } catch {
        /* Fallback */
      }
      if (videoEl) {
        videoEl.playbackRate = rate;
        videoEl.dispatchEvent(new Event('ratechange'));
        setDomMediaState((prev) => ({ ...prev, playbackRate: rate }));
      }
      setAriaAnnouncement(`Playback speed ${rate}x`);
    },
    [store, videoEl]
  );

  const handleFrameStep = useCallback(
    (direction: -1 | 1) => {
      if (videoEl && !videoEl.paused) {
        videoEl.pause?.();
      }
      try {
        if (store && typeof store.pause === 'function') {
          store.pause();
        }
      } catch {
        /* Ignore */
      }
      const { targetTime, isApproximateFrame } = computeFrameStepTime(
        currentTime,
        duration,
        direction,
        fps
      );
      seekTo(targetTime);
      setAriaAnnouncement(
        `Stepped ${direction > 0 ? 'forward' : 'backward'} to ${formatSmpteTimecode(targetTime, fps)}${
          isApproximateFrame ? ' (approximate frame)' : ''
        }`
      );
    },
    [currentTime, duration, fps, seekTo, store, videoEl]
  );

  const toggleFullscreen = useCallback(() => {
    try {
      if (storeIsFullscreen || document.fullscreenElement) {
        store?.exitFullscreen?.().catch(() => {});
        if (document.fullscreenElement) {
          document.exitFullscreen?.().catch(() => {});
        }
      } else {
        store?.requestFullscreen?.().catch(() => {});
        rootWrapperRef.current?.requestFullscreen?.().catch(() => {});
      }
    } catch {
      /* Fullscreen API unavailable in environment */
    }
  }, [store, storeIsFullscreen]);

  // Deterministic Single-Source-of-Truth Captions Toggle (Fixes double-toggle bug)
  const toggleCaptions = useCallback(() => {
    setCaptionsEnabled((prev) => {
      const next = !prev;
      if (videoEl && videoEl.textTracks) {
        for (let i = 0; i < videoEl.textTracks.length; i++) {
          const track = videoEl.textTracks[i];
          if (track.kind === 'captions' || track.kind === 'subtitles') {
            track.mode = next ? 'hidden' : 'disabled';
          }
        }
      }
      setAriaAnnouncement(`Captions ${next ? 'enabled' : 'disabled'}`);
      return next;
    });
  }, [videoEl]);

  // Active Caption Cues at Current Timestamp
  const activeCaptionCues = useMemo(() => {
    if (!captionsEnabled) return [];
    return domMediaState.domCaptions.filter(
      (cue) => currentTime >= cue.startTime && currentTime <= cue.endTime
    );
  }, [captionsEnabled, currentTime, domMediaState.domCaptions]);

  // A–B Loop State & Enforcement
  const [abLoop, setAbLoop] = useState<ABLoopState>({
    inPoint: null,
    outPoint: null,
    active: false,
  });

  const cycleAbLoop = useCallback(() => {
    setAbLoop((prev) => {
      if (prev.inPoint === null) {
        setAriaAnnouncement(`Loop In-Point A set at ${formatElapsedTime(currentTime)}`);
        return { inPoint: currentTime, outPoint: null, active: false };
      }
      if (prev.outPoint === null) {
        const out = currentTime > prev.inPoint + 0.25 ? currentTime : prev.inPoint + 3;
        const clampedOut = duration > 0 ? Math.min(duration, out) : out;
        setAriaAnnouncement(
          `A-B Loop active from ${formatElapsedTime(prev.inPoint)} to ${formatElapsedTime(clampedOut)}`
        );
        return { inPoint: prev.inPoint, outPoint: clampedOut, active: true };
      }
      setAriaAnnouncement('A-B Loop cleared');
      return { inPoint: null, outPoint: null, active: false };
    });
  }, [currentTime, duration]);

  useEffect(() => {
    if (
      abLoop.active &&
      abLoop.inPoint !== null &&
      abLoop.outPoint !== null &&
      currentTime >= abLoop.outPoint
    ) {
      seekTo(abLoop.inPoint);
    }
  }, [abLoop, currentTime, seekTo]);

  // Framing Guides State (MODE 03 — INSPECT)
  const [framingGuides, setFramingGuides] = useState<FramingGuideConfig>({
    aspectMask: 'off',
    ruleOfThirds: false,
    centerCrosshair: false,
    safeActionTitle: false,
  });

  // Reduced Motion Detection
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const listener = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener?.('change', listener);
    return () => mq.removeEventListener?.('change', listener);
  }, []);

  // Web Audio API Stereo Peak Meter (Progressive Enhancement)
  const audioMeter = useWebAudioMeter(videoEl, {
    enabled: enableAudioMeter && (activeMode === 'inspect' || activeMode === 'review'),
    paused,
    muted,
    reducedMotion,
  });

  // Idle Pointer Tracking for VIEW Mode Auto-Hide
  const [isIdle, setIsIdle] = useState(false);
  const idleTimerRef = useRef<number | null>(null);

  const registerPointerActivity = useCallback(() => {
    setIsIdle(false);
    if (idleTimerRef.current) {
      window.clearTimeout(idleTimerRef.current);
    }
    if (!paused && activeMode === 'view' && !isComposerOpen) {
      idleTimerRef.current = window.setTimeout(() => {
        setIsIdle(true);
      }, 2400);
    }
  }, [activeMode, isComposerOpen, paused]);

  useEffect(() => {
    if (paused || activeMode !== 'view') {
      setIsIdle(false);
    }
  }, [paused, activeMode]);

  // Chapters & Storyboard Cues Normalization
  const chapters: ChapterSegmentItem[] = useMemo(() => {
    if (domMediaState.domChapters.length > 0) {
      return domMediaState.domChapters;
    }
    if (storeChaptersCues && storeChaptersCues.length > 0) {
      return storeChaptersCues.map((c, idx) => ({
        id: `vjs-ch-${idx}`,
        startTime: c.startTime,
        endTime: c.endTime,
        text: c.text,
      }));
    }
    return [];
  }, [storeChaptersCues, domMediaState.domChapters]);

  const thumbnails: ThumbnailCueItem[] = useMemo(() => {
    if (domMediaState.domThumbnails.length > 0) {
      return domMediaState.domThumbnails;
    }
    if (storeThumbnailsTrack && storeThumbnailsTrack.cues.length > 0) {
      return storeThumbnailsTrack.cues.map((c) => {
        const parsed = parseThumbnailCueUrl(c.text);
        return {
          startTime: c.startTime,
          endTime: c.endTime,
          url: parsed.url,
          xywh: parsed.xywh,
        };
      });
    }
    return [];
  }, [storeThumbnailsTrack, domMediaState.domThumbnails]);

  const activeChapter = useMemo(() => {
    return chapters.find((ch) => currentTime >= ch.startTime && currentTime < ch.endTime) ?? null;
  }, [chapters, currentTime]);

  // Scrub Pointer Preview & Global Window Drag State
  const [hoverPercent, setHoverPercent] = useState<number | null>(null);
  const [isDraggingTimeline, setIsDraggingTimeline] = useState(false);

  const computeTimelinePercentFromClientX = useCallback((clientX: number): number => {
    const el = timelineRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return 0;
    const ratio = (clientX - rect.left) / rect.width;
    return Math.max(0, Math.min(100, ratio * 100));
  }, []);

  // Ensure releasing pointer anywhere on the window cleanly terminates timeline drag
  useEffect(() => {
    if (!isDraggingTimeline) return;

    const handleWindowPointerMove = (e: PointerEvent | MouseEvent) => {
      const pct = computeTimelinePercentFromClientX(e.clientX);
      setHoverPercent(pct);
      if (duration > 0) {
        seekTo((pct / 100) * duration);
      }
    };

    const handleWindowPointerUp = () => {
      setIsDraggingTimeline(false);
    };

    window.addEventListener('pointermove', handleWindowPointerMove);
    window.addEventListener('pointerup', handleWindowPointerUp);
    window.addEventListener('pointercancel', handleWindowPointerUp);
    return () => {
      window.removeEventListener('pointermove', handleWindowPointerMove);
      window.removeEventListener('pointerup', handleWindowPointerUp);
      window.removeEventListener('pointercancel', handleWindowPointerUp);
    };
  }, [computeTimelinePercentFromClientX, duration, isDraggingTimeline, seekTo]);

  const hoverTime = useMemo(() => {
    if (hoverPercent === null || duration <= 0) return null;
    return (hoverPercent / 100) * duration;
  }, [hoverPercent, duration]);

  const hoveredChapter = useMemo(() => {
    if (hoverTime === null) return null;
    return chapters.find((ch) => hoverTime >= ch.startTime && hoverTime <= ch.endTime) ?? null;
  }, [chapters, hoverTime]);

  const hoveredThumbnail = useMemo(() => {
    if (hoverTime === null) return null;
    return thumbnails.find((t) => hoverTime >= t.startTime && hoverTime < t.endTime) ?? null;
  }, [thumbnails, hoverTime]);

  // Settings & Quick-Tools Sheet Open State + Outside-Click Dismissal
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    if (!isSettingsOpen) return;
    const handleOutsidePointerDown = (e: MouseEvent) => {
      if (
        settingsClusterRef.current &&
        !settingsClusterRef.current.contains(e.target as Node)
      ) {
        setIsSettingsOpen(false);
      }
    };
    window.addEventListener('mousedown', handleOutsidePointerDown);
    return () => window.removeEventListener('mousedown', handleOutsidePointerDown);
  }, [isSettingsOpen]);

  useEffect(() => {
    if (!isVolumePopoverOpen) return;
    const handleOutsidePointerDown = (e: MouseEvent) => {
      if (
        volumeClusterRef.current &&
        !volumeClusterRef.current.contains(e.target as Node)
      ) {
        setIsVolumePopoverOpen(false);
      }
    };
    window.addEventListener('mousedown', handleOutsidePointerDown);
    return () => window.removeEventListener('mousedown', handleOutsidePointerDown);
  }, [isVolumePopoverOpen]);

  // Runtime Stream Telemetry for MODE 03 — INSPECT
  const telemetry: RuntimeStreamTelemetry = useMemo(() => {
    let bufferedAhead = 0;
    if (storeBuffered && storeBuffered.length > 0) {
      const lastEnd = storeBuffered[storeBuffered.length - 1][1];
      bufferedAhead = Math.max(0, lastEnd - currentTime);
    } else if (videoEl && videoEl.buffered && videoEl.buffered.length > 0) {
      const lastEnd = videoEl.buffered.end(videoEl.buffered.length - 1);
      bufferedAhead = Math.max(0, lastEnd - currentTime);
    }

    const fallbackCaptionTracks =
      domMediaState.captionTrackLabels.length > 0
        ? domMediaState.captionTrackLabels.map((lbl, idx) => ({
            id: `cap-${idx}`,
            label: lbl,
            language: 'en',
            showing: captionsEnabled,
          }))
        : [];

    const realVjsCaptionTracks = (captionsOptions?.options ?? []).filter(
      (o) => o.value !== 'off' && String(o.label).toLowerCase() !== 'off'
    );

    return {
      videoWidth: domMediaState.videoWidth,
      videoHeight: domMediaState.videoHeight,
      playbackRate,
      bufferedSeconds: bufferedAhead,
      duration,
      activeQualityLabel:
        qualityOptions?.selectedLabel ||
        (domMediaState.videoHeight ? `Auto (${domMediaState.videoHeight}p)` : 'Auto'),
      availableQualitiesCount: qualityOptions?.options?.length || 1,
      audioTracks:
        audioTrackOptions?.options?.map((o) => ({
          id: o.value,
          label: String(o.label),
          language: '',
          enabled: o.value === audioTrackOptions.value,
        })) ?? [],
      captionTracks:
        realVjsCaptionTracks.length > 0
          ? realVjsCaptionTracks.map((o) => ({
              id: o.value,
              label: String(o.label),
              language: '',
              showing: captionsEnabled,
            }))
          : fallbackCaptionTracks,
      streamSource: domMediaState.currentSrc,
    };
  }, [
    audioTrackOptions,
    captionsEnabled,
    captionsOptions,
    currentTime,
    domMediaState.captionTrackLabels,
    domMediaState.currentSrc,
    domMediaState.videoHeight,
    domMediaState.videoWidth,
    duration,
    playbackRate,
    qualityOptions,
    storeBuffered,
    videoEl,
  ]);

  // Filmmaker Keyboard Shortcuts with Strict Editable Input Safeguards
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (isEditableTarget(e.target)) {
        if (e.key === 'Escape' && isComposerOpen) {
          setIsComposerOpen(false);
        }
        return;
      }
      if (e.key === 'Escape') {
        if (isVolumePopoverOpen) setIsVolumePopoverOpen(false);
        if (isSettingsOpen) setIsSettingsOpen(false);
        if (isComposerOpen) setIsComposerOpen(false);
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      switch (e.key) {
        case ' ':
        case 'k':
        case 'K':
          e.preventDefault();
          togglePlay();
          break;
        case 'j':
        case 'J':
          e.preventDefault();
          seekTo(currentTime - 5);
          break;
        case 'l':
        case 'L':
          e.preventDefault();
          seekTo(currentTime + 5);
          break;
        case 'n':
        case 'N':
          e.preventDefault();
          if (activeMode !== 'review') {
            handleSetMode('review');
          }
          setIsDrawerOpen(true);
          setIsComposerOpen(true);
          break;
        case '1':
          e.preventDefault();
          handleSetMode('view');
          break;
        case '2':
          e.preventDefault();
          handleSetMode('review');
          break;
        case '3':
          e.preventDefault();
          handleSetMode('inspect');
          break;
        case 'm':
        case 'M':
          e.preventDefault();
          toggleMute();
          break;
        case 'c':
        case 'C':
          e.preventDefault();
          toggleCaptions();
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'b':
        case 'B':
          e.preventDefault();
          cycleAbLoop();
          break;
        case ',':
          e.preventDefault();
          handleFrameStep(-1);
          break;
        case '.':
          e.preventDefault();
          handleFrameStep(1);
          break;
        default:
          break;
      }
    },
    [
      activeMode,
      currentTime,
      cycleAbLoop,
      handleFrameStep,
      handleSetMode,
      isComposerOpen,
      isSettingsOpen,
      seekTo,
      toggleCaptions,
      toggleFullscreen,
      toggleMute,
      togglePlay,
    ]
  );

  const formattedTime = useMemo(
    () => formatDisplayTime(currentTime, duration, timecodeFormat, fps),
    [currentTime, duration, fps, timecodeFormat]
  );

  const fillPercent = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;
  const bufferPercent = useMemo(() => {
    if (duration <= 0) return 0;
    if (storeBuffered && storeBuffered.length > 0) {
      const end = storeBuffered[storeBuffered.length - 1][1];
      return Math.min(100, Math.max(0, (end / duration) * 100));
    }
    return Math.min(100, fillPercent + 15);
  }, [duration, fillPercent, storeBuffered]);

  const speeds = [0.5, 1, 1.25, 1.5, 2];

  return (
    <div
      ref={rootWrapperRef}
      onKeyDown={handleKeyDown}
      onPointerMove={registerPointerActivity}
      onPointerEnter={() => setIsIdle(false)}
      style={{ width: '100%', height: '100%' }}
    >
      <Container
        className={`cueframe-skin ${className}`.trim()}
        data-cueframe-mode={activeMode}
        data-drawer-open={activeMode === 'review' && isDrawerOpen ? 'true' : 'false'}
        data-captions-enabled={captionsEnabled ? 'true' : 'false'}
        data-idle={isIdle ? 'true' : 'false'}
        data-paused={paused ? 'true' : undefined}
        data-fullscreen={storeIsFullscreen ? 'true' : undefined}
        data-testid="cueframe-skin-root"
        aria-label="CUEFRAME Cinematic Review Console"
        style={style}
      >
        {/* Video.js v10 Built-In Screen Reader Status Announcer */}
        <StatusAnnouncer />

        {/* CUEFRAME Polite Live Region for Mode & Cue Announcements */}
        <div
          id={liveAnnouncementId}
          role="status"
          aria-live="polite"
          aria-atomic="true"
          style={{
            position: 'absolute',
            width: '1px',
            height: '1px',
            padding: 0,
            margin: '-1px',
            overflow: 'hidden',
            clip: 'rect(0, 0, 0, 0)',
            whiteSpace: 'nowrap',
            border: 0,
          }}
        >
          {ariaAnnouncement}
        </div>

        {/* Media Viewport */}
        <div
          className="cueframe-viewport"
          onClick={(e) => {
            if (e.target === e.currentTarget || (e.target as HTMLElement).tagName === 'VIDEO') {
              togglePlay();
            }
          }}
          onDoubleClick={(e) => {
            if (e.target === e.currentTarget || (e.target as HTMLElement).tagName === 'VIDEO') {
              toggleFullscreen();
            }
          }}
        >
          {children}

          {/* Cinematographer Aspect-Ratio & Framing Guides Overlay */}
          <FramingGuidesOverlay config={framingGuides} />

          {/* Cinema-Grade Custom Captions Overlay (Always Positioned Above Control Console) */}
          {captionsEnabled && activeCaptionCues.length > 0 && (
            <div
              className="cueframe-captions-overlay"
              data-testid="cueframe-captions-overlay"
              aria-live="off"
            >
              {activeCaptionCues.map((cue) => (
                <div
                  key={cue.id}
                  className="cueframe-caption-cue-box"
                  data-testid="cueframe-caption-text"
                >
                  {cue.text}
                </div>
              ))}
            </div>
          )}

          {/* Buffering Spinner Pill */}
          {storeWaiting && (
            <div
              className="cueframe-plate cueframe-tabular"
              role="status"
              data-testid="buffering-indicator"
              style={{
                position: 'absolute',
                padding: '6px 12px',
                fontSize: '11px',
                color: '#e5a93c',
                zIndex: 20,
              }}
            >
              BUFFERING STREAM...
            </div>
          )}

          {/* Playback Error State Overlay */}
          {storeError && (
            <div
              className="cueframe-plate"
              role="alert"
              data-testid="error-dialog-overlay"
              style={{
                position: 'absolute',
                inset: '16px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '20px',
                textAlign: 'center',
                zIndex: 40,
              }}
            >
              <strong className="cueframe-tabular" style={{ color: '#fb7185', fontSize: '13px' }}>
                SIGNAL LOSS // MEDIA PLAYBACK ERROR
              </strong>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--cueframe-text-secondary)' }}>
                {storeError.message || 'The media source could not be decoded or reached.'}
              </p>
            </div>
          )}
        </div>

        {/* Top Contextual Bar: Slate Badge, INSPECT Panel, and REVIEW Drawer Toggle */}
        <div className="cueframe-top-bar">
          {/* Left: Slate Header Pill (VIEW/REVIEW) or Full Telemetry Panel (INSPECT) */}
          <div className="cueframe-top-left-cluster">
            {activeMode === 'inspect' ? (
              <InspectTelemetryPanel
                telemetry={telemetry}
                fps={fps}
                slateMetadata={slateMetadata}
                framingGuides={framingGuides}
                onUpdateGuides={setFramingGuides}
                audioMeter={audioMeter}
              />
            ) : (
              <div
                className="cueframe-plate cueframe-tabular cueframe-slate-pill"
                data-testid="slate-header-pill"
              >
                <span
                  style={{
                    width: '7px',
                    height: '7px',
                    flexShrink: 0,
                    borderRadius: '50%',
                    background: paused ? '#7c7c88' : '#e5a93c',
                  }}
                />
                <strong className="cueframe-slate-title">
                  {slateMetadata?.productionTitle || 'CUEFRAME SCREENING'}
                </strong>
                {activeChapter && (
                  <span
                    className="cueframe-hide-narrow"
                    data-testid="active-chapter-badge"
                    style={{
                      color: '#e5a93c',
                      borderLeft: '1px solid rgba(255,255,255,0.16)',
                      paddingLeft: '8px',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {activeChapter.text}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Right: Quick Action Pills for REVIEW / INSPECT */}
          <div className="cueframe-top-right-cluster">
            {activeMode === 'review' && (
              <>
                <button
                  type="button"
                  className="cueframe-btn cueframe-plate"
                  data-testid="quick-add-cue-btn"
                  onClick={() => {
                    setIsDrawerOpen(true);
                    setIsComposerOpen(true);
                  }}
                  aria-label="Add review cue at current timecode"
                >
                  <CuePinIcon />
                  <span className="cueframe-hide-narrow">Add Cue (N)</span>
                </button>
                <button
                  type="button"
                  className="cueframe-btn cueframe-plate"
                  data-active={isDrawerOpen}
                  aria-pressed={isDrawerOpen}
                  data-testid="toggle-review-drawer-btn"
                  onClick={() => setIsDrawerOpen((o) => !o)}
                  aria-label="Toggle review slate drawer"
                >
                  <DrawerIcon />
                  <span className="cueframe-tabular">{cues.length}</span>
                </button>
              </>
            )}

            {activeMode !== 'inspect' && framingGuides.aspectMask !== 'off' && (
              <button
                type="button"
                className="cueframe-btn cueframe-plate cueframe-tabular"
                onClick={() => setFramingGuides((g) => ({ ...g, aspectMask: 'off' }))}
                title="Clear active aspect mask"
                style={{ fontSize: '10px', color: '#e5a93c' }}
              >
                <FrameGuidesIcon />
                <span>{framingGuides.aspectMask}</span>
              </button>
            )}
          </div>
        </div>

        {/* MODE 02 — REVIEW Slate Side Drawer */}
        {activeMode === 'review' && isDrawerOpen && (
          <ReviewSlateDrawer
            cues={cues}
            currentTime={currentTime}
            fps={fps}
            productionTitle={slateMetadata?.productionTitle}
            defaultReviewer={defaultReviewer}
            isComposerOpen={isComposerOpen}
            onOpenComposer={() => setIsComposerOpen(true)}
            onCloseComposer={() => setIsComposerOpen(false)}
            onCloseDrawer={() => setIsDrawerOpen(false)}
            onAddCue={handleAddCue}
            onUpdateCue={handleUpdateCue}
            onDeleteCue={handleDeleteCue}
            onSeekToCue={seekTo}
          />
        )}

        {/* Bottom Floating Console: Timeline Deck + Adaptive Transport & Mode Switcher Bar */}
        <div className="cueframe-bottom-console">
          {/* Timeline Deck */}
          <div className="cueframe-plate cueframe-timeline-deck">
            {/* Scene & Cue Status Sub-header in REVIEW Mode */}
            {activeMode === 'review' && (
              <div
                className="cueframe-tabular"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '6px',
                  fontSize: '10px',
                  color: 'var(--cueframe-text-secondary)',
                }}
              >
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {activeChapter ? `SCENE: ${activeChapter.text}` : 'TIMELINE // VERNIER FINE-SCRUB'}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  {abLoop.inPoint !== null && (
                    <span style={{ color: '#38bdf8' }} data-testid="ab-loop-readout">
                      LOOP A: {formatElapsedTime(abLoop.inPoint)}
                      {abLoop.outPoint !== null ? ` → B: ${formatElapsedTime(abLoop.outPoint)}` : ' (Set B)'}
                    </span>
                  )}
                  <span className="cueframe-hide-narrow">
                    {chapters.length} Scenes · {cues.length} Cues
                  </span>
                </div>
              </div>
            )}

            {/* Interactive Timeline Slider with Chapters, Storyboard Preview & Cue Pins */}
            <div
              ref={timelineRef}
              role="slider"
              tabIndex={0}
              aria-label="Seek timeline"
              aria-valuemin={0}
              aria-valuemax={Math.round(duration || 100)}
              aria-valuenow={Math.round(currentTime)}
              aria-valuetext={formattedTime.primary}
              data-testid="cueframe-timeline-slider"
              className="cueframe-slider-container"
              onPointerMove={(e) => {
                const pct = computeTimelinePercentFromClientX(e.clientX);
                setHoverPercent(pct);
                if (isDraggingTimeline && duration > 0) {
                  seekTo((pct / 100) * duration);
                }
              }}
              onPointerLeave={() => {
                if (!isDraggingTimeline) {
                  setHoverPercent(null);
                }
              }}
              onPointerDown={(e) => {
                const pct = computeTimelinePercentFromClientX(e.clientX);
                setHoverPercent(pct);
                setIsDraggingTimeline(true);
                if (duration > 0) {
                  seekTo((pct / 100) * duration);
                }
              }}
              onPointerUp={() => setIsDraggingTimeline(false)}
              onKeyDown={(e) => {
                const step = fps ? 1 / fps : 1;
                if (e.key === 'ArrowRight') {
                  e.preventDefault();
                  e.stopPropagation();
                  seekTo(currentTime + (e.shiftKey ? 5 : step));
                } else if (e.key === 'ArrowLeft') {
                  e.preventDefault();
                  e.stopPropagation();
                  seekTo(currentTime - (e.shiftKey ? 5 : step));
                } else if (e.key === 'Home') {
                  e.preventDefault();
                  e.stopPropagation();
                  seekTo(0);
                } else if (e.key === 'End' && duration > 0) {
                  e.preventDefault();
                  e.stopPropagation();
                  seekTo(duration);
                }
              }}
            >
              {/* Hover Storyboard & Chapter Preview Card */}
              {hoverPercent !== null && hoverTime !== null && (
                <div
                  className="cueframe-plate cueframe-scrub-preview"
                  data-testid="timeline-scrub-preview"
                  style={{
                    left: `${Math.min(92, Math.max(8, hoverPercent))}%`,
                  }}
                >
                  {hoveredThumbnail && (
                    <div className="cueframe-scrub-thumb-frame" data-testid="storyboard-preview-box">
                      <img
                        src={hoveredThumbnail.url}
                        alt=""
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                        }}
                      />
                    </div>
                  )}
                  {hoveredChapter && (
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 600,
                        color: '#e5a93c',
                        maxWidth: '160px',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {hoveredChapter.text}
                    </span>
                  )}
                  <span className="cueframe-tabular" style={{ fontSize: '11px', fontWeight: 600 }}>
                    {formatSmpteTimecode(hoverTime, fps)}
                  </span>
                </div>
              )}

              {/* Track Wrapper */}
              <div className="cueframe-slider-track-wrapper">
                {/* Buffer & Fill Progress */}
                <div
                  className="cueframe-slider-buffer"
                  style={{ width: `${bufferPercent.toFixed(2)}%` }}
                />
                <div
                  className="cueframe-slider-fill"
                  data-testid="timeline-fill-bar"
                  style={{ width: `${fillPercent.toFixed(2)}%` }}
                />

                {/* Vernier Fine-Scrub Scale */}
                <div className="cueframe-vernier-ruler" />

                {/* Normalized Chapter Scene Segments */}
                {duration > 0 && chapters.length > 0 && (
                  <div className="cueframe-chapter-segments" data-testid="timeline-chapter-segments">
                    {chapters.map((ch) => {
                      const startPct = Math.max(0, (ch.startTime / duration) * 100);
                      const widthPct = Math.max(
                        1,
                        ((Math.min(duration, ch.endTime) - ch.startTime) / duration) * 100
                      );
                      return (
                        <div
                          key={ch.id}
                          className="cueframe-chapter-segment"
                          data-testid="chapter-segment-block"
                          style={{
                            left: `${startPct.toFixed(2)}%`,
                            width: `${widthPct.toFixed(2)}%`,
                          }}
                        >
                          <span className="cueframe-chapter-segment-label">{ch.text}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* A–B Loop Range Bracket */}
                {abLoop.inPoint !== null && duration > 0 && (
                  <div
                    className="cueframe-ab-loop-region"
                    data-testid="ab-loop-region"
                    style={{
                      left: `${((abLoop.inPoint / duration) * 100).toFixed(2)}%`,
                      width: `${(
                        (((abLoop.outPoint ?? currentTime) - abLoop.inPoint) / duration) *
                        100
                      ).toFixed(2)}%`,
                    }}
                  />
                )}

                {/* Timestamped Review Cue Pins */}
                {duration > 0 &&
                  cues.map((cue) => {
                    const leftPct = Math.max(0, Math.min(100, (cue.timestamp / duration) * 100));
                    return (
                      <button
                        key={cue.id}
                        type="button"
                        className="cueframe-cue-pin"
                        data-category={cue.category}
                        data-testid={`timeline-cue-pin-${cue.id}`}
                        aria-label={`${cue.category} cue at ${formatSmpteTimecode(cue.timestamp, fps)}: ${cue.note}`}
                        title={`[${cue.category}] ${formatSmpteTimecode(cue.timestamp, fps)} — ${cue.note}`}
                        style={{ left: `${leftPct.toFixed(2)}%` }}
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          seekTo(cue.timestamp);
                          if (activeMode === 'view') {
                            handleSetMode('review');
                          }
                          setIsDrawerOpen(true);
                        }}
                      />
                    );
                  })}
              </div>

              {/* Playhead Needle Thumb */}
              <div
                className="cueframe-playhead-thumb"
                style={{ left: `${fillPercent.toFixed(2)}%` }}
              />
            </div>
          </div>

          {/* Primary Transport, Timecode & Mode Switcher Bar */}
          <div className="cueframe-plate cueframe-control-bar" ref={settingsClusterRef}>
            {/* Left Cluster: Play/Pause, Frame-Step (-1F/+1F), Volume & Timecode */}
            <div className="cueframe-control-cluster">
              <button
                type="button"
                className="cueframe-btn"
                data-testid="play-pause-btn"
                aria-label={paused ? 'Play' : 'Pause'}
                onClick={togglePlay}
              >
                {paused ? <PlayIcon /> : <PauseIcon />}
              </button>

              {/* Inline Frame-Step Controls (visible on >= 420px; also available inside Quick-Tools sheet on narrow screens) */}
              <div className="cueframe-control-cluster cueframe-hide-narrow">
                <button
                  type="button"
                  className="cueframe-btn cueframe-tabular"
                  data-testid="step-backward-btn"
                  aria-label="Step backward 1 frame (approximate in browser)"
                  title={
                    fps
                      ? `Step -1 frame (~${(1000 / fps).toFixed(1)}ms at ${fps}fps)`
                      : 'Step -40ms (fallback; frame rate not supplied)'
                  }
                  onClick={() => handleFrameStep(-1)}
                >
                  <StepBackIcon />
                </button>
                <button
                  type="button"
                  className="cueframe-btn cueframe-tabular"
                  data-testid="step-forward-btn"
                  aria-label="Step forward 1 frame (approximate in browser)"
                  title={
                    fps
                      ? `Step +1 frame (~${(1000 / fps).toFixed(1)}ms at ${fps}fps)`
                      : 'Step +40ms (fallback; frame rate not supplied)'
                  }
                  onClick={() => handleFrameStep(1)}
                >
                  <StepForwardIcon />
                </button>
              </div>

              {/* Mute & Inline/Popover Volume Controls */}
              <div
                className="cueframe-control-cluster"
                ref={volumeClusterRef}
                style={{ position: 'relative' }}
              >
                <button
                  type="button"
                  className="cueframe-btn"
                  data-testid="mute-toggle-btn"
                  aria-label={muted ? 'Unmute' : 'Mute'}
                  onClick={toggleMute}
                >
                  {muted || volume === 0 ? <VolumeMutedIcon /> : <VolumeHighIcon />}
                </button>

                {/* Direct Touch / Small-Screen Volume Trigger Button */}
                <button
                  type="button"
                  className="cueframe-btn cueframe-tabular"
                  data-testid="volume-popover-trigger-btn"
                  aria-label={`Audio volume ${muted || volume === 0 ? 'muted' : `${Math.round(volume * 100)}%`}. Click for quick volume controls.`}
                  aria-expanded={isVolumePopoverOpen}
                  title="Open direct volume controls"
                  onClick={() => setIsVolumePopoverOpen((v) => !v)}
                  style={{
                    padding: '0 6px',
                    fontSize: '10px',
                    fontWeight: 600,
                    minWidth: 'auto',
                    height: '24px',
                    background: isVolumePopoverOpen ? 'rgba(229, 169, 60, 0.25)' : '#161620',
                    border: '1px solid #282836',
                    color: isVolumePopoverOpen ? '#e5a93c' : '#f4f4f6',
                  }}
                >
                  <span>{muted || volume === 0 ? '0%' : `${Math.round(volume * 100)}%`}</span>
                  <span style={{ fontSize: '8px', opacity: 0.7 }}>▲</span>
                </button>

                {/* Inline Volume Slider on Desktop / Large Screens */}
                <input
                  type="range"
                  className="cueframe-input cueframe-hide-tablet"
                  aria-label="Volume level"
                  data-testid="volume-range-input"
                  min={0}
                  max={1}
                  step={0.05}
                  value={muted ? 0 : volume}
                  onChange={(e) => setVolumeLevel(Number(e.target.value))}
                  style={{
                    width: '54px',
                    accentColor: 'var(--media-accent-color)',
                    cursor: 'pointer',
                  }}
                />

                {/* Floating Volume Capsule Popover Sheet */}
                {isVolumePopoverOpen && (
                  <div
                    className="cueframe-plate cueframe-tabular cueframe-volume-popover-sheet"
                    role="dialog"
                    aria-label="Audio volume controls"
                    data-testid="volume-popover-sheet"
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '10px',
                        color: 'var(--cueframe-text-secondary)',
                        fontWeight: 600,
                      }}
                    >
                      <span>AUDIO LEVEL: {muted ? 'MUTED' : `${Math.round(volume * 100)}%`}</span>
                      <button
                        type="button"
                        className="cueframe-btn"
                        aria-label="Close volume controls"
                        onClick={() => setIsVolumePopoverOpen(false)}
                        style={{ height: '18px', minWidth: '18px', padding: 0, fontSize: '12px' }}
                      >
                        ×
                      </button>
                    </div>

                    {/* Popover direct touch slider */}
                    <input
                      type="range"
                      aria-label="Popover volume level slider"
                      data-testid="popover-volume-slider"
                      min={0}
                      max={1}
                      step={0.05}
                      value={muted ? 0 : volume}
                      onChange={(e) => setVolumeLevel(Number(e.target.value))}
                      style={{
                        width: '100%',
                        accentColor: 'var(--media-accent-color)',
                        cursor: 'pointer',
                      }}
                    />

                    {/* -10% and +10% quick step adjustments */}
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        type="button"
                        className="cueframe-btn"
                        data-testid="volume-reduce-step-btn"
                        aria-label="Reduce volume by 10%"
                        onClick={() => setVolumeLevel(Math.max(0, (muted ? 0 : volume) - 0.1))}
                        style={{ flex: 1, height: '24px', fontSize: '10px' }}
                      >
                        −10%
                      </button>
                      <button
                        type="button"
                        className="cueframe-btn"
                        data-testid="volume-increase-step-btn"
                        aria-label="Increase volume by 10%"
                        onClick={() => setVolumeLevel(Math.min(1, (muted ? 0 : volume) + 0.1))}
                        style={{ flex: 1, height: '24px', fontSize: '10px' }}
                      >
                        +10%
                      </button>
                      <button
                        type="button"
                        className="cueframe-btn"
                        data-testid="popover-mute-btn"
                        aria-label={muted ? 'Unmute' : 'Mute'}
                        onClick={toggleMute}
                        style={{
                          flex: 1,
                          height: '24px',
                          fontSize: '10px',
                          color: muted ? '#fb7185' : 'inherit',
                        }}
                      >
                        {muted ? 'Unmute' : 'Mute'}
                      </button>
                    </div>

                    {/* Quick preset levels */}
                    <div style={{ display: 'flex', gap: '3px' }}>
                      {[0.25, 0.5, 0.75, 1.0].map((lvl) => (
                        <button
                          key={lvl}
                          type="button"
                          className="cueframe-btn"
                          data-testid={`volume-preset-${Math.round(lvl * 100)}`}
                          onClick={() => setVolumeLevel(lvl)}
                          style={{
                            flex: 1,
                            height: '20px',
                            minWidth: 'auto',
                            padding: '0 3px',
                            fontSize: '9px',
                            background:
                              !muted && Math.abs(volume - lvl) < 0.05
                                ? 'rgba(229, 169, 60, 0.25)'
                                : undefined,
                            color:
                              !muted && Math.abs(volume - lvl) < 0.05 ? '#e5a93c' : undefined,
                          }}
                        >
                          {Math.round(lvl * 100)}%
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Clickable Multi-Format Timecode Display (Compacts automatically on narrow screens) */}
              <button
                type="button"
                className="cueframe-btn cueframe-tabular"
                data-testid="timecode-display-btn"
                aria-label={`Timecode ${formattedTime.primary} of ${formattedTime.secondary}. Click to switch format.`}
                title={`Timing mode: ${formattedTime.badge}. Click to toggle SMPTE / Elapsed / Remaining.`}
                onClick={cycleTimecodeFormat}
                style={{
                  padding: '0 6px',
                  background: '#121218',
                  border: '1px solid #272733',
                }}
              >
                <span style={{ color: 'var(--cueframe-text-primary)', fontWeight: 600 }}>
                  {formattedTime.primary}
                </span>
                <span className="cueframe-hide-narrow" style={{ color: '#a1a1aa' }}>
                  /
                </span>
                <span className="cueframe-hide-narrow" style={{ color: '#d4d4dc' }}>
                  {formattedTime.secondary}
                </span>
                <span
                  className="cueframe-hide-tablet"
                  style={{
                    fontSize: '9px',
                    fontWeight: 600,
                    padding: '1px 5px',
                    borderRadius: '2px',
                    background: '#1a1a24',
                    border: '1px solid #333346',
                    color: '#e4e4e8',
                  }}
                >
                  {formattedTime.badge}
                </span>
              </button>
            </div>

            {/* Center Cluster: Tri-Mode Switcher (Automatically moves to full-width top row on <= 560px) */}
            <div
              className="cueframe-mode-switcher"
              role="group"
              aria-label="Working mode switcher"
              data-testid="mode-switcher-group"
            >
              {(['view', 'review', 'inspect'] as const).map((m, idx) => (
                <button
                  key={m}
                  type="button"
                  className="cueframe-mode-btn"
                  data-testid={`mode-btn-${m}`}
                  aria-pressed={activeMode === m}
                  onClick={() => handleSetMode(m)}
                  title={`Switch to ${m.toUpperCase()} mode (Shortcut: ${idx + 1})`}
                >
                  <span className="cueframe-hide-tablet" style={{ opacity: 0.6 }}>
                    0{idx + 1}
                  </span>
                  <span>{m.toUpperCase()}</span>
                </button>
              ))}
            </div>

            {/* Right Cluster: Always-Visible CC, Speed/Quick-Tools Console Sheet & Fullscreen */}
            <div className="cueframe-control-cluster">
              {/* Inline A–B Loop Button (Visible on >= 420px; also inside Quick-Tools sheet on all screens) */}
              <button
                type="button"
                className="cueframe-btn cueframe-hide-narrow"
                data-testid="ab-loop-btn"
                data-active={abLoop.inPoint !== null}
                aria-pressed={abLoop.active}
                aria-label="Toggle A-B Loop range (Shortcut: B)"
                title="Cycle A-B Loop: Set In (A) → Set Out (B) → Clear (B)"
                onClick={cycleAbLoop}
              >
                <LoopBracketIcon />
                <span className="cueframe-tabular cueframe-hide-tablet" style={{ fontSize: '10px' }}>
                  {abLoop.active ? 'A–B ON' : abLoop.inPoint !== null ? 'SET B' : 'A–B'}
                </span>
              </button>

              {/* Captions Toggle (CC) — Always Visible at Every Screen Width Down to 240px */}
              <button
                type="button"
                className="cueframe-btn"
                data-testid="captions-toggle-btn"
                data-active={captionsEnabled}
                aria-pressed={captionsEnabled}
                aria-label={captionsEnabled ? 'Disable captions (Shortcut: C)' : 'Enable captions (Shortcut: C)'}
                title={captionsEnabled ? 'Captions ON (Click or press C to turn off)' : 'Captions OFF (Click or press C to turn on)'}
                onClick={toggleCaptions}
              >
                <CaptionsIcon />
                <span className="cueframe-tabular cueframe-hide-tablet" style={{ fontSize: '10px' }}>
                  {captionsEnabled ? 'CC ON' : 'CC OFF'}
                </span>
              </button>

              {/* Speed & Quick-Tools Console Sheet Trigger — Always Visible at Every Screen Width Down to 240px */}
              <button
                type="button"
                className="cueframe-btn cueframe-tabular"
                data-testid="playback-rate-btn"
                data-active={isSettingsOpen || playbackRate !== 1 || abLoop.inPoint !== null}
                aria-label={`Playback speed ${playbackRate}x and console tools menu`}
                aria-expanded={isSettingsOpen}
                title="Open Speed, Frame-Step, A-B Loop, Volume & Timecode Console Tools"
                onClick={() => setIsSettingsOpen((o) => !o)}
              >
                <span>{playbackRate}×</span>
                <span style={{ fontSize: '10px', opacity: 0.7 }}>⚙</span>
              </button>

              {/* Fullscreen Toggle — Always Visible at Every Screen Width Down to 240px */}
              <button
                type="button"
                className="cueframe-btn"
                data-testid="fullscreen-toggle-btn"
                aria-label={storeIsFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                onClick={toggleFullscreen}
              >
                {storeIsFullscreen ? <FullscreenExitIcon /> : <FullscreenEnterIcon />}
              </button>
            </div>

            {/* Unified Quick-Tools & Settings Console Sheet (Guarantees 100% Feature Parity on Small Screens) */}
            {isSettingsOpen && (
              <div
                className="cueframe-plate cueframe-tabular cueframe-settings-sheet"
                role="dialog"
                aria-label="Console tools and playback settings"
                data-testid="settings-popover"
              >
                {/* Section 1: Playback Speed */}
                <div className="cueframe-sheet-section">
                  <div className="cueframe-sheet-label">
                    <span>PLAYBACK SPEED</span>
                    <button
                      type="button"
                      className="cueframe-btn"
                      aria-label="Close console tools menu"
                      onClick={() => setIsSettingsOpen(false)}
                      style={{ height: '20px', minWidth: '20px', padding: '0 4px', fontSize: '11px' }}
                    >
                      ×
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {(playbackRateOptions?.options?.length
                      ? playbackRateOptions.options.map((o) => Number(o.value))
                      : speeds
                    ).map((s) => (
                      <button
                        key={s}
                        type="button"
                        className="cueframe-btn"
                        data-active={playbackRate === s}
                        aria-pressed={playbackRate === s}
                        onClick={() => {
                          setSpeed(s);
                          setIsSettingsOpen(false);
                        }}
                        style={{ flex: 1, height: '26px', minWidth: '40px', padding: '0 6px', fontSize: '11px' }}
                      >
                        {s}×
                      </button>
                    ))}
                  </div>
                </div>

                {/* Section 2: Captions & A-B Loop Quick Controls (For Small Screens & Touch) */}
                <div className="cueframe-sheet-section">
                  <span className="cueframe-sheet-label">CAPTIONS & A–B SHOT LOOP</span>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      type="button"
                      className="cueframe-btn"
                      data-testid="sheet-captions-toggle-btn"
                      data-active={captionsEnabled}
                      aria-pressed={captionsEnabled}
                      onClick={toggleCaptions}
                      style={{ flex: 1, height: '28px', fontSize: '11px' }}
                    >
                      <CaptionsIcon />
                      <span>{captionsEnabled ? 'Captions: ON' : 'Captions: OFF'}</span>
                    </button>
                    <button
                      type="button"
                      className="cueframe-btn"
                      data-testid="sheet-ab-loop-btn"
                      data-active={abLoop.inPoint !== null}
                      aria-pressed={abLoop.active}
                      onClick={cycleAbLoop}
                      style={{ flex: 1, height: '28px', fontSize: '11px' }}
                    >
                      <LoopBracketIcon />
                      <span>
                        {abLoop.active
                          ? 'Clear Loop'
                          : abLoop.inPoint !== null
                            ? 'Set Loop B'
                            : 'Set Loop A'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Section 3: Precision Frame Stepping & Shuttle (For Touch / Mobile Screens) */}
                <div className="cueframe-sheet-section">
                  <span className="cueframe-sheet-label">FRAME STEP & SHUTTLE</span>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      type="button"
                      className="cueframe-btn"
                      data-testid="sheet-shuttle-back-btn"
                      onClick={() => seekTo(currentTime - 5)}
                      style={{ flex: 1, height: '26px', fontSize: '10px' }}
                    >
                      −5s (J)
                    </button>
                    <button
                      type="button"
                      className="cueframe-btn"
                      data-testid="sheet-step-back-btn"
                      onClick={() => handleFrameStep(-1)}
                      style={{ flex: 1, height: '26px', fontSize: '10px' }}
                    >
                      −1F (,)
                    </button>
                    <button
                      type="button"
                      className="cueframe-btn"
                      data-testid="sheet-step-forward-btn"
                      onClick={() => handleFrameStep(1)}
                      style={{ flex: 1, height: '26px', fontSize: '10px' }}
                    >
                      +1F (.)
                    </button>
                    <button
                      type="button"
                      className="cueframe-btn"
                      data-testid="sheet-shuttle-forward-btn"
                      onClick={() => seekTo(currentTime + 5)}
                      style={{ flex: 1, height: '26px', fontSize: '10px' }}
                    >
                      +5s (L)
                    </button>
                  </div>
                </div>

                {/* Section 4: Touch Volume Slider & Timecode Format */}
                <div className="cueframe-sheet-section">
                  <div className="cueframe-sheet-label">
                    <span>AUDIO LEVEL ({muted ? 'MUTED' : `${Math.round(volume * 100)}%`})</span>
                    <span>TIMECODE: {timecodeFormat.toUpperCase()}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="range"
                      aria-label="Menu volume level"
                      data-testid="sheet-volume-slider"
                      min={0}
                      max={1}
                      step={0.05}
                      value={muted ? 0 : volume}
                      onChange={(e) => setVolumeLevel(Number(e.target.value))}
                      style={{
                        flex: 1,
                        accentColor: 'var(--media-accent-color)',
                        cursor: 'pointer',
                      }}
                    />
                    <button
                      type="button"
                      className="cueframe-btn"
                      data-testid="sheet-timecode-format-btn"
                      onClick={cycleTimecodeFormat}
                      style={{ height: '24px', minWidth: 'auto', padding: '0 7px', fontSize: '10px' }}
                    >
                      Format: {formattedTime.badge}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </Container>
    </div>
  );
}
