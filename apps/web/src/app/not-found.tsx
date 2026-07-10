import Link from "next/link";
import { Button } from "@/components/button";
import { MoonPhase } from "@/components/moon-phase";

export default function NotFound() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center px-6 py-24 text-center">
      <MoonPhase phase="new" id="not-found" className="size-12 text-accent" />
      <p className="mono-label mt-6 text-foreground-subtle">404 · dark side</p>
      <h1 className="display display-section mt-4">Page not found</h1>
      <p className="mt-5 max-w-md text-foreground-muted">
        The page you are looking for does not exist or may have moved.
      </p>
      <div className="mt-9 flex flex-col gap-3 sm:flex-row">
        <Button href="/">Back home</Button>
        <Button href="/docs" variant="outline">
          Read the docs
        </Button>
      </div>
      <Link
        href="/docs/getting-started"
        className="mono-label mt-8 text-accent-bright underline decoration-accent/40 underline-offset-4 hover:decoration-accent-bright"
      >
        Getting started guide
      </Link>
    </div>
  );
}
