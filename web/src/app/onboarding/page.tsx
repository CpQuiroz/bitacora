"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Rubro } from "@bitacora/shared";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { AuthLayout } from "@/components/AuthLayout";
import { Button, Input, Select } from "@bitacora/ui/web";

const RUBROS: { valor: Rubro; etiqueta: string }[] = [
  { valor: "transporte", etiqueta: "Transporte" },
  { valor: "servicio_tecnico", etiqueta: "Servicio técnico / mantención" },
  { valor: "cosmetologia", etiqueta: "Cosmetología / belleza" },
  { valor: "otro", etiqueta: "Otro" },
];

// PASO 6 (sistema de diseño) — migrado. Ver docs/design-system.md.
export default function OnboardingPage() {
  const router = useRouter();
  const [verificando, setVerificando] = useState(true);
  const [nombreUsuario, setNombreUsuario] = useState("");
  const [nombreEmpresa, setNombreEmpresa] = useState("");
  const [rubro, setRubro] = useState<Rubro>("transporte");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acepto, setAcepto] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.replace("/login");
        return;
      }
      const res = await apiFetch("/api/me");
      if (res.ok) {
        const body = await res.json();
        if (body.usuario) {
          router.replace("/dashboard");
          return;
        }
        // Sin fila en `usuarios` y sin autorregistro: no puede crear
        // empresa acá (ver migración 72). Se lo saca al login.
        if (body.acceso && body.acceso !== "onboarding") {
          await supabase.auth.signOut();
          router.replace("/login");
          return;
        }
      }
      setVerificando(false);
    })();
  }, [router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setCargando(true);

    const res = await apiFetch("/api/registro-empresa", {
      method: "POST",
      body: JSON.stringify({
        nombre_empresa: nombreEmpresa,
        rubro,
        nombre_usuario: nombreUsuario,
        acepto_documentos: acepto,
      }),
    });

    setCargando(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "No se pudo crear la empresa");
      return;
    }
    router.push("/dashboard");
  }

  if (verificando) return null;

  return (
    <AuthLayout title="Crea tu empresa" subtitle="Esta va a ser tu cuenta de administrador">
      <form onSubmit={onSubmit} className="flex flex-col gap-ds-4">
        <Input etiqueta="Tu nombre" requerido valor={nombreUsuario} onCambio={setNombreUsuario} />
        <Input etiqueta="Nombre de la empresa" requerido valor={nombreEmpresa} onCambio={setNombreEmpresa} />
        <Select etiqueta="Rubro" valor={rubro} onCambio={(v) => setRubro(v as Rubro)} opciones={RUBROS} />
        <label className="flex items-start gap-ds-2 font-ds-body text-ds-small text-ds-text/70">
          <input
            type="checkbox"
            className="mt-0.5 accent-[var(--ds-brand)]"
            checked={acepto}
            onChange={(e) => setAcepto(e.target.checked)}
          />
          <span>
            He leído y acepto la{" "}
            <Link href="/privacidad" target="_blank" className="text-ds-brand hover:underline">Política de Privacidad</Link>{" "}
            y los{" "}
            <Link href="/terminos" target="_blank" className="text-ds-brand hover:underline">Términos de Servicio</Link>.
          </span>
        </label>
        {error ? <p className="font-ds-body text-ds-small text-ds-accent-700">{error}</p> : null}
        <Button tipo="submit" bloque deshabilitado={cargando || !acepto} cargando={cargando}>
          Crear empresa
        </Button>
      </form>
    </AuthLayout>
  );
}
