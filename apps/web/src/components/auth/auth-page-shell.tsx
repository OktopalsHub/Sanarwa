'use client';

import Link from '@/compat/next-link';
import { SanarwaMark } from '@sanarwa/assets';

interface AuthPageShellProps {
  children: React.ReactNode;
}

export function AuthPageShell({ children }: AuthPageShellProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--color-paper)] px-6 py-8 text-[var(--color-ink-2)]">
      <div className="flex w-full max-w-[400px] flex-col items-center gap-6">
        <Link href="/" className="flex flex-col items-center gap-2 text-[var(--color-ink)]">
          <SanarwaMark className="size-10 text-[var(--hm-accent)]" />
          <span className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-tight">
            Sanarwa
          </span>
        </Link>

        {children}

        <p className="text-center text-xs leading-relaxed text-[var(--color-muted)]">
          By clicking continue, you agree to our{' '}
          <Link href="/terms" className="text-[var(--hm-accent)] underline-offset-2 hover:underline">
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link href="/privacy" className="text-[var(--hm-accent)] underline-offset-2 hover:underline">
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

export function AuthCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full rounded-[var(--radius-card)] border border-[var(--color-rule)] bg-[var(--color-paper-2)] p-8 shadow-sm">
      {children}
    </div>
  );
}

export function AuthDivider({ label = 'Or continue with' }: { label?: string }) {
  return (
    <div className="relative flex items-center py-1">
      <div className="grow border-t border-[var(--color-rule)]" />
      <span className="mx-3 shrink-0 text-xs text-[var(--color-muted)]">{label}</span>
      <div className="grow border-t border-[var(--color-rule)]" />
    </div>
  );
}
