"use client";

import { useId } from "react";
import {
  LOGO_CENTER,
  LOGO_INNER_OFFSET,
  LOGO_INNER_RADIUS,
  LOGO_OUTER_RADIUS,
  LOGO_VIEWBOX,
} from "@/lib/logo-geometry";

export function LogoMark({ className }: { className?: string }) {
  const maskId = useId();

  return (
    <svg viewBox={`0 0 ${LOGO_VIEWBOX} ${LOGO_VIEWBOX}`} aria-hidden className={className} fill="none">
      <defs>
        <mask id={maskId}>
          <rect width={LOGO_VIEWBOX} height={LOGO_VIEWBOX} fill="white" />
          <circle cx={LOGO_CENTER + LOGO_INNER_OFFSET} cy={LOGO_CENTER} r={LOGO_INNER_RADIUS} fill="black" />
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
