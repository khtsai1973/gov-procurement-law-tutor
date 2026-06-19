type LogoProps = {
  size?: number;
  className?: string;
  showWordmark?: boolean;
};

export function Logo({ size = 40, className = "", showWordmark = false }: LogoProps) {
  return (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="政府採購法互動教學"
      >
        <defs>
          <linearGradient id="gpa-logo-bg" x1="6" y1="4" x2="42" y2="44" gradientUnits="userSpaceOnUse">
            <stop stopColor="#2563eb" />
            <stop offset="1" stopColor="#1d4ed8" />
          </linearGradient>
          <linearGradient id="gpa-logo-shine" x1="14" y1="10" x2="30" y2="34" gradientUnits="userSpaceOnUse">
            <stop stopColor="#ffffff" stopOpacity="0.35" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
        </defs>

        <rect x="4" y="4" width="40" height="40" rx="11" fill="url(#gpa-logo-bg)" />
        <rect x="4" y="4" width="40" height="40" rx="11" fill="url(#gpa-logo-shine)" />

        <path
          d="M15 13.5h13.5c1.1 0 2 .9 2 2V31.5c0 1.1-.9 2-2 2H15c-1.1 0-2-.9-2-2V15.5c0-1.1.9-2 2-2Z"
          fill="white"
          fillOpacity="0.96"
        />
        <path d="M26.5 13.5V17c0 1.1.9 2 2 2h3.5" stroke="white" strokeOpacity="0.55" strokeWidth="1.2" />

        <rect x="17" y="19" width="10" height="1.6" rx="0.8" fill="#1d4ed8" fillOpacity="0.75" />
        <rect x="17" y="22.5" width="8.5" height="1.6" rx="0.8" fill="#1d4ed8" fillOpacity="0.55" />
        <rect x="17" y="26" width="9.5" height="1.6" rx="0.8" fill="#1d4ed8" fillOpacity="0.55" />

        <circle cx="33.5" cy="33.5" r="7.5" fill="#10b981" />
        <path
          d="M30.2 33.6l2.1 2.1 4.4-4.6"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      {showWordmark ? (
        <span className="leading-tight">
          <span className="block text-base font-bold tracking-tight text-[var(--fg)]">政府採購法</span>
          <span className="block text-xs font-medium text-[var(--muted)]">互動教學平台</span>
        </span>
      ) : null}
    </span>
  );
}
