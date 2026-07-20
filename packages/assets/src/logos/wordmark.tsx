import { SanarwaMark } from './mark';

type WordmarkProps = {
  showMark?: boolean;
  markClassName?: string;
  labelClassName?: string;
  className?: string;
};

/** Logo lockup: mark + wordmark. Use everywhere brand identity appears. */
export function SanarwaWordmark({
  showMark = true,
  markClassName = 'size-8 text-[var(--hm-accent)]',
  labelClassName = 'font-[family-name:var(--font-display)] text-xl font-semibold tracking-[-0.03em] text-[var(--color-ink)]',
  className,
}: WordmarkProps) {
  return (
    <span className={['inline-flex items-center gap-2', className].filter(Boolean).join(' ')}>
      {showMark ? <SanarwaMark className={markClassName} /> : null}
      <span className={labelClassName}>Sanarwa</span>
    </span>
  );
}

export type { WordmarkProps };
