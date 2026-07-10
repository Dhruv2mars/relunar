import { cn } from "@/lib/cn";
import {
  LOGO_CENTER,
  LOGO_INNER_OFFSET,
  LOGO_INNER_RADIUS,
  LOGO_OUTER_RADIUS,
  LOGO_VIEWBOX,
} from "@/lib/logo-geometry";

type LogoMarkProps = {
  className?: string;
  /** Override when two marks with different geometry tweaks share a page. */
  id?: string;
};

/**
 * The Relunar mark rendered from its source geometry (two circles, one
 * masked by the other) instead of a traced bitmap path — pixel-perfect
 * at every size.
 */
export function LogoMark({ className, id = "relunar-mark" }: LogoMarkProps) {
  const maskId = `logo-${id}`;

  return (
    <svg
      viewBox={`0 0 ${LOGO_VIEWBOX} ${LOGO_VIEWBOX}`}
      aria-hidden
      className={cn("block shrink-0", className)}
      fill="none"
    >
      <defs>
        <mask id={maskId}>
          <rect width={LOGO_VIEWBOX} height={LOGO_VIEWBOX} fill="white" />
          <circle
            cx={LOGO_CENTER + LOGO_INNER_OFFSET}
            cy={LOGO_CENTER}
            r={LOGO_INNER_RADIUS}
            fill="black"
          />
        </mask>
      </defs>
      <circle
        cx={LOGO_CENTER}
        cy={LOGO_CENTER}
        r={LOGO_OUTER_RADIUS}
        fill="currentColor"
        mask={`url(#${maskId})`}
      />
    </svg>
  );
}
