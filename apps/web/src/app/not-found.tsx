import Link from "next/link";
import { Button } from "@/components/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 py-24 text-center">
      <p className="eyebrow">404</p>
      <h1 className="display-serif mt-4 text-5xl tracking-[-0.03em] text-foreground">Page not found</h1>
      <p className="mt-4 max-w-md text-foreground-muted">
        The page you are looking for does not exist or may have moved.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button href="/">Back home</Button>
        <Button href="/docs" variant="secondary">
          Read the docs
        </Button>
      </div>
      <Link href="/docs/getting-started" className="mt-6 text-sm text-accent underline underline-offset-4">
        Getting started guide
      </Link>
    </div>
  );
}
