import Link from "next/link";
import { Briefcase, Receipt, Sparkles, Truck } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button, Card } from "@bitacora/ui/web";

const FEATURES = [
  {
    icon: Briefcase,
    title: "Trabajos",
    body: "Registra cada trabajo en terreno, con check-in/out y formularios que se adaptan a tu rubro.",
  },
  {
    icon: Receipt,
    title: "Facturas",
    body: "Arma facturas a partir de los trabajos completados, con montos y plazos calculados solos.",
  },
  {
    icon: Sparkles,
    title: "Informe con IA",
    body: "Un resumen ejecutivo en segundos: actividad, estado de cobro y alertas, sin abrir una planilla.",
  },
];

// Landing pública (23-sep-2026) — migrada al sistema de diseño. Hasta
// acá era la única pantalla de toda la app que no había pasado por el
// PASO 6 (docs/design-system.md): usaba colores y tipografía del
// sistema viejo (bg-brand, text-foreground, Tailwind sin tokens) en vez
// de @bitacora/ui + los ds-* de tokens.json — por eso, seguida del
// login (ya migrado), se sentía como dos apps distintas. Mismo
// contenido/copy de siempre, solo el tratamiento visual cambia.
export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-ds-bg font-ds-body">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-ds-6 py-ds-6">
        <Logo />
        <div className="flex items-center gap-ds-3">
          <Link
            href="/login"
            className="text-ds-small font-medium text-ds-text/70 hover:text-ds-text"
          >
            Iniciar sesión
          </Link>
          <Link href="/registro">
            <Button tamano="sm">Crear cuenta</Button>
          </Link>
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 -top-32 -z-10 flex justify-center"
          >
            <div className="h-80 w-[36rem] rounded-full bg-ds-brand/15 blur-3xl" />
          </div>
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-ds-6 px-ds-6 py-20 text-center sm:py-28">
            <span className="inline-flex items-center gap-ds-2 rounded-ds-pill border border-ds-divider bg-ds-surface px-ds-3 py-1 text-ds-caption font-medium text-ds-text/70">
              <Truck size={16} strokeWidth={2.5} className="text-ds-brand" />
              Hecho para pymes de servicio en terreno
            </span>
            <h1 className="ds-heading text-ds-h1 text-ds-text">
              Tu operación, tus facturas y un informe con IA — en un solo lugar.
            </h1>
            <p className="max-w-xl text-ds-h5 text-ds-text/70">
              Transporte, mantención, instalaciones. Bitácora reemplaza la
              planilla de Excel con algo que tu equipo puede usar desde el
              celular, en terreno.
            </p>
            <div className="mt-ds-2 flex flex-col gap-ds-3 sm:flex-row">
              <Link href="/registro">
                <Button tamano="lg">Crear cuenta gratis</Button>
              </Link>
              <Link href="/login">
                <Button tamano="lg" variante="secundario">
                  Ya tengo cuenta
                </Button>
              </Link>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-5xl px-ds-6 pb-24">
          <div className="grid gap-ds-6 sm:grid-cols-3">
            {FEATURES.map((f) => (
              <Card key={f.title} elevacion="sm">
                <div className="mb-ds-4 inline-flex h-10 w-10 items-center justify-center rounded-ds-md bg-ds-brand/10 text-ds-brand">
                  <f.icon size={20} strokeWidth={2.25} />
                </div>
                <h3 className="font-ds-body font-semibold text-ds-text">{f.title}</h3>
                <p className="mt-1.5 text-ds-small text-ds-text/70">{f.body}</p>
              </Card>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-ds-divider px-ds-6 py-ds-8 text-center text-ds-small text-ds-text/70">
        Bitácora — gestión para pymes de servicio en terreno.
      </footer>
    </div>
  );
}
