/** Scalable SVG sunglasses mark — premium, slight glow */
export function SunglassesIcon({
  className = "h-8 w-8",
  glow = false,
}: {
  className?: string;
  glow?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient id="bn-lens" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#0369a1" stopOpacity="0.9" />
        </linearGradient>
        <filter id="bn-glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="2.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g filter={glow ? "url(#bn-glow)" : undefined}>
        {/* bridge */}
        <path
          d="M24 28c2.5-3 5.5-4.5 8-4.5S37.5 25 40 28"
          stroke="#0f172a"
          strokeWidth="2.5"
          strokeLinecap="round"
          className="dark:stroke-slate-100"
        />
        {/* left lens */}
        <rect
          x="8"
          y="26"
          width="18"
          height="14"
          rx="4"
          fill="url(#bn-lens)"
          stroke="#0f172a"
          strokeWidth="2"
          className="dark:stroke-slate-100"
        />
        {/* right lens */}
        <rect
          x="38"
          y="26"
          width="18"
          height="14"
          rx="4"
          fill="url(#bn-lens)"
          stroke="#0f172a"
          strokeWidth="2"
          className="dark:stroke-slate-100"
        />
        {/* temples */}
        <path
          d="M8 30H4c-1 0-2 1-2 2v2"
          stroke="#0f172a"
          strokeWidth="2"
          strokeLinecap="round"
          className="dark:stroke-slate-100"
        />
        <path
          d="M56 30h4c1 0 2 1 2 2v2"
          stroke="#0f172a"
          strokeWidth="2"
          strokeLinecap="round"
          className="dark:stroke-slate-100"
        />
        {/* scan glint */}
        <path
          d="M12 30h8M42 30h8"
          stroke="#e0f2fe"
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.7"
        />
      </g>
    </svg>
  );
}
