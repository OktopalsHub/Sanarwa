"use client";

import { AuthBackLink } from "@/components/auth/auth-back-link";
import Link from "@/compat/next-link";
import { SanarwaMark } from "@sanarwa/assets";
import { motion } from "framer-motion";

/* Hallmark · macrostructure: Split Panel · tone: utilitarian · page: login */

const LOGIN_POINTS = [
  "Email, SMS, push, WhatsApp, and voice from one API",
  "Delivery tracking and analytics per workspace",
  "Team roles, API keys, and provider failover",
] as const;

interface LoginPageLayoutProps {
  children: React.ReactNode;
}

export function LoginPageLayout({ children }: LoginPageLayoutProps) {
  return (
    <div className="h-dvh overflow-x-clip bg-[var(--color-paper)] text-[var(--color-ink-2)]">
      <div className="mx-auto grid h-full min-w-0 max-w-6xl lg:grid-cols-[minmax(0,1.05fr)_minmax(0,26rem)]">
        <motion.aside initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }} className="relative hidden min-h-0 min-w-0 flex-col justify-between overflow-hidden bg-[var(--color-graphite)] px-10 py-10 text-white lg:flex">
          <motion.div animate={{ backgroundPosition: ["0% 0%", "100% 100%"] }} transition={{ duration: 20, repeat: Infinity, repeatType: "reverse" }} className="pointer-events-none absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "repeating-linear-gradient(-12deg, transparent, transparent 11px, var(--color-rule-2) 11px, var(--color-rule-2) 12px)" }} aria-hidden />
          <motion.div animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 8, repeat: Infinity }} className="pointer-events-none absolute -right-20 -top-20 size-64 rounded-full bg-[var(--hm-accent)]/10 blur-3xl" aria-hidden />
          <Link
            href="/"
            className="relative z-10 inline-flex min-h-10 items-center gap-2.5 rounded-[var(--radius-input)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-graphite)]"
            aria-label="Back to Sanarwa home"
          >
            <SanarwaMark className="size-8 text-[var(--hm-accent)]" />
            <span className="font-[family-name:var(--font-display)] text-base font-semibold tracking-[var(--tracking-display)]">
              Sanarwa
            </span>
          </Link>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.5 }} className="relative z-10 max-w-md space-y-5">
            <h1 className="font-[family-name:var(--font-display)] text-[length:var(--text-3xl)] font-bold leading-[1.12] tracking-[var(--tracking-display)] text-white" style={{ fontStyle: "normal" }}>Welcome back</h1>
            <p className="text-sm leading-relaxed text-white/65">Sign in to your workspace dashboard, messages, and billing.</p>
            <motion.ul initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08 } } }} className="space-y-2.5 border-t border-white/10 pt-5">
              {LOGIN_POINTS.map((point) => (
                <motion.li key={point} variants={{ hidden: { opacity: 0, x: -10 }, show: { opacity: 1, x: 0 } }} className="flex gap-3 text-sm leading-snug text-white/80">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-[var(--hm-accent)]" aria-hidden />
                  {point}
                </motion.li>
              ))}
            </motion.ul>
            <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5 }} whileHover={{ scale: 1.02 }} className="rounded-[var(--radius-card)] border border-white/10 bg-white/[0.04] p-3 backdrop-blur">
              <p className="font-mono text-[10px] uppercase tracking-wide text-white/40">Live API</p>
              <pre className="mt-1 font-mono text-xs leading-relaxed text-white/80">POST /api/v1/notifications{"\n"}→ 202 id: msg_8f2a91c4 • 42ms</pre>
            </motion.div>
          </motion.div>

          <p className="relative z-10 font-mono text-[11px] text-white/40">
            New here?{" "}
            <Link
              href="/register"
              className="text-[var(--hm-accent)] underline-offset-2 hover:underline"
            >
              Create an account
            </Link>
          </p>
        </motion.aside>

        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.2 }} className="flex min-h-0 min-w-0 flex-col overflow-hidden px-6 py-6 sm:px-10 lg:px-12 lg:py-8">
          <div className="mb-4 flex shrink-0 items-center justify-between gap-4 lg:hidden">
            <AuthBackLink />
            <Link
              href="/register"
              className="shrink-0 text-xs text-[var(--color-muted)] underline-offset-2 hover:text-[var(--hm-accent)] hover:underline"
            >
              Sign up
            </Link>
          </div>

          <div className="mx-auto flex w-full min-w-0 max-w-[22rem] flex-1 flex-col justify-center">
            <AuthBackLink className="mb-4 hidden shrink-0 lg:inline-flex" />
            {children}
          </div>

          <p className="mx-auto mt-4 max-w-[22rem] shrink-0 text-center text-[11px] leading-relaxed text-[var(--color-muted)]">
            By continuing, you agree to our <Link href="/terms" className="text-[var(--color-ink)] underline-offset-2 hover:text-[var(--hm-accent)] hover:underline">Terms</Link> and <Link href="/privacy" className="text-[var(--color-ink)] underline-offset-2 hover:text-[var(--hm-accent)] hover:underline">Privacy Policy</Link>.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
