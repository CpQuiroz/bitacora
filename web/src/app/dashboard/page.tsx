"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Empresa, Usuario } from "@bitacora/shared";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { DashboardShell } from "@/components/DashboardShell";
import { Card } from "@/components/ui";
import {
  IconArrowRight,
  IconBriefcase,
  IconReceipt,
  IconSparkle,
  IconUsers,
} from "@/components/icons";

type UsuarioConEmpresa = Usuario & { empresa: Empresa };

const ACCESOS = [
  { href: "/dashboard/trabajos", label: "Trabajos", desc: "Registra y revisa los trabajos en terreno", icon: IconBriefcase },
  { href: "/dashboard/facturas", label: "Facturas", desc: "Arma facturas a partir de trabajos completados", icon: IconReceipt },
  { href: "/dashboard/informe", label: "Informe con IA", desc: "Resumen ejecutivo generado por Claude", icon: IconSparkle },
];

export default function DashboardPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<UsuarioConEmpresa | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.replace("/login");
        return;
      }
      const res = await apiFetch("/api/me");
      if (!res.ok) {
        router.replace("/login");
        return;
      }
      const body = await res.json();
      if (!body.usuario) {
        router.replace("/onboarding");
        return;
      }
      setUsuario(body.usuario);
      setCargando(false);
    })();
  }, [router]);

  if (cargando || !usuario) return null;

  const accesos =
    usuario.rol === "admin"
      ? [...ACCESOS, { href: "/dashboard/equipo", label: "Equipo", desc: "Invita choferes, técnicos y contadores", icon: IconUsers }]
      : ACCESOS;

  return (
    <DashboardShell
      usuario={{ nombre: usuario.nombre, rol: usuario.rol, empresaNombre: usuario.empresa.nombre }}
    >
      <div className="mb-8">
        <p className="text-sm font-medium text-brand">{usuario.empresa.nombre}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
          Hola, {usuario.nombre.split(" ")[0]}
        </h1>
        <p className="mt-1 text-sm text-muted capitalize">
          {usuario.rol} · rubro {usuario.empresa.rubro.replace("_", " ")}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {accesos.map((a) => (
          <Link key={a.href} href={a.href}>
            <Card className="group h-full transition-colors hover:border-brand">
              <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-brand">
                <a.icon className="h-5 w-5" />
              </div>
              <div className="flex items-center gap-1.5 font-semibold text-foreground">
                {a.label}
                <IconArrowRight className="h-4 w-4 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-brand" />
              </div>
              <p className="mt-1 text-sm text-muted">{a.desc}</p>
            </Card>
          </Link>
        ))}
      </div>
    </DashboardShell>
  );
}
