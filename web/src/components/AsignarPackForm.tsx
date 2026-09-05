"use client";

import { useState, type FormEvent } from "react";
import type { Cliente, TipoPack } from "@bitacora/shared";
import { apiFetch } from "@/lib/api";
import { Button, ErrorText, Input, Label, Select, Textarea } from "@/components/ui";
import { ComboboxCliente } from "@/components/ComboboxCliente";
import { formatMoneda } from "@/lib/formatMoneda";

/**
 * Form para asignar/vender un pack a un cliente = crear una INSTANCIA en
 * paquetes_sesiones. Compartido entre "Paquetes de sesiones" (elige
 * cliente) y la ficha del cliente (cliente fijo) — que no se desvíen.
 *
 * Si `clienteId` viene, el cliente está fijo y no se muestra el selector.
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
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {!clienteFijo && (
          <div>
            <Label>Cliente</Label>
            <ComboboxCliente
              value={clienteId}
              onChange={setClienteId}
              clientes={clientes ?? []}
              onClienteCreado={(c) => onClienteCreado?.(c)}
            />
          </div>
        )}
        {tiposPack.length > 0 && (
          <div>
            <Label>Tipo de pack (opcional)</Label>
            <Select value={tipoPackId} onChange={(e) => elegirTipoPack(e.target.value)}>
              <option value="">Personalizado — completar a mano</option>
              {tiposPack.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre} ({t.cantidad_sesiones} sesiones)
                </option>
              ))}
            </Select>
          </div>
        )}
        {tipoElegido ? (
          <div className="sm:col-span-2 rounded-lg border border-border bg-surface-sunken px-3 py-2 text-xs text-muted">
            Se copia del catálogo: <span className="font-medium text-foreground">{tipoElegido.nombre}</span> ·{" "}
            {tipoElegido.cantidad_sesiones} sesiones
            {tipoElegido.precio !== null && ` · lista ${formatMoneda(tipoElegido.precio, moneda)}`}
            {tipoElegido.vigencia_dias !== null && ` · vence a los ${tipoElegido.vigencia_dias} días`}. Si el catálogo cambia
            después, este paquete no se ve afectado.
          </div>
        ) : (
          <>
            <div>
              <Label>Nombre del paquete</Label>
              <Input type="text" placeholder="Ej: Pack 10 sesiones" value={nombre} onChange={(e) => setNombre(e.target.value)} />
            </div>
            <div>
              <Label>Cantidad de sesiones</Label>
              <Input type="number" min={1} value={cantidadTotal} onChange={(e) => setCantidadTotal(Number(e.target.value) || 1)} />
            </div>
          </>
        )}
        <div>
          <Label>Precio pagado (opcional)</Label>
          <Input
            type="number"
            min={0}
            placeholder={tipoElegido?.precio != null ? String(tipoElegido.precio) : "0"}
            value={precioPagado}
            onChange={(e) => setPrecioPagado(e.target.value)}
          />
          <p className="mt-1 text-xs text-muted">Lo realmente cobrado. Vacío = el precio de lista.</p>
        </div>
        <div className="sm:col-span-2">
          <Label>Notas (opcional)</Label>
          <Textarea rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} />
        </div>
      </div>
      {formError && <ErrorText>{formError}</ErrorText>}
      <div className="flex gap-2">
        <Button type="submit" disabled={guardando} className="self-start">
          {guardando ? "Guardando…" : "Asignar pack"}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancelar}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
