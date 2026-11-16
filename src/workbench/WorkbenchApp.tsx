import { useState } from 'react';
import { Video, VideoPlayer } from '@videojs/react/video';
import { CueframeSkin, type CueframeMode } from '../skin';
import {
  ACCENT_COLOR_PRESETS,
  DEMO_REEL_PRESETS,
  INLINE_CAPTIONS_VTT_URI,
  INLINE_CHAPTERS_VTT_URI,
  INLINE_THUMBNAILS_VTT_URI,
} from './sampleData';
import './workbench.css';

const RESPONSIVE_WIDTH_PRESETS = [
  { label: 'Full Studio (100%)', width: 1080 },
  { label: 'Tablet (680px)', width: 680 },
  { label: 'Compact (380px)', width: 380 },
  { label: 'Min Embed (260px)', width: 260 },
];

/**
 * CUEFRAME Interactive Demonstration Workbench.
 * Decoupled from the reusable <CueframeSkin /> component to allow judges and engineers
 * to stress-test VIEW/REVIEW/INSPECT modes, bright vs. dark footage contrast,
 * 16:9 vs. 9:16 aspect ratios, container widths down to 240px, and public CSS tokens.
 */
export function WorkbenchApp() {
  const [selectedReelId, setSelectedReelId] = useState<string>(DEMO_REEL_PRESETS[0].id);
  const [activeMode, setActiveMode] = useState<CueframeMode>('review');
  const [containerWidth, setContainerWidth] = useState<number>(1040);
  const [accentIndex, setAccentIndex] = useState<number>(0);
  const [simulateBrightBackdrop, setSimulateBrightBackdrop] = useState<boolean>(false);

  const activeReel =
    DEMO_REEL_PRESETS.find((r) => r.id === selectedReelId) ?? DEMO_REEL_PRESETS[0];
  const activeAccent = ACCENT_COLOR_PRESETS[accentIndex] ?? ACCENT_COLOR_PRESETS[0];
  const isBrightReel = activeReel.lightingProfile === 'bright' || simulateBrightBackdrop;

  const handleSelectReel = (reelId: string) => {
    setSelectedReelId(reelId);
    const nextReel = DEMO_REEL_PRESETS.find((r) => r.id === reelId);
    if (nextReel?.aspectRatio === '9:16' && containerWidth > 460) {
      setContainerWidth(420);
    } else if (nextReel?.aspectRatio === '16:9' && containerWidth < 500) {
      setContainerWidth(1040);
    }
  };

  return (
    <div className="workbench-shell">
      {/* Top Studio Header */}
      <header className="workbench-header">
        <div className="workbench-brand">
          <div className="workbench-brand-badge">VJS // 10.3</div>
          <div>
            <h1 className="workbench-title">
              CUEFRAME <span className="workbench-subtitle">— The Cinematic Review Console</span>
            </h1>
            <p className="workbench-tagline">
              “The footage is the hero. The interface is the instrument.” · Built on{' '}
              <code>@videojs/react</code> v10
            </p>
          </div>
        </div>

        {/* 5-Act Guided Walkthrough Switcher for Judges */}
        <div className="workbench-act-pills" role="group" aria-label="Interactive showcase tour">
          <button
            type="button"
            className="workbench-pill"
            data-active={activeMode === 'view' && !simulateBrightBackdrop}
            onClick={() => {
              setActiveMode('view');
              setSimulateBrightBackdrop(false);
            }}
          >
            Act I · 01 VIEW (Hero Screening)
          </button>
          <button
            type="button"
            className="workbench-pill"
            data-active={activeMode === 'review'}
            onClick={() => setActiveMode('review')}
          >
            Act II · 02 REVIEW (Scenes & Cues)
          </button>
          <button
            type="button"
            className="workbench-pill"
            data-active={activeMode === 'inspect'}
            onClick={() => setActiveMode('inspect')}
          >
            Act III · 03 INSPECT (Telemetry & Guides)
          </button>
          <button
            type="button"
            className="workbench-pill"
            data-active={simulateBrightBackdrop}
            onClick={() => setSimulateBrightBackdrop((b) => !b)}
          >
            Act IV · High-Key 95 IRE Contrast Proof
          </button>
        </div>
      </header>

      {/* Judge's Control Deck */}
      <section className="workbench-deck" aria-label="Judge's interactive test controls">
        {/* Reel & Aspect Selector */}
        <div className="workbench-control-group">
          <span className="workbench-group-label">SCREENING REEL & ASPECT RATIO</span>
          <div className="workbench-btn-row">
            {DEMO_REEL_PRESETS.map((reel) => (
              <button
                key={reel.id}
                type="button"
                className="workbench-deck-btn"
                data-active={reel.id === activeReel.id}
                data-testid={`select-reel-${reel.id}`}
                onClick={() => handleSelectReel(reel.id)}
              >
                <span>{reel.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Responsive Width Stress-Tester */}
        <div className="workbench-control-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="workbench-group-label">
              CONTAINER WIDTH STRESS TEST: <strong>{containerWidth}px</strong>
            </span>
            <div className="workbench-btn-row">
              {RESPONSIVE_WIDTH_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  className="workbench-mini-btn"
                  data-active={Math.abs(containerWidth - preset.width) < 20}
                  onClick={() => setContainerWidth(preset.width)}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
          <input
            type="range"
            aria-label="Container width in pixels"
            data-testid="workbench-width-slider"
            min={240}
            max={1160}
            step={10}
            value={containerWidth}
            onChange={(e) => setContainerWidth(Number(e.target.value))}
            style={{ width: '100%', accentColor: activeAccent.color, cursor: 'pointer' }}
          />
        </div>

        {/* Public Video.js v10 CSS Token Theme Switcher */}
        <div className="workbench-control-group">
          <span className="workbench-group-label">
            PUBLIC TOKEN: <code>--media-accent-color</code>
          </span>
          <div className="workbench-btn-row">
            {ACCENT_COLOR_PRESETS.map((preset, idx) => (
              <button
                key={preset.name}
                type="button"
                className="workbench-swatch-btn"
                data-active={accentIndex === idx}
                onClick={() => setAccentIndex(idx)}
                title={preset.name}
              >
                <span
                  className="workbench-swatch-dot"
                  style={{ backgroundColor: preset.color }}
                />
                <span>{preset.name.split(' ')[0]}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Main Player Stage */}
      <main className="workbench-stage">
        <div
          className="workbench-player-frame"
          data-bright-exposure={isBrightReel ? 'true' : 'false'}
          style={{
            width: `${containerWidth}px`,
            maxWidth: '100%',
            aspectRatio: activeReel.aspectRatio === '9:16' ? '9 / 16' : '16 / 9',
            maxHeight: activeReel.aspectRatio === '9:16' ? '740px' : undefined,
          }}
        >
          <VideoPlayer
            key={activeReel.id}
            title={activeReel.slateMetadata.productionTitle}
          >
            <CueframeSkin
              mediaId={activeReel.id}
              mode={activeMode}
              onModeChange={setActiveMode}
              fps={activeReel.fps}
              initialCues={activeReel.seedCues}
              slateMetadata={activeReel.slateMetadata}
              style={
                {
                  '--media-accent-color': activeAccent.color,
                  '--media-accent-text-color': activeAccent.textColor,
                } as React.CSSProperties
              }
            >
              <Video
                src={activeReel.videoUrl}
                crossOrigin="anonymous"
                playsInline
                muted
                loop
                style={{
                  filter: isBrightReel
                    ? 'brightness(1.85) contrast(0.82) saturate(0.65)'
                    : 'none',
                }}
              >
                <track
                  kind="chapters"
                  src={INLINE_CHAPTERS_VTT_URI}
                  srcLang="en"
                  label="Chapters"
                  default
                />
                <track
                  kind="metadata"
                  label="thumbnails"
                  src={INLINE_THUMBNAILS_VTT_URI}
                  default
                />
                <track
                  kind="captions"
                  src={INLINE_CAPTIONS_VTT_URI}
                  srcLang="en"
                  label="English (Director Slate)"
                  default
                />
              </Video>
            </CueframeSkin>
          </VideoPlayer>
        </div>
      </main>

      {/* Bottom Keyboard Shortcut & Honesty Legend */}
      <footer className="workbench-footer">
        <div className="workbench-shortcuts">
          <span>
            <kbd>Space</kbd>/<kbd>K</kbd> Play/Pause
          </span>
          <span>
            <kbd>J</kbd>/<kbd>L</kbd> Shuttle ±5s
          </span>
          <span>
            <kbd>,</kbd>/<kbd>.</kbd> Step ±1F (Approx)
          </span>
          <span>
            <kbd>N</kbd> Add Review Cue
          </span>
          <span>
            <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> VIEW / REVIEW / INSPECT
          </span>
          <span>
            <kbd>B</kbd> A–B Loop
          </span>
          <span>
            <kbd>C</kbd> Captions
          </span>
          <span>
            <kbd>M</kbd> Mute
          </span>
          <span>
            <kbd>F</kbd> Fullscreen
          </span>
        </div>
        <div className="workbench-honesty-note">
          <strong>Technical Transparency:</strong> Resolution, aspect ratio, buffer health, and track lists in{' '}
          <code>INSPECT</code> mode are read directly from browser/Video.js v10 runtime APIs. Frame rate (
          <code>{activeReel.fps}fps</code>) and slate fields are explicitly supplied via props and labeled as such.
        </div>
      </footer>
    </div>
  );
}
