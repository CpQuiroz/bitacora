// Marca compartida por toda la app (DashboardShell, SuperAdminShell,
// PortalShell, AuthLayout, landing). Nunca se migró al sistema de
// diseño (23-sep-2026, pedido explícito tras notar que login y la
// landing "se sienten como dos apps distintas") — usaba --brand
// (#14314f, azul marino fijo del sistema viejo) en vez de --ds-brand,
// que SÍ es la variable que los shells pisan con el color_primario de
// cada tenant. En la práctica esto dejaba el ícono del logo siempre
// azul marino en TODA la app, sin importar el color de marca elegido.
export function LogoMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="9" className="fill-ds-brand" />
      <path
        d="M10 11h9M10 16h6"
        stroke="var(--ds-brand-foreground)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M10 21.5l3 3 7-7.5"
        stroke="var(--ds-brand-foreground)"
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
      <span className="font-ds-body text-lg font-semibold tracking-tight text-ds-text">
        Bitácora
      </span>
    </span>
  );
}
