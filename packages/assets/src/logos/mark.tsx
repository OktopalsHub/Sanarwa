import type { SVGProps } from 'react';

/** Sanarwa mark — signal / notification glyph. Prefer this over ad-hoc icons. */
export function SanarwaMark({ title = 'Sanarwa', ...props }: SVGProps<SVGSVGElement> & { title?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden={title ? undefined : true} {...props}>
      {title ? <title>{title}</title> : null}
      <rect width="32" height="32" rx="6" fill="currentColor" />
      <path
        d="M8 12.5c0-1.1.9-2 2-2h8.5a2 2 0 0 1 2 2v5.2a2 2 0 0 1-2 2H14l-3.2 3.1V19.7H10a2 2 0 0 1-2-2v-5.2Z"
        fill="var(--color-accent-ink, #f8fafc)"
      />
      <circle cx="13" cy="15" r="1.1" fill="currentColor" opacity="0.35" />
      <circle cx="16.5" cy="15" r="1.1" fill="currentColor" opacity="0.35" />
      <circle cx="20" cy="15" r="1.1" fill="currentColor" opacity="0.35" />
    </svg>
  );
}
