export function LogoMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="9" className="fill-brand" />
      <path
        d="M10 11h9M10 16h6"
        stroke="var(--brand-foreground)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M10 21.5l3 3 7-7.5"
        stroke="var(--brand-foreground)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Logo({
  className = "",
  markClassName,
}: {
  className?: string;
  markClassName?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMark className={markClassName ?? "h-8 w-8"} />
      <span className="text-lg font-semibold tracking-tight text-foreground">
        Bitácora
      </span>
    </span>
  );
}
