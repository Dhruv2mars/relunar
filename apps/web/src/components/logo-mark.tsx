import { cn } from "@/lib/cn";
import { RELUNAR_LOGO_PATH, RELUNAR_LOGO_TRANSFORM, RELUNAR_LOGO_VIEWBOX } from "@/lib/logo-path";

type LogoMarkProps = {
  className?: string;
  variant?: "auto" | "black" | "white";
};

export function LogoMark({ className, variant = "auto" }: LogoMarkProps) {
  return (
    <svg
      viewBox={RELUNAR_LOGO_VIEWBOX}
      aria-hidden
      className={cn("block shrink-0", variant === "white" && "text-inverse-foreground", className)}
      fill="none"
    >
      <path d={RELUNAR_LOGO_PATH} fill="currentColor" transform={RELUNAR_LOGO_TRANSFORM} />
    </svg>
  );
}
