import { useEffect, useState } from 'react';

export interface AudioMeterReading {
  /** Left channel level normalized 0..1 */
  left: number;
  /** Right channel level normalized 0..1 */
  right: number;
  /** Approx peak in dBFS (-60 to 0) */
  peakDb: number;
  /** Status of the Web Audio connection */
  status: 'idle' | 'active' | 'cors-restricted' | 'unsupported' | 'disabled';
}

interface MediaAudioGraph {
  context: AudioContext;
  analyserLeft: AnalyserNode;
  analyserRight: AnalyserNode;
}

/**
 * Module-level WeakMap ensures we NEVER call createMediaElementSource() more than once
 * on the same HTMLMediaElement instance (which would throw an InvalidStateError in browsers).
 */
const mediaGraphRegistry = new WeakMap<HTMLMediaElement, MediaAudioGraph>();

/**
 * Check whether a media element is safe for Web Audio API inspection without risking CORS audio muting.
 */
function isCorsSafeMedia(media: HTMLMediaElement): boolean {
  const src = media.currentSrc || media.src || '';
  if (!src) return false;
  if (src.startsWith('blob:') || src.startsWith('data:')) return true;

  try {
    const resolved = new URL(src, window.location.href);
    if (resolved.origin === window.location.origin) {
      return true;
    }
    // Cross-origin media MUST have crossOrigin explicitly set on the element before load
    return Boolean(media.crossOrigin && media.crossOrigin !== '');
  } catch {
    return false;
  }
}

/**
 * Progressive-enhancement hook for stereo audio level monitoring.
 * Guarantees playback is never silenced or interrupted if Web Audio is unsupported or CORS-restricted.
 */
export function useWebAudioMeter(
  mediaElement: HTMLMediaElement | null,
  options: { enabled: boolean; paused: boolean; muted: boolean; reducedMotion: boolean }
): AudioMeterReading {
  const { enabled, paused, muted, reducedMotion } = options;
  const [reading, setReading] = useState<AudioMeterReading>({
    left: 0,
    right: 0,
    peakDb: -60,
    status: enabled ? 'idle' : 'disabled',
  });

  useEffect(() => {
    if (!enabled) {
      setReading({ left: 0, right: 0, peakDb: -60, status: 'disabled' });
      return;
    }

    if (!mediaElement || typeof window === 'undefined') {
      setReading({ left: 0, right: 0, peakDb: -60, status: 'idle' });
      return;
    }

    const AudioCtx =
      window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (!AudioCtx) {
      setReading({ left: 0, right: 0, peakDb: -60, status: 'unsupported' });
      return;
    }

    if (!isCorsSafeMedia(mediaElement)) {
      setReading({ left: 0, right: 0, peakDb: -60, status: 'cors-restricted' });
      return;
    }

    if (paused || muted) {
      setReading((prev) => ({
        left: 0,
        right: 0,
        peakDb: -60,
        status: prev.status === 'active' ? 'active' : 'idle',
      }));
      return;
    }

    let graph = mediaGraphRegistry.get(mediaElement);
    if (!graph) {
      try {
        const context = new AudioCtx();
        const source = context.createMediaElementSource(mediaElement);
        const splitter = context.createChannelSplitter(2);
        const analyserLeft = context.createAnalyser();
        const analyserRight = context.createAnalyser();
        analyserLeft.fftSize = 256;
        analyserRight.fftSize = 256;
        analyserLeft.smoothingTimeConstant = 0.65;
        analyserRight.smoothingTimeConstant = 0.65;

        source.connect(splitter);
        splitter.connect(analyserLeft, 0);
        splitter.connect(analyserRight, 1);
        // Always connect source directly to destination so audio output is preserved
        source.connect(context.destination);

        graph = { context, analyserLeft, analyserRight };
        mediaGraphRegistry.set(mediaElement, graph);
      } catch {
        setReading({ left: 0, right: 0, peakDb: -60, status: 'unsupported' });
        return;
      }
    }

    if (graph.context.state === 'suspended') {
      graph.context.resume().catch(() => {
        /* User gesture not yet satisfied */
      });
    }

    const leftBuffer = new Uint8Array(graph.analyserLeft.frequencyBinCount);
    const rightBuffer = new Uint8Array(graph.analyserRight.frequencyBinCount);
    let rafId = 0;
    let lastUpdate = 0;
    const minIntervalMs = reducedMotion ? 250 : 50;

    const sampleLoop = (timestamp: number) => {
      if (!graph) return;
      if (timestamp - lastUpdate >= minIntervalMs) {
        lastUpdate = timestamp;
        graph.analyserLeft.getByteTimeDomainData(leftBuffer);
        graph.analyserRight.getByteTimeDomainData(rightBuffer);

        let sumSqLeft = 0;
        let sumSqRight = 0;
        for (let i = 0; i < leftBuffer.length; i++) {
          const normL = (leftBuffer[i] - 128) / 128;
          const normR = (rightBuffer[i] - 128) / 128;
          sumSqLeft += normL * normL;
          sumSqRight += normR * normR;
        }

        const rmsLeft = Math.sqrt(sumSqLeft / leftBuffer.length);
        const rmsRight = Math.sqrt(sumSqRight / rightBuffer.length);
        // Scale RMS for visual meter legibility
        const levelL = Math.min(1, rmsLeft * 2.6);
        const levelR = Math.min(1, rmsRight * 2.6);
        const maxRms = Math.max(rmsLeft, rmsRight, 1e-4);
        const db = Math.max(-60, Math.min(0, 20 * Math.log10(maxRms * 1.8)));

        setReading({
          left: Number(levelL.toFixed(2)),
          right: Number(levelR.toFixed(2)),
          peakDb: Math.round(db),
          status: 'active',
        });
      }
      rafId = window.requestAnimationFrame(sampleLoop);
    };

    rafId = window.requestAnimationFrame(sampleLoop);
    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [enabled, mediaElement, paused, muted, reducedMotion]);

  return reading;
}
