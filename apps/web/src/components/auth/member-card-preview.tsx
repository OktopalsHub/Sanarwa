"use client";

export function MemberCardPreview({
  name,
  orgName,
  role = "Member",
}: {
  name: string;
  orgName: string;
  role?: string;
}) {
  const trimmed = name.trim();
  const initials =
    trimmed
      .split(/\s+/)
      .map((word) => word[0]?.toUpperCase() ?? "")
      .slice(0, 2)
      .join("") || "?";

  return (
    <div
      className="inline-flex w-full max-w-[19.5rem] items-center gap-4 rounded-2xl border border-white/10 bg-[var(--color-paper-2)] px-4 py-4 shadow-[6px_6px_0_rgba(0,0,0,0.45)]"
      role="img"
      aria-label={`Member card preview: ${trimmed || "Your name"}, ${role}, ${orgName || "your workspace"}`}
    >
      <span
        className="flex size-14 shrink-0 items-center justify-center rounded-full bg-[var(--hm-accent)] font-[family-name:var(--font-display)] text-lg font-bold text-[var(--color-accent-ink)]"
        aria-hidden
      >
        {initials}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate font-semibold text-[var(--color-ink)]">
          {trimmed || "Your name"}
        </span>
        <span className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-muted)]">
          {role} · {orgName || "your workspace"}
        </span>
      </span>
    </div>
  );
}
