import Link from "next/link";
import { Logo } from "@/components/Logo";
import { buttonClass } from "@/components/ui";
import {
  IconBriefcase,
  IconReceipt,
  IconSparkle,
  IconTruck,
} from "@/components/icons";

const FEATURES = [
  {
    icon: IconBriefcase,
    title: "Trabajos",
    body: "Registra cada trabajo en terreno, con check-in/out y formularios que se adaptan a tu rubro.",
  },
  {
    icon: IconReceipt,
    title: "Facturas",
    body: "Arma facturas a partir de los trabajos completados, con montos y plazos calculados solos.",
  },
  {
    icon: IconSparkle,
    title: "Informe con IA",
    body: "Un resumen ejecutivo en segundos: actividad, estado de cobro y alertas, sin abrir una planilla.",
  },
];

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6">
        <Logo />
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm font-medium text-muted hover:text-foreground"
          >
            Iniciar sesión
          </Link>
          <Link href="/registro" className={buttonClass("primary")}>
            Crear cuenta
          </Link>
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 -top-32 -z-10 flex justify-center"
          >
            <div className="h-80 w-[36rem] rounded-full bg-brand/20 blur-3xl" />
          </div>
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-6 py-20 text-center sm:py-28">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-muted">
              <IconTruck className="h-4 w-4 text-brand" />
              Hecho para pymes de servicio en terreno
            </span>
            <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
              Tu operación, tus facturas y un informe con IA — en un solo lugar.
            </h1>
            <p className="max-w-xl text-lg text-muted">
              Transporte, mantención, instalaciones. Bitácora reemplaza la
              planilla de Excel con algo que tu equipo puede usar desde el
              celular, en terreno.
            </p>
            <div className="mt-2 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/registro"
                className={buttonClass("primary", "px-6 py-3 text-base")}
              >
                Crear cuenta gratis
              </Link>
              <Link
                href="/login"
                className={buttonClass("outline", "px-6 py-3 text-base")}
              >
                Ya tengo cuenta
              </Link>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-5xl px-6 pb-24">
          <div className="grid gap-6 sm:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-border bg-surface p-6"
              >
                <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-brand">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold text-foreground">{f.title}</h3>
                <p className="mt-1.5 text-sm text-muted">{f.body}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border px-6 py-8 text-center text-sm text-muted">
        Bitácora — gestión para pymes de servicio en terreno.
      </footer>
    </div>
  );
}
