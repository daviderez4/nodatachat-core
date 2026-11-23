// The mark: an agent, and the three things that can happen to what it reaches for.
export function Mark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <circle cx="7" cy="14" r="3.5" fill="currentColor" />
      <path d="M10.5 14C15 14 15 6 21 6M10.5 14H21M10.5 14C15 14 15 22 21 22" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="22.5" cy="6" r="2.2" fill="#14B8A6" />
      <circle cx="22.5" cy="14" r="2.2" fill="var(--paper)" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="22.5" cy="22" r="2.2" fill="#F59E0B" />
    </svg>
  );
}
