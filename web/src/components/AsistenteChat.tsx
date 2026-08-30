"use client";

import { useEffect, useRef, useState } from "react";
import type { MensajeAsistente } from "@bitacora/shared";
import { apiFetch } from "@/lib/api";
import { IconArrowRight, IconChat, IconPanelRight, IconX } from "./icons";

function idTemporal() {
  return `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

type ModoAsistente = "burbuja" | "panel";
const CLAVE_MODO = "bitacora:asistente-modo";
// Mismo corte que usa el sidebar del dashboard para su versión móvil
// (ver DashboardShell, clases sm:hidden) — en mobile el modo panel no
// tiene sentido, así que se ignora la preferencia guardada.
const MEDIA_QUERY_MOBILE = "(max-width: 639px)";

export function AsistenteChat() {
  const [abierto, setAbierto] = useState(false);
  const [modo, setModo] = useState<ModoAsistente>("burbuja");
  const [esMobile, setEsMobile] = useState(false);
  const [cargado, setCargado] = useState(false);
  const [mensajes, setMensajes] = useState<MensajeAsistente[]>([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (listaRef.current) listaRef.current.scrollTop = listaRef.current.scrollHeight;
  }, [mensajes, enviando]);

  useEffect(() => {
    const guardado = window.localStorage.getItem(CLAVE_MODO);
    if (guardado === "panel") setModo("panel");
  }, []);

  useEffect(() => {
    const mq = window.matchMedia(MEDIA_QUERY_MOBILE);
    setEsMobile(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setEsMobile(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  function alternarModo() {
    const nuevo: ModoAsistente = modo === "burbuja" ? "panel" : "burbuja";
    setModo(nuevo);
    window.localStorage.setItem(CLAVE_MODO, nuevo);
  }

  // En mobile siempre burbuja/modal, sin importar lo guardado.
  const modoEfectivo: ModoAsistente = esMobile ? "burbuja" : modo;

  async function abrir() {
    setAbierto(true);
    if (!cargado) {
      const res = await apiFetch("/api/asistente");
      if (res.ok) setMensajes(await res.json());
      setCargado(true);
    }
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  async function enviar() {
    const contenido = texto.trim();
    if (!contenido || enviando) return;
    setTexto("");
    setError(null);

    const mensajeUsuario: MensajeAsistente = {
      id: idTemporal(),
      empresa_id: "",
      usuario_id: "",
      rol: "user",
      contenido,
      creado_en: new Date().toISOString(),
    };
    setMensajes((prev) => [...prev, mensajeUsuario]);
    setEnviando(true);

    const res = await apiFetch("/api/asistente/mensaje", {
      method: "POST",
      body: JSON.stringify({ mensaje: contenido }),
    });
    setEnviando(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "No se pudo enviar el mensaje");
      return;
    }
    const respuesta: MensajeAsistente = await res.json();
    setMensajes((prev) => [...prev, respuesta]);
  }

  async function limpiar() {
    if (!window.confirm("¿Limpiar toda la conversación?")) return;
    const res = await apiFetch("/api/asistente", { method: "DELETE" });
    if (res.ok) setMensajes([]);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      enviar();
    }
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={abrir}
        aria-label="Abrir asistente"
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-brand text-brand-foreground shadow-lg transition-transform hover:scale-105 print:hidden"
      >
        <IconChat className="h-6 w-6" />
      </button>
    );
  }

  const esPanel = modoEfectivo === "panel";

  return (
    <div
      className={
        esPanel
          ? "fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col overflow-hidden border-l border-border bg-surface shadow-2xl print:hidden"
          : "fixed bottom-6 right-6 z-50 flex h-[32rem] w-[23rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl print:hidden"
      }
    >
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-soft text-brand">
            <IconChat className="h-4 w-4" />
          </span>
          <span className="text-sm font-semibold text-foreground">Asistente</span>
        </div>
        <div className="flex items-center gap-1">
          {!esMobile && (
            <button
              type="button"
              onClick={alternarModo}
              aria-label={esPanel ? "Cambiar a modo burbuja" : "Cambiar a modo panel"}
              title={esPanel ? "Modo burbuja" : "Modo panel"}
              className="rounded-md p-1.5 text-muted hover:bg-brand-soft hover:text-brand"
            >
              <IconPanelRight className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={limpiar}
            className="rounded-md px-2 py-1 text-xs font-medium text-muted hover:bg-brand-soft hover:text-brand"
          >
            Limpiar
          </button>
          <button
            type="button"
            onClick={() => setAbierto(false)}
            aria-label="Cerrar asistente"
            className="rounded-md p-1.5 text-muted hover:bg-brand-soft hover:text-brand"
          >
            <IconX className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div ref={listaRef} className="flex flex-1 flex-col gap-2.5 overflow-y-auto px-4 py-3">
        {mensajes.length === 0 && !enviando && (
          <p className="mt-6 text-center text-sm text-muted">
            Pregúntame lo que quieras sobre tu negocio — ingresos, gastos, clientes, órdenes de servicio…
          </p>
        )}
        {mensajes.map((m) => (
          <div
            key={m.id}
            className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
              m.rol === "user"
                ? "self-end rounded-br-sm bg-brand text-brand-foreground"
                : "self-start rounded-bl-sm bg-brand-soft text-foreground"
            }`}
          >
            {m.contenido}
          </div>
        ))}
        {enviando && (
          <div className="self-start rounded-2xl rounded-bl-sm bg-brand-soft px-3.5 py-2 text-sm text-muted">
            Pensando…
          </div>
        )}
      </div>

      {error && <p className="px-4 pb-1 text-xs text-danger">{error}</p>}

      <div className="flex items-center gap-2 border-t border-border p-3">
        <input
          ref={inputRef}
          type="text"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Escribe tu pregunta…"
          disabled={enviando}
          className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        />
        <button
          type="button"
          onClick={enviar}
          disabled={enviando || !texto.trim()}
          aria-label="Enviar"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand text-brand-foreground transition-opacity disabled:opacity-40"
        >
          <IconArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
