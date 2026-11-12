"use client";

import { IconArrowRight } from "@tabler/icons-react";
import Link from "@/compat/next-link";
import { useTenantBasePath } from "@/hooks/use-tenant-slug";

const DOTS = "radial-gradient(rgba(0,31,61,0.16) 1px, transparent 1px)";

export function HeroPanel({
  tenantName,
  totalSent,
  delivered,
  failed,
  isLoading,
}: {
  tenantName?: string;
  totalSent: number;
  delivered: number;
  failed: number;
  isLoading: boolean;
}) {
  const basePath = useTenantBasePath();

  return (
    <section
      className="overflow-hidden rounded-2xl"
      aria-label="Workspace overview"
      style={{
        background: "var(--hm-accent)",
        backgroundImage: DOTS,
        backgroundSize: "16px 16px",
      }}
    >
      <div className="px-6 py-8 sm:px-8 sm:py-10">
        <p className="font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-[#001f3d]/70">
          {tenantName ?? "Workspace"} · notifications
        </p>
        <h2
          className="mt-3 font-[family-name:var(--font-display)] text-[clamp(2rem,4.6vw,3.5rem)] font-extrabold leading-[0.95] tracking-[var(--tracking-display)] text-[#001f3d] [text-wrap:balance]"
          style={{ fontStyle: "normal" }}
        >
          Send once.
          <br />
          Reach all six channels.
        </h2>
        <p className="mt-4 max-w-[46ch] text-[0.9375rem] font-medium leading-relaxed text-[#001f3d]/80">
          Projects, keys, receipts and failover — one place to watch every message in flight.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-4">
          <Link
            href={`${basePath}/messages`}
            className="inline-flex h-12 items-center gap-2 rounded-full bg-[#001f3d] px-6 font-mono text-[12px] font-bold uppercase tracking-[0.14em] text-[#f6f7f8] transition-[transform,box-shadow] duration-150 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#001f3d] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--hm-accent)] active:translate-y-px"
          >
            Open messages
            <IconArrowRight className="size-4" aria-hidden />
          </Link>
        </div>

        <dl className="mt-8 grid grid-cols-3 gap-3 border-t border-[#001f3d]/15 pt-6 sm:gap-6">
          <HeroStat
            label="Last 30 days"
            value={isLoading ? "…" : totalSent.toLocaleString()}
            unit="sent"
          />
          <HeroStat
            label="Delivered"
            value={isLoading ? "…" : delivered.toLocaleString()}
            unit="receipts"
          />
          <HeroStat
            label="Failed"
            value={isLoading ? "…" : failed.toLocaleString()}
            unit="need eyes"
          />
        </dl>
      </div>
    </section>
  );
}

function HeroStat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div>
      <dt className="font-mono text-[9px] font-medium uppercase tracking-[0.2em] text-[#001f3d]/60">
        {label}
      </dt>
      <dd className="mt-1 flex items-baseline gap-2">
        <span className="font-[family-name:var(--font-display)] text-2xl font-extrabold tabular-nums tracking-tight text-[#001f3d] sm:text-3xl">
          {value}
        </span>
        <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#001f3d]/60">
          {unit}
        </span>
      </dd>
    </div>
  );
}
