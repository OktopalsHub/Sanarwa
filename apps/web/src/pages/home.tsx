"use client";

import { Send } from "@/lib/icons";
import { motion } from "framer-motion";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "@/compat/next-link";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { SanarwaMark, SanarwaWordmark } from "@sanarwa/assets";
import { formatTokens, WELCOME_SIGNUP_TOKENS } from "@/lib/pricing";
import {
  ArrowRightIcon,
  EnvelopeIcon,
  ChatBubbleLeftRightIcon,
  BellIcon,
  DevicePhoneMobileIcon,
  PhoneIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

const COMMANDS = [
  { label: "Pricing", href: "/pricing", hint: "tokens" },
  { label: "Sign in", href: "/login", hint: "auth" },
  { label: "Start free trial", href: "/register", hint: "signup" },
] as const;

const CHANNELS = [
  { name: "Email", detail: "Transactional email", icon: EnvelopeIcon },
  { name: "SMS", detail: "Global SMS", icon: ChatBubbleLeftRightIcon },
  { name: "WhatsApp", detail: "Business templates", icon: ChatBubbleLeftRightIcon },
  { name: "Push", detail: "Mobile + web", icon: BellIcon },
  { name: "In-app", detail: "Banners & feeds", icon: DevicePhoneMobileIcon },
  { name: "Voice", detail: "TTS alerts", icon: PhoneIcon },
] as const;

type QuickstartLang = "curl" | "typescript" | "python" | "go" | "rust";

const QUICKSTART_SNIPPETS: Record<QuickstartLang, string> = {
  curl: `curl -X POST https://api.sanarwa.dev/api/v1/notifications \\
  -H "Authorization: Bearer $SANARWA_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "channel": "email",
    "from": "PayLink <receipts@paylink.ng>",
    "to": "amaka@halo.ng",
    "subject": "Receipt for ₦45,000",
    "html": "<p>Payment received. Thank you, Amaka.</p>"
  }'`,
  typescript: `import { Sanarwa } from "@sanarwa/sdk";

const sanarwa = new Sanarwa({ apiKey: process.env.SANARWA_KEY! });

await sanarwa.messages.send({
  channel: "email",
  from: "PayLink <receipts@paylink.ng>",
  to: "amaka@halo.ng",
  subject: "Receipt for ₦45,000",
  html: "<p>Payment received. Thank you, Amaka.</p>",
});`,
  python: `from sanarwa import Sanarwa
import os
sanarwa = Sanarwa(api_key=os.environ["SANARWA_KEY"])
sanarwa.messages.send(channel="email", from_="PayLink <receipts@paylink.ng>", to="amaka@halo.ng", subject="Receipt for ₦45,000", html="<p>Payment received. Thank you, Amaka.</p>")`,
  go: `client := sanarwa.New(os.Getenv("SANARWA_KEY"))
client.Messages.Send(sanarwa.SendParams{Channel:"email", From:"PayLink <receipts@paylink.ng>", To:"amaka@halo.ng", Subject:"Receipt for ₦45,000", HTML:"<p>Payment received. Thank you, Amaka.</p>"})`,
  rust: `let client = Client::new(std::env::var("SANARWA_KEY")?);
client.messages().send(SendRequest{ channel:"email", from:"PayLink <receipts@paylink.ng>", to:"amaka@halo.ng", subject:"Receipt for ₦45,000", html:"<p>Payment received. Thank you, Amaka.</p>" }).await?;`,
};

const QUICKSTART_TABS: { id: QuickstartLang; label: string }[] = [
  { id: "curl", label: "cURL" },
  { id: "typescript", label: "TypeScript" },
  { id: "python", label: "Python" },
  { id: "go", label: "Go" },
  { id: "rust", label: "Rust" },
];

const DEFAULT_TEMPLATE_SOURCE = `Subject: Receipt for {{amount}}

Hi {{customer_name}},

Your payment of {{amount}} is confirmed.
Order {{order_id}} is on its way.

— PayLink`;

const DEFAULT_TEMPLATE_VARS: Record<string, string> = {
  customer_name: "Amaka",
  amount: "₦45,000",
  order_id: "ORD-2841",
};

function renderTemplate(source: string, vars: Record<string, string>): string {
  return source.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => vars[key] ?? `{{${key}}}`);
}

function extractTemplateVars(source: string): string[] {
  const keys = new Set<string>();
  for (const match of source.matchAll(/\{\{\s*(\w+)\s*\}\}/g)) {
    if (match[1]) keys.add(match[1]);
  }
  return [...keys];
}

function SdkSnippetPlayground({ variant = "section" }: { variant?: "hero" | "section" }) {
  const [lang, setLang] = useState<QuickstartLang>("typescript");
  const [copied, setCopied] = useState(false);
  const snippet = QUICKSTART_SNIPPETS[lang];
  const isHero = variant === "hero";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  };

  return (
    <div
      className={
        isHero
          ? "reveal code-card w-full flex-1 basis-0 overflow-hidden"
          : "reveal w-full flex-1 basis-0 overflow-hidden rounded-[var(--radius-card)] border border-white/10 bg-[var(--color-graphite-2)]"
      }
    >
      <div className="flex items-center gap-2 border-b border-white/10 px-3 sm:px-4">
        <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto py-2">
          {QUICKSTART_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setLang(tab.id)}
              className={`shrink-0 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                lang === tab.id
                  ? "bg-white/10 text-[var(--hm-accent)]"
                  : "text-white/55 hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={copy}
          className="shrink-0 rounded-md border border-white/15 px-2.5 py-1 text-xs text-white/70 hover:border-white/35 hover:text-white"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="max-h-[20rem] overflow-auto p-4 font-mono text-[13px] leading-relaxed text-white/90">
        <code>{snippet}</code>
      </pre>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-white/10 bg-black/25 px-4 py-2.5 font-mono text-xs">
        <span className="font-semibold text-emerald-400">202 Accepted</span>
        <span className="text-white/45">
          id: <span className="text-white/80">msg_8f2a91c4</span>
        </span>
        <span className="text-white/45">
          queued in: <span className="text-white/80">42ms</span>
        </span>
      </div>
    </div>
  );
}

function TemplateDesignerDemo() {
  const [templateSource, setTemplateSource] = useState(DEFAULT_TEMPLATE_SOURCE);
  const [vars, setVars] = useState(DEFAULT_TEMPLATE_VARS);

  const varKeys = useMemo(() => extractTemplateVars(templateSource), [templateSource]);
  const rendered = renderTemplate(templateSource, vars);
  const subjectLine = rendered.split("\n")[0]?.replace(/^Subject:\s*/i, "") ?? "Preview";
  const bodyLines = rendered
    .split("\n")
    .slice(1)
    .filter((line) => line.trim().length > 0);

  const updateVar = (key: string, value: string) => {
    setVars((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="reveal grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-6">
      <div className="flex min-w-0 flex-col overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-rule)] bg-[var(--color-graphite)]">
        <div className="border-b border-white/10 px-4 py-2.5">
          <p className="font-mono text-[10px] uppercase tracking-wide text-white/45">
            Template editor
          </p>
          <p className="text-sm font-medium text-white">payment-receipt</p>
        </div>
        <label htmlFor="template-source" className="sr-only">
          Template source
        </label>
        <textarea
          id="template-source"
          value={templateSource}
          onChange={(e) => setTemplateSource(e.target.value)}
          spellCheck={false}
          className="min-h-[12rem] flex-1 resize-y border-0 bg-transparent p-4 font-mono text-[12px] leading-relaxed text-white/85 outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--hm-accent)]/40"
        />
        <div className="space-y-2 border-t border-white/10 px-4 py-3">
          <p className="font-mono text-[10px] uppercase tracking-wide text-white/45">Variables</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {varKeys.map((key) => (
              <label key={key} className="flex flex-col gap-1">
                <span className="font-mono text-[10px] text-white/50">{key}</span>
                <input
                  type="text"
                  value={vars[key] ?? ""}
                  onChange={(e) => updateVar(key, e.target.value)}
                  placeholder={`{{${key}}}`}
                  className="h-8 rounded-[var(--radius-input)] border border-white/15 bg-black/25 px-2 font-mono text-xs text-white outline-none focus:border-[var(--hm-accent)]"
                />
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="min-w-0 overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-rule)] bg-[var(--color-paper-2)]">
        <div className="border-b border-[var(--color-rule)] px-4 py-2.5">
          <p className="font-mono text-[10px] uppercase tracking-wide text-[var(--color-muted)]">
            Live preview
          </p>
          <p className="text-sm font-medium text-[var(--color-ink)]">Designed email</p>
        </div>
        <div className="p-4">
          {/* Always render preview as a light email — dark mode tokens would flip ink to white on bg-white */}
          <div
            className="rounded-[var(--radius)] border border-[#e6e6e6] bg-white p-4 shadow-[var(--shadow-card)]"
            style={{ colorScheme: "light" }}
          >
            <p className="mb-3 text-xs font-semibold text-[#001f3d]">{subjectLine}</p>
            <div className="space-y-2 text-sm leading-relaxed text-[#475569]">
              {bodyLines.map((line, index) => (
                <p key={`${index}-${line}`}>{line}</p>
              ))}
            </div>
            <div className="mt-4 inline-flex rounded bg-[var(--hm-accent)] px-3 py-1.5 text-xs font-semibold text-[var(--color-accent-ink)]">
              View order
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COMMANDS;
    return COMMANDS.filter((c) => c.label.toLowerCase().includes(q) || c.hint.includes(q));
  }, [query]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
      if (e.key === "Escape") setPaletteOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (paletteOpen) {
      setQuery("");
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [paletteOpen]);

  useEffect(() => {
    const nodes = document.querySelectorAll(".reveal");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      nodes.forEach((n) => n.classList.add("is-in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add("is-in");
        });
      },
      { threshold: 0.12 },
    );
    nodes.forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-[var(--color-paper)] text-[var(--color-ink-2)]">
      <header className="sticky top-0 z-50 border-b border-[var(--color-rule)] bg-[var(--color-paper)]/90 backdrop-blur-md">
        <div className="relative mx-auto grid h-14 max-w-6xl grid-cols-[1fr_auto_1fr] items-center px-4">
          <Link href="/" className="justify-self-start" aria-label="Sanarwa home">
            <SanarwaWordmark markClassName="size-7 text-[var(--hm-accent)]" />
          </Link>

          <nav className="flex items-center gap-6 text-sm">
            <Link href="/" className="font-medium text-[var(--hm-accent)]">
              Home
            </Link>
            <Link href="/pricing" className="text-[var(--color-ink-2)] hover:text-[var(--hm-accent)]">
              Pricing
            </Link>
            <Link href="/docs" className="text-[var(--color-ink-2)] hover:text-[var(--hm-accent)]">
              Docs
            </Link>
          </nav>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="hidden h-8 items-center gap-2 rounded-[var(--radius)] border border-[var(--color-rule)] bg-[var(--color-paper)] px-2.5 font-mono text-xs text-[var(--color-muted)] transition-colors hover:border-[var(--hm-accent)] sm:inline-flex"
              aria-label="Open command palette"
            >
              <MagnifyingGlassIcon className="size-3.5" />
              <span>Search</span>
              <kbd className="rounded border border-[var(--color-rule)] px-1 py-0.5 text-[10px]">
                ⌘K
              </kbd>
            </button>
            <ThemeToggle />
            <Button
              asChild
              size="sm"
              className="rounded-[var(--radius)] bg-[var(--hm-accent)] text-[var(--color-accent-ink)] hover:opacity-90"
            >
              <Link href="/register">Start free</Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-16 lg:flex-row lg:items-center lg:py-24">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: "easeOut" }} className="w-full flex-1 basis-0">
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="mono-label mb-4 flex items-center gap-2">
              <span className="inline-block size-1.5 rounded-full bg-[var(--hm-accent)] motion-safe:animate-pulse" aria-hidden />
              Multi-channel API
            </motion.p>
            <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.6 }} className="mb-5 text-4xl font-bold leading-[1.1] tracking-tight text-[var(--color-ink)] sm:text-5xl lg:text-6xl">
              One API. Every channel.
            </motion.h1>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="mb-8 max-w-lg text-lg leading-relaxed text-[var(--color-ink-2)]">
              Send email, SMS, push, in-app, and voice from a single typed SDK. Start with {formatTokens(WELCOME_SIGNUP_TOKENS)} free tokens.
            </motion.p>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button asChild size="lg" className="rounded-[var(--radius)] bg-[var(--hm-accent)] text-[var(--color-accent-ink)] hover:opacity-90">
                <Link href="/register">Get API keys <ArrowRightIcon className="size-4" /></Link>
              </Button>
              <Link href="/pricing" className="inline-flex h-10 items-center justify-center px-2 text-sm font-medium text-[var(--color-ink)] underline-offset-4 hover:underline">See token pricing</Link>
            </motion.div>
          </motion.div>

          <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2, duration: 0.7 }} className="w-full flex-1 basis-0">
            <SdkSnippetPlayground variant="hero" />
          </motion.div>
        </section>

        <section className="border-y border-[var(--color-rule)] bg-[var(--color-paper-2)]">
          <div className="mx-auto max-w-6xl px-4 py-16">
            <div className="reveal mb-10 w-full max-w-2xl">
              <h2 className="mb-3 text-3xl font-bold tracking-tight text-[var(--color-ink)]">
                One SDK, per-channel payloads
              </h2>
              <p className="text-base leading-relaxed text-[var(--color-ink-2)]">
                Same SDK, receipts and webhooks - payload varies per channel.
              </p>
            </div>
            <motion.ul initial="hidden" whileInView="show" viewport={{ once: true }} variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }} className="grid grid-cols-1 gap-px overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-rule)] bg-[var(--color-rule)] sm:grid-cols-2 lg:grid-cols-3">
              {CHANNELS.map(({ name, detail, icon: Icon }) => (
                <motion.li key={name} variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }} whileHover={{ y: -2 }} className="bg-[var(--color-paper)] p-5 transition-shadow hover:shadow-[var(--shadow-card)]">
                  <Icon className="mb-3 size-5 text-[var(--hm-accent)]" aria-hidden />
                  <h3 className="mb-1 text-base font-semibold text-[var(--color-ink)]">{name}</h3>
                  <p className="text-sm leading-relaxed text-[var(--color-muted)]">{detail}</p>
                </motion.li>
              ))}
              <motion.li variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }} className="flex flex-col justify-between bg-[var(--color-paper)] p-5 sm:col-span-2 lg:col-span-1">
                <div>
                  <p className="mono-label mb-2">SDK</p>
                  <h3 className="mb-1 text-base font-semibold text-[var(--color-ink)]">Type-safe clients</h3>
                  <p className="text-sm text-[var(--color-muted)]">TypeScript, Python, Go, Rust, and cURL — same surface.</p>
                </div>
                <Link href="/pricing" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-[var(--hm-accent)] hover:underline">See pricing <ArrowRightIcon className="size-3.5" /></Link>
              </motion.li>
            </motion.ul>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16">
          <div className="reveal mb-8 max-w-2xl">
            <p className="mono-label mb-3">Templates</p>
            <h2 className="mb-3 text-3xl font-bold tracking-tight text-[var(--color-ink)]">
              Design per channel. Share variables.
            </h2>
            <p className="text-base leading-relaxed text-[var(--color-ink-2)]">
              Variables handlebars `{"{{name}}"}`, preview per channel.
            </p>
          </div>
          <TemplateDesignerDemo />
        </section>

        <section className="bg-[var(--color-graphite)] text-white/90">
          <div className="mx-auto max-w-6xl px-4 py-16">
            <div className="reveal mx-auto max-w-2xl text-center">
              <p className="mono-label mb-3 text-white/50">Quickstart</p>
              <h2 className="mb-4 text-3xl font-bold tracking-tight text-white">
                Ship a message in one call
              </h2>
              <p className="mb-8 text-base leading-relaxed text-white/70">
                Create a project, grab a key, and post to{" "}
                <code className="text-[var(--hm-accent)]">/v1/messages</code>. Delivery events land
                on your webhook.
              </p>
              <Button
                asChild
                className="rounded-[var(--radius)] bg-[var(--hm-accent)] text-[var(--color-accent-ink)] hover:opacity-90"
              >
                <Link href="/register">Get API keys</Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-20">
          <div className="reveal flex flex-col gap-6 rounded-[var(--radius-card)] border border-[var(--color-rule)] p-8 md:flex-row md:items-center md:justify-between md:p-10">
            <div className="w-full max-w-xl">
              <h2 className="mb-2 text-2xl font-bold tracking-tight text-[var(--color-ink)]">
                Start free with {formatTokens(WELCOME_SIGNUP_TOKENS)} tokens.
              </h2>
              <p className="text-[var(--color-ink-2)]">
                Create an account, design a template, and send your first notification.
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
              <Button
                asChild
                className="rounded-[var(--radius)] bg-[var(--hm-accent)] text-[var(--color-accent-ink)] hover:opacity-90"
              >
                <Link href="/register">Create account</Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="rounded-[var(--radius)] border-[var(--color-rule)] bg-transparent text-[var(--color-ink)] hover:bg-[var(--hm-accent)]/10 hover:text-[var(--color-ink)]"
              >
                <Link href="/pricing">View pricing</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--color-rule)]">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-sm text-[var(--color-muted)] sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-[var(--color-ink)]">
            <SanarwaMark className="size-5 text-[var(--hm-accent)]" />
            <span className="font-[family-name:var(--font-display)] font-medium">Sanarwa</span>
            <span className="text-[var(--color-muted)]">
              — multi-channel messaging for builders
            </span>
          </div>
          <p>© {new Date().getFullYear()} Sanarwa</p>
        </div>
      </footer>

      {paletteOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-start justify-center bg-[oklch(20%_0.02_258_/_0.45)] px-4 pt-[15vh]"
          role="presentation"
          onClick={() => setPaletteOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            className="w-full max-w-lg overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-rule)] bg-[var(--color-paper)] shadow-[var(--shadow-card)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b border-[var(--color-rule)] px-3">
              <MagnifyingGlassIcon className="size-4 text-[var(--color-muted)]" />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Jump to…"
                className="h-12 w-full bg-transparent font-[family-name:var(--font-mono)] text-sm outline-none placeholder:text-[var(--color-muted)]"
              />
              <button
                type="button"
                className="p-1 text-[var(--color-muted)]"
                onClick={() => setPaletteOpen(false)}
                aria-label="Close"
              >
                <XMarkIcon className="size-4" />
              </button>
            </div>
            <ul className="max-h-72 overflow-y-auto p-2">
              {filtered.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="flex items-center justify-between rounded-[var(--radius)] px-3 py-2 text-sm text-[var(--color-ink)] hover:bg-[var(--color-paper-2)]"
                    onClick={() => setPaletteOpen(false)}
                  >
                    <span>{item.label}</span>
                    <span className="font-[family-name:var(--font-mono)] text-xs text-[var(--color-muted)]">
                      {item.hint}
                    </span>
                  </Link>
                </li>
              ))}
              {filtered.length === 0 ? (
                <li className="px-3 py-6 text-center text-sm text-[var(--color-muted)]">
                  No matches
                </li>
              ) : null}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}
