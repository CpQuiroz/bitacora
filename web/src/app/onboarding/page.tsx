"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Rubro } from "@bitacora/shared";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { AuthLayout } from "@/components/AuthLayout";
import { Button, ErrorText, Input, Label, Select } from "@/components/ui";

const RUBROS: { value: Rubro; label: string }[] = [
  { value: "transporte", label: "Transporte" },
  { value: "servicio_tecnico", label: "Servicio técnico / mantención" },
  { value: "cosmetologia", label: "Cosmetología / belleza" },
  { value: "otro", label: "Otro" },
];

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
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div>
          <Label>Tu nombre</Label>
          <Input
            type="text"
            required
            value={nombreUsuario}
            onChange={(e) => setNombreUsuario(e.target.value)}
          />
        </div>
        <div>
          <Label>Nombre de la empresa</Label>
          <Input
            type="text"
            required
            value={nombreEmpresa}
            onChange={(e) => setNombreEmpresa(e.target.value)}
          />
        </div>
        <div>
          <Label>Rubro</Label>
          <Select value={rubro} onChange={(e) => setRubro(e.target.value as Rubro)}>
            {RUBROS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </Select>
        </div>
        <label className="flex items-start gap-2 text-sm text-muted">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={acepto}
            onChange={(e) => setAcepto(e.target.checked)}
          />
          <span>
            He leído y acepto la{" "}
            <Link href="/privacidad" target="_blank" className="text-brand hover:underline">Política de Privacidad</Link>{" "}
            y los{" "}
            <Link href="/terminos" target="_blank" className="text-brand hover:underline">Términos de Servicio</Link>.
          </span>
        </label>
        {error && <ErrorText>{error}</ErrorText>}
        <Button type="submit" disabled={cargando || !acepto} className="mt-2 w-full">
          {cargando ? "Creando…" : "Crear empresa"}
        </Button>
      </form>
    </AuthLayout>
  );
}
