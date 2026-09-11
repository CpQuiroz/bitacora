import Link from "next/link";
import type { ReactNode } from "react";
import { Card } from "@bitacora/ui/web";
import { Logo } from "./Logo";

// PASO 6 (sistema de diseño) — migrado. Ver docs/design-system.md.
export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-ds-bg px-ds-6 py-ds-8">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-40 -z-10 flex justify-center">
        <div className="h-72 w-[32rem] rounded-full bg-ds-accent/15 blur-3xl" />
      </div>
      <Link href="/" className="mb-ds-6">
        <Logo />
      </Link>
      <div className="w-full max-w-sm">
        <Card elevacion="md">
          <div className="mb-ds-6">
            <p className="ds-heading text-ds-h3 text-ds-text">{title}</p>
            {subtitle ? <p className="mt-ds-1 font-ds-body text-ds-small text-ds-text/70">{subtitle}</p> : null}
          </div>
          {children}
        </Card>
      </div>
      {footer ? <div className="mt-ds-6 font-ds-body text-ds-small">{footer}</div> : null}
    </div>
  );
}
