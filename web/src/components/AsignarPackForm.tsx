"use client";

import { useState, type FormEvent } from "react";
import type { Cliente, TipoPack } from "@bitacora/shared";
import { apiFetch } from "@/lib/api";
import { Button, Input, Select, Textarea } from "@bitacora/ui/web";
import { InputMonto } from "@/components/InputMonto";
import { ComboboxCliente } from "@/components/ComboboxCliente";
import { formatMoneda } from "@/lib/formatMoneda";

/**
 * Form para asignar/vender un pack a un cliente = crear una INSTANCIA en
 * paquetes_sesiones. Compartido entre "Paquetes de sesiones" (elige
 * cliente) y la ficha del cliente (cliente fijo) — que no se desvíen.
 *
 * Si `clienteId` viene, el cliente está fijo y no se muestra el selector.
 *
 * PASO 6 (sistema de diseño) — migrado. Ver docs/design-system.md.
 */
export function AsignarPackForm({
  clienteId: clienteIdFijo,
  clientes,
  onClienteCreado,
  tiposPack,
  moneda,
  inicial,
  onAsignado,
  onCancelar,
}: {
  clienteId?: string;
  clientes?: Cliente[];
  onClienteCreado?: (c: Cliente) => void;
  tiposPack: TipoPack[];
  moneda: string;
  // Valores de arranque — lo usa "Renovar pack": precarga el mismo
  // tipo/nombre/cantidad/precio del pack agotado.
  inicial?: { tipoPackId?: string; nombre?: string; cantidadTotal?: number; precioPagado?: string };
  onAsignado: () => void;
  onCancelar: () => void;
}) {
  const clienteFijo = Boolean(clienteIdFijo);
  const [clienteId, setClienteId] = useState(clienteIdFijo ?? "");
  const [tipoPackId, setTipoPackId] = useState(inicial?.tipoPackId ?? "");
  const [nombre, setNombre] = useState(inicial?.nombre ?? "");
  const [cantidadTotal, setCantidadTotal] = useState(inicial?.cantidadTotal ?? 5);
  const [precioPagado, setPrecioPagado] = useState(inicial?.precioPagado ?? ""); // lo realmente cobrado; "" = precio de lista
  const [notas, setNotas] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const tipoElegido = tiposPack.find((t) => t.id === tipoPackId) ?? null;

  // Elegir un tipo fija nombre/cantidad desde el catálogo (el backend
  // igual los copia autoritativamente) y precarga el precio pagado con el
  // de lista — editable para un descuento puntual.
  function elegirTipoPack(id: string) {
    setTipoPackId(id);
    const tipo = tiposPack.find((t) => t.id === id);
    if (tipo) {
      setNombre(tipo.nombre);
      setCantidadTotal(tipo.cantidad_sesiones);
      setPrecioPagado(tipo.precio !== null ? String(tipo.precio) : "");
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!clienteId) {
      setFormError("Selecciona un cliente");
      return;
    }
    // Para packs personalizados (sin tipo de catálogo) nombre/cantidad los
    // pone el form; para packs de catálogo los copia el backend.
    if (!tipoPackId && !nombre.trim()) {
      setFormError("Falta nombre");
      return;
    }
    if (!tipoPackId && (!Number.isInteger(cantidadTotal) || cantidadTotal <= 0)) {
      setFormError("La cantidad debe ser un entero mayor a 0");
      return;
    }
    const precioPagadoNumero = precioPagado.trim() ? Number(precioPagado) : null;
    if (precioPagadoNumero !== null && (Number.isNaN(precioPagadoNumero) || precioPagadoNumero < 0)) {
      setFormError("Precio pagado inválido");
      return;
    }
    setGuardando(true);
    const res = await apiFetch("/api/paquetes-sesiones", {
      method: "POST",
      body: JSON.stringify({
        cliente_id: clienteId,
        tipo_pack_id: tipoPackId || null,
        nombre,
        cantidad_total: cantidadTotal,
        precio_pagado: precioPagadoNumero,
        notas: notas || null,
      }),
    });
    setGuardando(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setFormError(body.error ?? "No se pudo asignar el pack");
      return;
    }
    onAsignado();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-ds-4">
      <div className="grid gap-ds-4 sm:grid-cols-2">
        {!clienteFijo && (
          <div className="flex flex-col gap-ds-1">
            <label className="font-ds-body text-ds-caption font-medium text-ds-text/70">Cliente</label>
            <ComboboxCliente value={clienteId} onChange={setClienteId} clientes={clientes ?? []} onClienteCreado={(c) => onClienteCreado?.(c)} />
          </div>
        )}
        {tiposPack.length > 0 && (
          <Select
            etiqueta="Tipo de pack (opcional)"
            valor={tipoPackId}
            onCambio={elegirTipoPack}
            opciones={[
              { valor: "", etiqueta: "Personalizado — completar a mano" },
              ...tiposPack.map((t) => ({ valor: t.id, etiqueta: `${t.nombre} (${t.cantidad_sesiones} sesiones)` })),
            ]}
          />
        )}
        {tipoElegido ? (
          <div className="rounded-ds-md border border-ds-divider bg-ds-text/[0.04] px-ds-3 py-ds-2 font-ds-body text-ds-caption text-ds-text/70 sm:col-span-2">
            Se copia del catálogo: <span className="font-medium text-ds-text">{tipoElegido.nombre}</span> ·{" "}
            {tipoElegido.cantidad_sesiones} sesiones
            {tipoElegido.precio !== null && ` · lista ${formatMoneda(tipoElegido.precio, moneda)}`}
            {tipoElegido.vigencia_dias !== null && ` · vence a los ${tipoElegido.vigencia_dias} días`}. Si el catálogo cambia
            después, este paquete no se ve afectado.
          </div>
        ) : (
          <>
            <Input etiqueta="Nombre del paquete" placeholder="Ej: Pack 10 sesiones" valor={nombre} onCambio={setNombre} />
            <Input
              etiqueta="Cantidad de sesiones"
              tipo="numero"
              valor={String(cantidadTotal)}
              onCambio={(v) => setCantidadTotal(Number(v) || 1)}
            />
          </>
        )}
        <div className="flex flex-col gap-ds-1">
          <label className="font-ds-body text-ds-caption font-medium text-ds-text/70">Precio pagado (opcional)</label>
          <InputMonto placeholder={tipoElegido?.precio != null ? String(tipoElegido.precio) : "0"} value={precioPagado} onChange={setPrecioPagado} moneda={moneda} />
          <p className="font-ds-body text-ds-caption text-ds-text/60">Lo realmente cobrado. Vacío = el precio de lista.</p>
        </div>
        <div className="sm:col-span-2">
          <Textarea etiqueta="Notas (opcional)" filas={2} valor={notas} onCambio={setNotas} />
        </div>
      </div>
      {formError ? <p className="font-ds-body text-ds-small text-ds-accent-700">{formError}</p> : null}
      <div className="flex gap-ds-2">
        <Button tipo="submit" cargando={guardando}>
          Asignar pack
        </Button>
        <Button variante="ghost" onPress={onCancelar}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
