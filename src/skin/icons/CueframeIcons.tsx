import type { SVGProps } from 'react';

/**
 * Precision SVG Icon Set for CUEFRAME.
 * Note: PlayIcon shifts the triangle +0.66 units right inside the 18x18 viewBox
 * for optical centering per Video.js v10 design guidelines.
 */
export function PlayIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M5.16 3.45a.9.9 0 0 1 1.38-.76l8.1 5.05a.9.9 0 0 1 0 1.52l-8.1 5.05a.9.9 0 0 1-1.38-.76V3.45Z" />
    </svg>
  );
}

export function PauseIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true" {...props}>
      <rect x="4.5" y="3" width="3.2" height="12" rx="1" />
      <rect x="10.3" y="3" width="3.2" height="12" rx="1" />
    </svg>
  );
}

export function StepBackIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="14" height="14" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <line x1="4.5" y1="4" x2="4.5" y2="14" />
      <polygon points="13.5,4 7.5,9 13.5,14" fill="currentColor" />
    </svg>
  );
}

export function StepForwardIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="14" height="14" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <line x1="13.5" y1="4" x2="13.5" y2="14" />
      <polygon points="4.5,4 10.5,9 4.5,14" fill="currentColor" />
    </svg>
  );
}

export function VolumeHighIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <polygon points="3,6.5 6.5,6.5 10.5,3.5 10.5,14.5 6.5,11.5 3,11.5" fill="currentColor" />
      <path d="M13 6.5a3.5 3.5 0 0 1 0 5" />
      <path d="M14.8 4.5a6.5 6.5 0 0 1 0 9" />
    </svg>
  );
}

export function VolumeMutedIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <polygon points="3,6.5 6.5,6.5 10.5,3.5 10.5,14.5 6.5,11.5 3,11.5" fill="currentColor" />
      <line x1="16" y1="6.5" x2="12.5" y2="11.5" />
      <line x1="12.5" y1="6.5" x2="16" y2="11.5" />
    </svg>
  );
}

export function LoopBracketIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="15" height="15" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M6 4H3.5v10H6" />
      <path d="M12 4h2.5v10H12" />
      <circle cx="9" cy="9" r="1.5" fill="currentColor" />
    </svg>
  );
}

export function CuePinIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="14" height="14" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M9 2.5 15.5 9 9 15.5 2.5 9 9 2.5Z" />
      <line x1="9" y1="6.2" x2="9" y2="11.8" />
      <line x1="6.2" y1="9" x2="11.8" y2="9" />
    </svg>
  );
}

export function FrameGuidesIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="15" height="15" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <rect x="2" y="3.5" width="14" height="11" rx="1.5" />
      <line x1="2" y1="6.2" x2="16" y2="6.2" strokeDasharray="2 1.5" />
      <line x1="2" y1="11.8" x2="16" y2="11.8" strokeDasharray="2 1.5" />
      <line x1="9" y1="7.5" x2="9" y2="10.5" />
      <line x1="7.5" y1="9" x2="10.5" y2="9" />
    </svg>
  );
}

export function CaptionsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="15" height="15" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <rect x="2" y="3.5" width="14" height="11" rx="2" />
      <path d="M7.5 7.5a2 2 0 1 0 0 3" />
      <path d="M12.5 7.5a2 2 0 1 0 0 3" />
    </svg>
  );
}

export function FullscreenEnterIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="15" height="15" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <polyline points="6.5 2.5 2.5 2.5 2.5 6.5" />
      <polyline points="11.5 2.5 15.5 2.5 15.5 6.5" />
      <polyline points="15.5 11.5 15.5 15.5 11.5 15.5" />
      <polyline points="6.5 15.5 2.5 15.5 2.5 11.5" />
    </svg>
  );
}

export function FullscreenExitIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="15" height="15" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <polyline points="2.5 6.5 6.5 6.5 6.5 2.5" />
      <polyline points="15.5 6.5 11.5 6.5 11.5 2.5" />
      <polyline points="11.5 15.5 11.5 11.5 15.5 11.5" />
      <polyline points="6.5 15.5 6.5 11.5 2.5 11.5" />
    </svg>
  );
}

export function DrawerIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="15" height="15" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <rect x="2" y="3" width="14" height="12" rx="2" />
      <line x1="11" y1="3" x2="11" y2="15" />
    </svg>
  );
}
