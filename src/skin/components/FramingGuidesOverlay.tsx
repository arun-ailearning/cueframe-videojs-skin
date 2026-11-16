import type { AspectGuidePreset, FramingGuideConfig } from '../types';

interface FramingGuidesOverlayProps {
  config: FramingGuideConfig;
}

const ASPECT_RATIO_VALUES: Record<Exclude<AspectGuidePreset, 'off'>, number> = {
  '2.39:1': 2.39,
  '1.85:1': 1.85,
  '16:9': 16 / 9,
  '9:16': 9 / 16,
  '4:3': 4 / 3,
};

/**
 * Non-interactive SVG framing guide and aspect-ratio mask overlay for Cinematographers (MODE 03 — INSPECT).
 * Renders inside <Container> with pointer-events: none and aria-hidden="true".
 */
export function FramingGuidesOverlay({ config }: FramingGuidesOverlayProps) {
  const { aspectMask, ruleOfThirds, centerCrosshair, safeActionTitle } = config;
  const hasAnyGuide = aspectMask !== 'off' || ruleOfThirds || centerCrosshair || safeActionTitle;

  if (!hasAnyGuide) {
    return null;
  }

  // Compute letterbox or pillarbox percentages relative to a standard 16:9 (1.7778) viewport frame
  const baseRatio = 16 / 9;
  let letterboxBarPercent = 0;
  let pillarboxBarPercent = 0;

  if (aspectMask !== 'off') {
    const targetRatio = ASPECT_RATIO_VALUES[aspectMask];
    if (targetRatio > baseRatio) {
      // Wider than 16:9 (e.g., 2.39:1, 1.85:1) -> top/bottom letterbox bars
      const activeHeightPct = (baseRatio / targetRatio) * 100;
      letterboxBarPercent = Math.max(0, (100 - activeHeightPct) / 2);
    } else if (targetRatio < baseRatio) {
      // Narrower than 16:9 (e.g., 9:16, 4:3) -> left/right pillarbox bars
      const activeWidthPct = (targetRatio / baseRatio) * 100;
      pillarboxBarPercent = Math.max(0, (100 - activeWidthPct) / 2);
    }
  }

  return (
    <div
      className="cueframe-framing-guides"
      aria-hidden="true"
      data-testid="framing-guides-overlay"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 12,
        overflow: 'hidden',
      }}
    >
      {/* Aspect Ratio Matte Bars & Hairline Frame */}
      {aspectMask !== 'off' && (
        <>
          {letterboxBarPercent > 0 && (
            <>
              <div
                data-testid="letterbox-top"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: `${letterboxBarPercent.toFixed(2)}%`,
                  background: 'rgba(0, 0, 0, 0.62)',
                  borderBottom: '1px solid rgba(229, 169, 60, 0.75)',
                }}
              />
              <div
                data-testid="letterbox-bottom"
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: `${letterboxBarPercent.toFixed(2)}%`,
                  background: 'rgba(0, 0, 0, 0.62)',
                  borderTop: '1px solid rgba(229, 169, 60, 0.75)',
                }}
              />
            </>
          )}
          {pillarboxBarPercent > 0 && (
            <>
              <div
                data-testid="pillarbox-left"
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: 0,
                  width: `${pillarboxBarPercent.toFixed(2)}%`,
                  background: 'rgba(0, 0, 0, 0.62)',
                  borderRight: '1px solid rgba(229, 169, 60, 0.75)',
                }}
              />
              <div
                data-testid="pillarbox-right"
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  right: 0,
                  width: `${pillarboxBarPercent.toFixed(2)}%`,
                  background: 'rgba(0, 0, 0, 0.62)',
                  borderLeft: '1px solid rgba(229, 169, 60, 0.75)',
                }}
              />
            </>
          )}
          <span
            className="cueframe-tabular"
            style={{
              position: 'absolute',
              top: `calc(${letterboxBarPercent.toFixed(2)}% + 6px)`,
              right: `calc(${pillarboxBarPercent.toFixed(2)}% + 8px)`,
              fontSize: '10px',
              padding: '1px 5px',
              background: 'rgba(9, 9, 11, 0.78)',
              color: '#e5a93c',
              border: '1px solid rgba(229, 169, 60, 0.45)',
              borderRadius: '3px',
            }}
          >
            GUIDE {aspectMask}
          </span>
        </>
      )}

      {/* Rule of Thirds Grid */}
      {ruleOfThirds && (
        <svg
          data-testid="guide-rule-of-thirds"
          width="100%"
          height="100%"
          viewBox="0 0 300 300"
          preserveAspectRatio="none"
          style={{ position: 'absolute', inset: 0 }}
        >
          <line x1="100" y1="0" x2="100" y2="300" stroke="rgba(255, 255, 255, 0.28)" strokeWidth="1" strokeDasharray="4 4" />
          <line x1="200" y1="0" x2="200" y2="300" stroke="rgba(255, 255, 255, 0.28)" strokeWidth="1" strokeDasharray="4 4" />
          <line x1="0" y1="100" x2="300" y2="100" stroke="rgba(255, 255, 255, 0.28)" strokeWidth="1" strokeDasharray="4 4" />
          <line x1="0" y1="200" x2="300" y2="200" stroke="rgba(255, 255, 255, 0.28)" strokeWidth="1" strokeDasharray="4 4" />
        </svg>
      )}

      {/* SMPTE 90% Action Safe & 80% Title Safe Bounds */}
      {safeActionTitle && (
        <>
          <div
            data-testid="guide-safe-action"
            style={{
              position: 'absolute',
              inset: '5%',
              border: '1px dashed rgba(56, 189, 248, 0.45)',
            }}
          />
          <div
            data-testid="guide-safe-title"
            style={{
              position: 'absolute',
              inset: '10%',
              border: '1px dotted rgba(56, 189, 248, 0.35)',
            }}
          />
        </>
      )}

      {/* Center Reticle Crosshair */}
      {centerCrosshair && (
        <svg
          data-testid="guide-center-crosshair"
          width="36"
          height="36"
          viewBox="0 0 36 36"
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
          }}
        >
          <circle cx="18" cy="18" r="8" fill="none" stroke="rgba(229, 169, 60, 0.7)" strokeWidth="1" />
          <line x1="18" y1="4" x2="18" y2="13" stroke="rgba(229, 169, 60, 0.85)" strokeWidth="1.2" />
          <line x1="18" y1="23" x2="18" y2="32" stroke="rgba(229, 169, 60, 0.85)" strokeWidth="1.2" />
          <line x1="4" y1="18" x2="13" y2="18" stroke="rgba(229, 169, 60, 0.85)" strokeWidth="1.2" />
          <line x1="23" y1="18" x2="32" y2="18" stroke="rgba(229, 169, 60, 0.85)" strokeWidth="1.2" />
        </svg>
      )}
    </div>
  );
}
