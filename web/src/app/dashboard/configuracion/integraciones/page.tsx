"use client";

import { useCallback, useEffect, useState } from "react";
import { CreditCard, MessageCircle, Sparkles } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Button, Card, Input, LoadingState, StatusBadge } from "@bitacora/ui/web";

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

const ICONO_CATEGORIA = { pagos: CreditCard, comunicacion: MessageCircle, ia: Sparkles };

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

// PASO 6 (sistema de diseño) — migrado. Ver docs/design-system.md.
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
    if (res.ok) {
      const todas: IntegracionPublica[] = await res.json();
      // "Anthropic Claude API" no se oculta acá porque esté rota — el
      // backend ya la usa globalmente vía ANTHROPIC_API_KEY (.env), no
      // por-empresa como el resto de esta pantalla. Mostrarla decía
      // "No conectado" de forma confusa aunque la IA funcione en toda
      // la app. Se saca del listado (no se borra del backend/DEFINICIONES
      // en integraciones.ts) hasta que decidamos si esta pantalla pasa a
      // reflejar también integraciones globales o si esta se documenta
      // en otro lado.
      setIntegraciones(todas.filter((i) => i.proveedor !== "anthropic"));
    }
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
    <div className="flex flex-col gap-ds-6">
      <div className="flex flex-wrap items-center justify-between gap-ds-3">
        <div>
          <p className="ds-heading text-ds-h3 text-ds-text">Integraciones</p>
          <p className="mt-ds-1 font-ds-body text-ds-small text-ds-text/70">Pagos, comunicación e IA</p>
        </div>
        <span className="font-ds-body text-ds-small font-medium text-ds-text/70">{conectadas} conectadas</span>
      </div>

      <div className="flex flex-wrap gap-ds-2">
        {CATEGORIAS.map((c) => (
          <button
            key={c.valor}
            type="button"
            onClick={() => setCategoria(c.valor)}
            className={`rounded-ds-pill border px-ds-3 py-1 font-ds-body text-ds-caption font-medium transition-colors ${
              categoria === c.valor ? "border-ds-brand bg-ds-brand/[0.08] text-ds-brand" : "border-ds-divider text-ds-text/70 hover:border-ds-text/30"
            }`}
          >
            {c.etiqueta}
          </button>
        ))}
      </div>

      {integraciones === null && <LoadingState />}

      <div className="grid gap-ds-4 sm:grid-cols-2">
        {filtradas.map((i) => {
          const Icono = ICONO_CATEGORIA[i.categoria];
          const estaAbierta = abierta === i.proveedor;
          return (
            <div key={i.proveedor} className={estaAbierta ? "sm:col-span-2" : undefined}>
              <Card>
                <div className="flex items-start gap-ds-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-ds-lg bg-ds-brand/[0.08] text-ds-brand">
                    <Icono size={20} strokeWidth={2.75} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-ds-2">
                      <p className="font-medium text-ds-text">{i.nombre}</p>
                      <StatusBadge estado={i.conectado ? "conectado" : "no_conectado"} etiqueta={i.conectado ? "Conectado" : "No conectado"} />
                    </div>
                    <p className="mt-ds-1 font-ds-body text-ds-small text-ds-text/70">{i.descripcion}</p>
                    {i.preview && <p className="mt-ds-1 font-ds-body text-ds-caption text-ds-text/60">Guardado: {i.preview}</p>}
                    <button type="button" onClick={() => abrir(i)} className="mt-ds-2 font-ds-body text-ds-caption font-medium text-ds-brand hover:underline">
                      {estaAbierta ? "Cerrar" : "Clic para configurar"}
                    </button>
                  </div>
                </div>

                {estaAbierta && (
                  <div className="mt-ds-4 border-t border-ds-divider pt-ds-4">
                    <div className="grid gap-ds-3 sm:grid-cols-2">
                      {i.campos.map((campo) => (
                        <Input
                          key={campo}
                          etiqueta={ETIQUETA_CAMPO[campo] ?? campo}
                          tipo={campo.includes("json") ? "texto" : "password"}
                          placeholder={i.preview && campo === i.campos[i.campos.length - 1] ? i.preview : undefined}
                          valor={campos[campo] ?? ""}
                          onCambio={(v) => setCampos((prev) => ({ ...prev, [campo]: v }))}
                        />
                      ))}
                    </div>
                    {mensaje ? (
                      <p className={`mt-ds-3 font-ds-body text-ds-small ${mensaje.tipo === "ok" ? "text-ds-accent2-800" : "text-ds-accent-700"}`}>{mensaje.texto}</p>
                    ) : null}
                    <div className="mt-ds-4 flex flex-wrap gap-ds-3">
                      <Button onPress={() => onGuardar(i.proveedor)} cargando={guardando}>
                        Guardar
                      </Button>
                      <Button variante="secundario" onPress={() => onProbar(i.proveedor)} deshabilitado={probando || !i.preview}>
                        {probando ? "Probando…" : "Probar conexión"}
                      </Button>
                      {i.conectado && (
                        <Button variante="ghost" onPress={() => onDesconectar(i.proveedor)}>
                          Desconectar
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            </div>
          );
        })}
      </div>
    </div>
  );
}
