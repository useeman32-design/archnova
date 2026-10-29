export function LogoMark({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 34 34" fill="none" aria-hidden>
      <rect width="34" height="34" rx="9" fill="#1a56f5" />
      <rect width="34" height="34" rx="9" fill="url(#ps-glow)" opacity="0.55" />
      <path
        d="M17 7.5 L26 15 V26.5 a1 1 0 0 1-1 1 H19.5 V20 h-5 v7.5 H9 a1 1 0 0 1-1-1 V15 Z"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2.1"
        strokeLinejoin="round"
      />
      <circle cx="17" cy="14" r="2.6" fill="#ffffff" />
      <defs>
        <linearGradient id="ps-glow" x1="0" y1="0" x2="34" y2="34">
          <stop stopColor="#7ba4ff" />
          <stop offset="1" stopColor="#1643d8" />
        </linearGradient>
      </defs>
    </svg>
  )
}

export function Logo({
  onDark = true,
  showWordmark = true,
}: {
  onDark?: boolean
  showWordmark?: boolean
}) {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark />
      {showWordmark ? (
        <div className="leading-tight">
          <div className={`text-[15px] font-bold tracking-tight ${onDark ? 'text-white' : 'text-ink-text'}`}>
            ArchNova
          </div>
          <div className={`text-[10px] font-medium uppercase tracking-[0.16em] ${onDark ? 'text-white/45' : 'text-faint'}`}>
            AI House Design
          </div>
        </div>
      ) : null}
    </div>
  )
}
