import type { AspectGuidePreset, FramingGuideConfig, SuppliedSlateMetadata } from '../types';
import type { AudioMeterReading } from '../hooks/useWebAudioMeter';

export interface RuntimeStreamTelemetry {
  videoWidth: number;
  videoHeight: number;
  playbackRate: number;
  bufferedSeconds: number;
  duration: number;
  activeQualityLabel: string;
  availableQualitiesCount: number;
  audioTracks: { id: string; label: string; language: string; enabled: boolean }[];
  captionTracks: { id: string; label: string; language: string; showing: boolean }[];
  streamSource: string;
}

interface InspectTelemetryPanelProps {
  telemetry: RuntimeStreamTelemetry;
  fps?: number;
  slateMetadata?: SuppliedSlateMetadata;
  framingGuides: FramingGuideConfig;
  onUpdateGuides: (next: FramingGuideConfig) => void;
  audioMeter: AudioMeterReading;
}

/**
 * Greatest common divisor helper to compute readable aspect ratios (e.g. 16:9, 9:16).
 */
function formatAspectRatio(width: number, height: number): string {
  if (!width || !height || width <= 0 || height <= 0) {
    return 'Unavailable (awaiting metadata)';
  }
  const ratio = width / height;
  if (Math.abs(ratio - 16 / 9) < 0.03) return `16:9 (${ratio.toFixed(2)}:1)`;
  if (Math.abs(ratio - 9 / 16) < 0.03) return `9:16 (${ratio.toFixed(2)}:1)`;
  if (Math.abs(ratio - 2.39) < 0.04) return `2.39:1 Scope`;
  if (Math.abs(ratio - 1.85) < 0.04) return `1.85:1 Flat`;
  if (Math.abs(ratio - 4 / 3) < 0.03) return `4:3 (${ratio.toFixed(2)}:1)`;

  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const divisor = gcd(Math.round(width), Math.round(height));
  return `${Math.round(width / divisor)}:${Math.round(height / divisor)} (${ratio.toFixed(2)}:1)`;
}

const ASPECT_PRESETS: AspectGuidePreset[] = ['off', '2.39:1', '1.85:1', '16:9', '9:16', '4:3'];

/**
 * MODE 03 — INSPECT Telemetry & Framing Console.
 * Strictly separates browser-exposed runtime media data from explicitly supplied slate metadata.
 * Never fabricates camera-original lens/ISO/shutter/color-space data.
 */
export function InspectTelemetryPanel({
  telemetry,
  fps,
  slateMetadata,
  framingGuides,
  onUpdateGuides,
  audioMeter,
}: InspectTelemetryPanelProps) {
  const hasResolution = telemetry.videoWidth > 0 && telemetry.videoHeight > 0;
  const resolutionLabel = hasResolution
    ? `${telemetry.videoWidth} × ${telemetry.videoHeight} px`
    : 'Unavailable (stream not decoded)';
  const aspectLabel = formatAspectRatio(telemetry.videoWidth, telemetry.videoHeight);

  const effectiveFps = fps ?? slateMetadata?.suppliedFps;
  const fpsDisclosure = effectiveFps
    ? `${effectiveFps} fps (explicitly supplied)`
    : 'Not exposed by HTMLMediaElement';

  return (
    <section
      className="cueframe-plate cueframe-tabular cueframe-inspect-panel"
      aria-label="Technical Media Inspection Panel"
      data-testid="inspect-telemetry-panel"
    >
      {/* Header with provenance badge */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 700, color: '#e5a93c', letterSpacing: '0.06em' }}>
          INSPECT // STREAM TELEMETRY
        </span>
        <span
          style={{
            fontSize: '10px',
            padding: '1px 6px',
            borderRadius: '3px',
            background: 'rgba(56, 189, 248, 0.14)',
            color: '#38bdf8',
            border: '1px solid rgba(56, 189, 248, 0.3)',
          }}
        >
          Browser-Verified
        </span>
      </div>

      {/* Browser-Exposed Runtime Media Properties */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))',
          gap: '4px 10px',
          borderTop: '1px solid #282836',
          paddingTop: '6px',
        }}
      >
        <div>
          <span style={{ color: '#a1a1aa' }}>Decoded Res: </span>
          <strong data-testid="inspect-resolution" style={{ color: '#ffffff' }}>{resolutionLabel}</strong>
        </div>
        <div>
          <span style={{ color: '#a1a1aa' }}>Aspect Ratio: </span>
          <strong data-testid="inspect-aspect" style={{ color: '#ffffff' }}>{aspectLabel}</strong>
        </div>
        <div>
          <span style={{ color: '#a1a1aa' }}>Rendition: </span>
          <strong data-testid="inspect-rendition" style={{ color: '#ffffff' }}>
            {telemetry.activeQualityLabel} ({telemetry.availableQualitiesCount} tiers)
          </strong>
        </div>
        <div>
          <span style={{ color: '#a1a1aa' }}>Buffer Ahead: </span>
          <strong data-testid="inspect-buffer" style={{ color: '#ffffff' }}>{telemetry.bufferedSeconds.toFixed(1)}s</strong>
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <span style={{ color: '#a1a1aa' }}>Frame Rate: </span>
          <strong data-testid="inspect-fps" style={{ color: '#ffffff' }}>{fpsDisclosure}</strong>
        </div>
        <div>
          <span style={{ color: '#a1a1aa' }}>Audio Tracks: </span>
          <strong data-testid="inspect-audio-tracks" style={{ color: '#ffffff' }}>
            {telemetry.audioTracks.length > 0
              ? telemetry.audioTracks.map((t) => t.label || t.language || t.id).join(', ')
              : 'Default Stereo (1)'}
          </strong>
        </div>
        <div>
          <span style={{ color: '#a1a1aa' }}>Caption Tracks: </span>
          <strong data-testid="inspect-caption-tracks" style={{ color: '#ffffff' }}>
            {telemetry.captionTracks.length > 0
              ? telemetry.captionTracks.map((t) => `${t.label}${t.showing ? ' (Active)' : ' (Off)'}`).join(', ')
              : 'None attached'}
          </strong>
        </div>
      </div>

      {/* Audio Level Monitoring Status */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '6px',
          borderTop: '1px solid #282836',
          paddingTop: '6px',
        }}
      >
        <span style={{ color: '#a1a1aa' }}>
          Web Audio Peak ({audioMeter.status === 'active' ? `${audioMeter.peakDb} dBFS` : audioMeter.status}):
        </span>
        <div
          aria-label="Stereo audio peak level bars"
          data-testid="inspect-audio-meter"
          style={{ display: 'flex', alignItems: 'center', gap: '4px', width: '110px' }}
        >
          <span style={{ fontSize: '9px', color: '#a1a1aa' }}>L</span>
          <div style={{ flex: 1, height: '6px', background: '#1a1a24', border: '1px solid #2a2a38', borderRadius: '2px', overflow: 'hidden' }}>
            <div
              style={{
                width: `${Math.round(audioMeter.left * 100)}%`,
                height: '100%',
                background: audioMeter.left > 0.85 ? '#fb7185' : audioMeter.left > 0.6 ? '#e5a93c' : '#4ade80',
              }}
            />
          </div>
          <span style={{ fontSize: '9px', color: '#a1a1aa' }}>R</span>
          <div style={{ flex: 1, height: '6px', background: '#1a1a24', border: '1px solid #2a2a38', borderRadius: '2px', overflow: 'hidden' }}>
            <div
              style={{
                width: `${Math.round(audioMeter.right * 100)}%`,
                height: '100%',
                background: audioMeter.right > 0.85 ? '#fb7185' : audioMeter.right > 0.6 ? '#e5a93c' : '#4ade80',
              }}
            />
          </div>
        </div>
      </div>

      {/* Optional Supplied Slate Metadata (Clearly Separated from Browser Telemetry) */}
      {slateMetadata && (
        <div
          data-testid="inspect-supplied-metadata"
          style={{
            borderTop: '1px solid #282836',
            paddingTop: '6px',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
            <span style={{ fontSize: '10px', color: '#c4c4cc', fontWeight: 600 }}>
              SLATE METADATA
            </span>
            <span
              style={{
                fontSize: '9px',
                padding: '0 4px',
                borderRadius: '2px',
                background: 'rgba(229, 169, 60, 0.16)',
                color: '#e5a93c',
              }}
            >
              {slateMetadata.sourceLabel === 'demo-sample' ? 'Demo Sample Prop' : 'Explicitly Supplied Prop'}
            </span>
          </div>
          <div style={{ fontSize: '10px', color: '#c4c4cc' }}>
            {slateMetadata.productionTitle && <span>Cut: {slateMetadata.productionTitle} · </span>}
            {slateMetadata.sceneTake && <span>Slate: {slateMetadata.sceneTake} · </span>}
            {slateMetadata.director && <span>Dir: {slateMetadata.director}</span>}
          </div>
        </div>
      )}

      {/* Interactive Cinematographer Framing Guide Controls */}
      <div
        style={{
          borderTop: '1px solid #282836',
          paddingTop: '6px',
          display: 'flex',
          flexDirection: 'column',
          gap: '5px',
        }}
      >
        <span style={{ fontSize: '10px', color: 'var(--cueframe-text-secondary)', fontWeight: 600 }}>
          CINEMATOGRAPHER FRAMING GUIDES
        </span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }} role="group" aria-label="Aspect ratio masks">
          {ASPECT_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              className="cueframe-btn"
              data-active={framingGuides.aspectMask === preset}
              aria-pressed={framingGuides.aspectMask === preset}
              onClick={() => onUpdateGuides({ ...framingGuides, aspectMask: preset })}
              style={{ height: '24px', minWidth: 'auto', padding: '0 6px', fontSize: '10px' }}
            >
              {preset === 'off' ? 'Mask Off' : preset}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }} role="group" aria-label="Composition overlays">
          <button
            type="button"
            className="cueframe-btn"
            data-active={framingGuides.ruleOfThirds}
            aria-pressed={framingGuides.ruleOfThirds}
            onClick={() => onUpdateGuides({ ...framingGuides, ruleOfThirds: !framingGuides.ruleOfThirds })}
            style={{ height: '24px', minWidth: 'auto', padding: '0 7px', fontSize: '10px' }}
          >
            Rule of Thirds
          </button>
          <button
            type="button"
            className="cueframe-btn"
            data-active={framingGuides.centerCrosshair}
            aria-pressed={framingGuides.centerCrosshair}
            onClick={() => onUpdateGuides({ ...framingGuides, centerCrosshair: !framingGuides.centerCrosshair })}
            style={{ height: '24px', minWidth: 'auto', padding: '0 7px', fontSize: '10px' }}
          >
            Center Crosshair
          </button>
          <button
            type="button"
            className="cueframe-btn"
            data-active={framingGuides.safeActionTitle}
            aria-pressed={framingGuides.safeActionTitle}
            onClick={() => onUpdateGuides({ ...framingGuides, safeActionTitle: !framingGuides.safeActionTitle })}
            style={{ height: '24px', minWidth: 'auto', padding: '0 7px', fontSize: '10px' }}
          >
            Safe 90/80%
          </button>
        </div>
      </div>
    </section>
  );
}
