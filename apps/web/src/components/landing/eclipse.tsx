import { cn } from "@/lib/cn";

type EclipseProps = {
  className?: string;
  /** Unique per instance — scopes SVG defs ids. */
  id: string;
};

/**
 * The hero object: the Relunar mark's two-circle geometry at planetary
 * scale. A copper-lit disc, occluded by an offset dark disc — an eclipse
 * in progress, leaving a burning terminator arc.
 */
export function Eclipse({ className, id }: EclipseProps) {
  const litId = `eclipse-lit-${id}`;
  const maskId = `eclipse-mask-${id}`;
  const glowId = `eclipse-glow-${id}`;

  return (
    <svg
      viewBox="0 0 1000 1000"
      aria-hidden
      className={cn("block", className)}
      fill="none"
    >
      <defs>
        <radialGradient id={litId} cx="30%" cy="38%" r="85%">
          <stop offset="0%" stopColor="oklch(0.88 0.11 75)" />
          <stop offset="45%" stopColor="oklch(0.77 0.14 62)" />
          <stop offset="100%" stopColor="oklch(0.5 0.12 45)" />
        </radialGradient>
        <radialGradient id={glowId} cx="50%" cy="50%" r="50%">
          <stop offset="66%" stopColor="oklch(0.768 0.135 62 / 0)" />
          <stop offset="76%" stopColor="oklch(0.768 0.135 62 / 0.1)" />
          <stop offset="82%" stopColor="oklch(0.768 0.135 62 / 0.07)" />
          <stop offset="100%" stopColor="oklch(0.768 0.135 62 / 0)" />
        </radialGradient>
        <mask id={maskId}>
          <rect width="1000" height="1000" fill="white" />
          {/* Occluding disc: shifted toward the lower right, like the logo mark. */}
          <circle cx="548" cy="536" r="356" fill="black" />
        </mask>
      </defs>

      {/* Atmosphere */}
      <circle cx="500" cy="500" r="500" fill={`url(#${glowId})`} />
      {/* The crescent */}
      <circle cx="500" cy="500" r="370" fill={`url(#${litId})`} mask={`url(#${maskId})`} />
      {/* Faint edge of the occluded disc — the dark side, barely there */}
      <circle cx="548" cy="536" r="356" stroke="oklch(0.934 0.012 255 / 0.05)" strokeWidth="1" />
    </svg>
  );
}
