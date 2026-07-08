import Image from "next/image";
import { cn } from "@/lib/cn";

type LogoMarkProps = {
  className?: string;
  variant?: "auto" | "black" | "white";
};

const logoSources = {
  black: "/brand/relunar-blackfill.svg",
  white: "/brand/relunar-whitefill.svg",
} as const;

export function LogoMark({ className, variant = "auto" }: LogoMarkProps) {
  if (variant !== "auto") {
    return (
      <Image
        src={logoSources[variant]}
        width={1080}
        height={1080}
        alt=""
        aria-hidden
        className={cn("block shrink-0", className)}
        draggable={false}
        unoptimized
      />
    );
  }

  return (
    <span className={cn("relative block shrink-0", className)} aria-hidden>
      <Image
        src={logoSources.black}
        width={1080}
        height={1080}
        alt=""
        className="block size-full dark:hidden"
        draggable={false}
        unoptimized
      />
      <Image
        src={logoSources.white}
        width={1080}
        height={1080}
        alt=""
        className="hidden size-full dark:block"
        draggable={false}
        unoptimized
      />
    </span>
  );
}
