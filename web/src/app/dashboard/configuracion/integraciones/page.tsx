"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Button, Card, ErrorText, Input, Label, PageHeader, SuccessText } from "@/components/ui";
import { IconChat, IconCreditCard, IconSparkle } from "@/components/icons";

type IntegracionPublica = {
  proveedor: string;
  nombre: string;
  descripcion: string;
  categoria: "pagos" | "comunicacion" | "ia";
  campos: string[];
  conectado: boolean;
  conectado_en: string | null;
  preview: string | null;
};

const CATEGORIAS = [
  { valor: "todas", etiqueta: "Todas" },
  { valor: "pagos", etiqueta: "Pagos" },
  { valor: "comunicacion", etiqueta: "Comunicación" },
  { valor: "ia", etiqueta: "IA" },
] as const;

const ICONO_CATEGORIA = { pagos: IconCreditCard, comunicacion: IconChat, ia: IconSparkle };

const ETIQUETA_CAMPO: Record<string, string> = {
  commerce_code: "Código de comercio",
  api_key: "API key",
  secret_key: "Secret key",
  access_token: "Access token",
  instance_id: "Instance ID",
  api_token: "API token",
  numero: "Número de WhatsApp",
  processor_id: "Processor ID",
  service_account_json: "Service account (JSON)",
};

export default function IntegracionesPage() {
  const [integraciones, setIntegraciones] = useState<IntegracionPublica[] | null>(null);
  const [categoria, setCategoria] = useState<(typeof CATEGORIAS)[number]["valor"]>("todas");
  const [abierta, setAbierta] = useState<string | null>(null);
  const [campos, setCampos] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);
  const [probando, setProbando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);

  const cargar = useCallback(async () => {
    const res = await apiFetch("/api/integraciones");
    if (res.ok) setIntegraciones(await res.json());
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const filtradas = (integraciones ?? []).filter((i) => categoria === "todas" || i.categoria === categoria);
  const conectadas = (integraciones ?? []).filter((i) => i.conectado).length;

  function abrir(i: IntegracionPublica) {
    setAbierta(i.proveedor === abierta ? null : i.proveedor);
    setCampos({});
    setMensaje(null);
  }

  async function onGuardar(proveedor: string) {
    setGuardando(true);
    setMensaje(null);
    const res = await apiFetch(`/api/integraciones/${proveedor}`, { method: "PATCH", body: JSON.stringify(campos) });
    setGuardando(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setMensaje({ tipo: "error", texto: b.error ?? "No se pudo guardar" });
      return;
    }
    setMensaje({ tipo: "ok", texto: "Credenciales guardadas — prueba la conexión para activarla." });
    cargar();
  }

  async function onProbar(proveedor: string) {
    setProbando(true);
    setMensaje(null);
    const res = await apiFetch(`/api/integraciones/${proveedor}/probar`, { method: "POST" });
    setProbando(false);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMensaje({ tipo: "error", texto: body.error ?? "No se pudo probar" });
      return;
    }
    setMensaje({ tipo: body.ok ? "ok" : "error", texto: body.mensaje });
    cargar();
  }

  async function onDesconectar(proveedor: string) {
    await apiFetch(`/api/integraciones/${proveedor}`, { method: "DELETE" });
    setCampos({});
    setMensaje(null);
    cargar();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader title="Integraciones" subtitle="Pagos, comunicación e IA" />
        <span className="text-sm font-medium text-muted">{conectadas} conectadas</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {CATEGORIAS.map((c) => (
          <button
            key={c.valor}
            type="button"
            onClick={() => setCategoria(c.valor)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              categoria === c.valor ? "border-transparent bg-brand-soft text-brand" : "border-border text-muted"
            }`}
          >
            {c.etiqueta}
          </button>
        ))}
      </div>

      {integraciones === null && <p className="text-sm text-muted">Cargando…</p>}

      <div className="grid gap-4 sm:grid-cols-2">
        {filtradas.map((i) => {
          const Icono = ICONO_CATEGORIA[i.categoria];
          const estaAbierta = abierta === i.proveedor;
          return (
            <Card key={i.proveedor} className={estaAbierta ? "sm:col-span-2" : undefined}>
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
                  <Icono className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-foreground">{i.nombre}</p>
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${i.conectado ? "bg-success-soft text-success" : "bg-border text-muted"}`}>
                      {i.conectado ? "Conectado" : "No conectado"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted">{i.descripcion}</p>
                  {i.preview && <p className="mt-1 text-xs text-muted">Guardado: {i.preview}</p>}
                  <button type="button" onClick={() => abrir(i)} className="mt-2 text-xs font-medium text-brand hover:underline">
                    {estaAbierta ? "Cerrar" : "Clic para configurar"}
                  </button>
                </div>
              </div>

              {estaAbierta && (
                <div className="mt-4 border-t border-border pt-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {i.campos.map((campo) => (
                      <div key={campo}>
                        <Label>{ETIQUETA_CAMPO[campo] ?? campo}</Label>
                        <Input
                          type={campo.includes("json") ? "text" : "password"}
                          placeholder={i.preview && campo === i.campos[i.campos.length - 1] ? i.preview : ""}
                          value={campos[campo] ?? ""}
                          onChange={(e) => setCampos((prev) => ({ ...prev, [campo]: e.target.value }))}
                        />
                      </div>
                    ))}
                  </div>
                  {mensaje && (
                    <div className="mt-3">
                      {mensaje.tipo === "ok" ? <SuccessText>{mensaje.texto}</SuccessText> : <ErrorText>{mensaje.texto}</ErrorText>}
                    </div>
                  )}
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Button type="button" onClick={() => onGuardar(i.proveedor)} disabled={guardando}>
                      {guardando ? "Guardando…" : "Guardar"}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => onProbar(i.proveedor)} disabled={probando || !i.preview}>
                      {probando ? "Probando…" : "Probar conexión"}
                    </Button>
                    {i.conectado && (
                      <Button type="button" variant="ghost" onClick={() => onDesconectar(i.proveedor)}>
                        Desconectar
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
