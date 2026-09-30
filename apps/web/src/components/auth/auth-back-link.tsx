"use client";

import Link from "@/compat/next-link";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";

export function AuthBackLink({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/"
      className={`inline-flex min-h-10 items-center gap-1.5 text-sm text-[var(--color-muted)] transition-colors duration-[var(--dur-micro)] ease-[var(--ease-out)] hover:text-[var(--color-ink)] focus-visible:rounded-[var(--radius-input)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] focus-visible:ring-offset-2 ${className}`}
    >
      <ArrowLeftIcon className="size-3.5 shrink-0" aria-hidden />
      Back to home
    </Link>
  );
}
