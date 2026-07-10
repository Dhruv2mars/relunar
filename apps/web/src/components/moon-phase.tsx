import { cn } from "@/lib/cn";

export type MoonPhaseName = "new" | "crescent" | "quarter" | "gibbous" | "full";

type MoonPhaseProps = {
  phase: MoonPhaseName;
  /** Unique per page instance — scopes the SVG mask id. */
  id: string;
  className?: string;
};

const R = 20;
const C = 24;

/**
 * Every glyph is built from the same two-circle geometry as the Relunar
 * logo mark: a disc, occluded by a second offset disc.
 */
export function MoonPhase({ phase, id, className }: MoonPhaseProps) {
  const maskId = `moon-${id}`;

  if (phase === "new") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden className={cn("block shrink-0", className)} fill="none">
        <circle cx={C} cy={C} r={R - 0.75} stroke="currentColor" strokeWidth="1.5" opacity="0.55" />
      </svg>
    );
  }

  if (phase === "full") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden className={cn("block shrink-0", className)} fill="none">
        <circle cx={C} cy={C} r={R} fill="currentColor" />
      </svg>
    );
  }

  const occluder =
    phase === "crescent" ? (
      <circle cx={C + R * 0.44} cy={C} r={R * 0.86} fill="black" />
    ) : phase === "quarter" ? (
      <rect x={C} y={0} width={R + 8} height={48} fill="black" />
    ) : (
      <circle cx={C + R * 1.18} cy={C} r={R * 0.92} fill="black" />
    );

  return (
    <svg viewBox="0 0 48 48" aria-hidden className={cn("block shrink-0", className)} fill="none">
      <defs>
        <mask id={maskId}>
          <rect width="48" height="48" fill="white" />
          {occluder}
        </mask>
      </defs>
      <circle cx={C} cy={C} r={R - 0.75} stroke="currentColor" strokeWidth="1.5" opacity="0.35" />
      <circle cx={C} cy={C} r={R} fill="currentColor" mask={`url(#${maskId})`} />
    </svg>
  );
}
