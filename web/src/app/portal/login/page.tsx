"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AuthLayout } from "@/components/AuthLayout";
import { Button, ErrorText, Input, Label } from "@/components/ui";
import { guardarTokenPortal, portalFetch } from "@/lib/portalApi";

type Empresa = { id: string; nombre: string };

export default function LoginPortalPage() {
  const router = useRouter();
  const [rut, setRut] = useState("");
  const [empresas, setEmpresas] = useState<Empresa[] | null>(null);
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [codigoEnviado, setCodigoEnviado] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [verificando, setVerificando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function solicitarCodigo(empresaSeleccionada?: string) {
    setError(null);
    if (!rut.trim()) {
      setError("Ingresa tu RUT");
      return;
    }
    setEnviando(true);
    const res = await portalFetch("/api/portal/solicitar-codigo", {
      method: "POST",
      body: JSON.stringify({ rut: rut.trim(), empresa_id: empresaSeleccionada }),
    });
    setEnviando(false);
    if (!res.ok) {
      setError("No se pudo enviar el código — revisa tu RUT");
      return;
    }
    const body = await res.json();
    if (body.empresas?.length > 1) {
      setEmpresas(body.empresas);
      return;
    }
    setEmpresas(null);
    setEmpresaId(empresaSeleccionada ?? null);
    setCodigoEnviado(true);
  }

  async function verificarCodigo() {
    setError(null);
    if (codigo.trim().length !== 6) {
      setError("El código tiene 6 dígitos");
      return;
    }
    setVerificando(true);
    const res = await portalFetch("/api/portal/verificar-codigo", {
      method: "POST",
      body: JSON.stringify({ rut: rut.trim(), codigo: codigo.trim(), empresa_id: empresaId }),
    });
    setVerificando(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Código inválido");
      return;
    }
    const { token } = await res.json();
    guardarTokenPortal(token);
    router.replace("/portal");
  }

  if (codigoEnviado) {
    return (
      <AuthLayout title="Revisa tu correo" subtitle="Te mandamos un código de 6 dígitos, vence en 10 minutos.">
        <div className="flex flex-col gap-4">
          <div>
            <Label>Código</Label>
            <Input
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="123456"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
              className="text-center text-lg tracking-[0.3em]"
            />
          </div>
          {error && <ErrorText>{error}</ErrorText>}
          <Button type="button" onClick={verificarCodigo} disabled={verificando}>
            {verificando ? "Verificando…" : "Entrar"}
          </Button>
          <button type="button" onClick={() => solicitarCodigo(empresaId ?? undefined)} className="text-center text-xs text-muted hover:text-brand">
            Reenviar código
          </button>
        </div>
      </AuthLayout>
    );
  }

  if (empresas) {
    return (
      <AuthLayout title="¿Con cuál empresa?" subtitle="Tu RUT está registrado como cliente en más de una.">
        <div className="flex flex-col gap-2">
          {empresas.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => solicitarCodigo(e.id)}
              className="rounded-lg border border-border px-4 py-3 text-left text-sm font-medium text-foreground hover:border-brand hover:bg-brand-soft"
            >
              {e.nombre}
            </button>
          ))}
        </div>
        {error && (
          <div className="mt-4">
            <ErrorText>{error}</ErrorText>
          </div>
        )}
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Mi portal" subtitle="Ingresa tu RUT y te mandamos un código por correo">
      <div className="flex flex-col gap-4">
        <div>
          <Label>RUT</Label>
          <Input type="text" placeholder="12.345.678-9" value={rut} onChange={(e) => setRut(e.target.value)} />
        </div>
        {error && <ErrorText>{error}</ErrorText>}
        <Button type="button" onClick={() => solicitarCodigo()} disabled={enviando}>
          {enviando ? "Enviando…" : "Enviarme un código"}
        </Button>
      </div>
    </AuthLayout>
  );
}
