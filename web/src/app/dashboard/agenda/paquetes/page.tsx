"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Cliente, PaqueteSesionesConSaldo, TipoPack } from "@bitacora/shared";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { DashboardShell, type UsuarioShell } from "@/components/DashboardShell";
import { Badge, Button, Card, ErrorText, Input, Label, PageHeader, Select, SuccessText, Textarea } from "@/components/ui";
import { ComboboxCliente } from "@/components/ComboboxCliente";
import { formatMoneda } from "@/lib/formatMoneda";
import { IconBox, IconPlus } from "@/components/icons";
import { EstadoCargando, EstadoVacio } from "@/components/estados";

type PaqueteListado = PaqueteSesionesConSaldo & { cliente: { nombre: string } | null };

export default function PaquetesSesionesPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<UsuarioShell | null>(null);
  const [paquetes, setPaquetes] = useState<PaqueteListado[] | null>(null);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [tiposPack, setTiposPack] = useState<TipoPack[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");

  const [formAbierto, setFormAbierto] = useState(false);
  const [clienteId, setClienteId] = useState("");
  const [tipoPackId, setTipoPackId] = useState("");
  const [nombre, setNombre] = useState("");
  const [cantidadTotal, setCantidadTotal] = useState(5);
  const [precioPagado, setPrecioPagado] = useState(""); // lo realmente cobrado; "" = precio de lista
  const [notas, setNotas] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  async function cargar() {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      router.replace("/login");
      return;
    }
    const [resMe, resPaquetes, resClientes, resTiposPack] = await Promise.all([
      apiFetch("/api/me"),
      apiFetch("/api/paquetes-sesiones"),
      apiFetch("/api/clientes"),
      apiFetch("/api/tipos-pack?activo=1"),
    ]);
    if (resMe.ok) {
      const { usuario: u } = await resMe.json();
      if (u)
        setUsuario({
          nombre: u.nombre,
          rol: u.rol,
          empresaNombre: u.empresa?.nombre ?? "",
          empresaLogoUrl: u.empresa?.logo_url ?? null,
          colorPrimario: u.empresa?.color_primario ?? null,
          colorPrimarioForeground: u.empresa?.color_primario_foreground ?? null,
          colorSecundario: u.empresa?.color_secundario ?? null,
          fuente: u.empresa?.fuente ?? null,
          moneda: u.empresa?.moneda ?? "CLP",
        });
    }
    if (resClientes.ok) setClientes(await resClientes.json());
    if (resTiposPack.ok) setTiposPack(await resTiposPack.json());
    if (!resPaquetes.ok) {
      setError("No se pudieron cargar los paquetes de sesiones");
      return;
    }
    setPaquetes(await resPaquetes.json());
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function abrirNuevo() {
    setClienteId("");
    setTipoPackId("");
    setNombre("");
    setCantidadTotal(5);
    setPrecioPagado("");
    setNotas("");
    setFormError(null);
    setFormAbierto(true);
  }

  const tipoElegido = tiposPack.find((t) => t.id === tipoPackId) ?? null;

  // Elegir un tipo de pack fija nombre/cantidad desde el catálogo (el
  // backend igual los copia autoritativamente) y precarga el precio
  // pagado con el de lista — editable para un descuento puntual.
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
    // Para packs personalizados (sin tipo de catálogo) el nombre/cantidad
    // los pone el form; para packs de catálogo los copia el backend.
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
      setFormError(body.error ?? "No se pudo crear el paquete");
      return;
    }
    setFormAbierto(false);
    setAviso("Paquete creado.");
    cargar();
  }

  const filtrados = useMemo(() => {
    if (!paquetes) return [];
    const q = busqueda.trim().toLowerCase();
    if (!q) return paquetes;
    return paquetes.filter((p) => p.nombre.toLowerCase().includes(q) || (p.cliente?.nombre ?? "").toLowerCase().includes(q));
  }, [paquetes, busqueda]);

  if (!usuario) return null;

  return (
    <DashboardShell usuario={usuario}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <PageHeader title="Paquetes de sesiones" subtitle="Packs de sesiones vendidos a tus clientes — Agenda Pro" />
        <Button type="button" onClick={abrirNuevo}>
          <IconPlus className="h-4 w-4" />
          Nuevo Paquete
        </Button>
      </div>

      {formAbierto && (
        <Card className="mb-6">
          <h2 className="mb-4 text-sm font-semibold text-foreground">Nuevo paquete</h2>
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Cliente</Label>
                <ComboboxCliente
                  value={clienteId}
                  onChange={setClienteId}
                  clientes={clientes}
                  onClienteCreado={(c) => setClientes((prev) => [...prev, c])}
                />
              </div>
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
                  {tipoElegido.precio !== null && ` · lista ${formatMoneda(tipoElegido.precio, usuario.moneda)}`}
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
                {guardando ? "Guardando…" : "Crear paquete"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setFormAbierto(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      )}

      {aviso && (
        <div className="mb-6">
          <SuccessText>{aviso}</SuccessText>
        </div>
      )}

      <div className="mb-4">
        <Input type="text" placeholder="Buscar por cliente o nombre del paquete..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="max-w-sm" />
      </div>

      {error && <ErrorText>{error}</ErrorText>}
      {paquetes === null && !error && <EstadoCargando />}

      {paquetes?.length === 0 && (
        <EstadoVacio
          icono={IconBox}
          titulo="Ningún paquete registrado"
          mensaje="Crea el primer paquete de sesiones para un cliente"
          accion={<Button type="button" onClick={abrirNuevo}>
              <IconPlus className="h-4 w-4" />
              Nuevo Paquete
            </Button>}
        />
      )}

      {paquetes && paquetes.length > 0 && filtrados.length === 0 && (
        <EstadoVacio icono={IconBox} titulo="Ningún paquete coincide con la búsqueda" />
      )}

      {filtrados.length > 0 && (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-sunken font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
                <th className="px-5 py-3 font-medium">Cliente</th>
                <th className="px-5 py-3 font-medium">Paquete</th>
                <th className="px-5 py-3 font-medium">Saldo</th>
                <th className="px-5 py-3 font-medium">Cobrado</th>
                <th className="px-5 py-3 font-medium">Fecha de compra</th>
                <th className="px-5 py-3 font-medium">Vence</th>
                <th className="px-5 py-3 font-medium">Notas</th>
                <th className="px-5 py-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((p) => (
                <tr key={p.id} className="border-b border-border-soft last:border-0 hover:bg-surface-sunken">
                  <td className="px-5 py-3 font-medium text-foreground">{p.cliente?.nombre ?? "—"}</td>
                  <td className="px-5 py-3 text-foreground">{p.nombre}</td>
                  <td className="px-5 py-3 text-foreground">
                    {p.saldo} / {p.cantidad_total}
                  </td>
                  <td className="px-5 py-3 text-muted">
                    {p.precio_pagado != null
                      ? formatMoneda(p.precio_pagado, usuario.moneda)
                      : p.precio != null
                        ? formatMoneda(p.precio, usuario.moneda)
                        : "—"}
                  </td>
                  <td className="px-5 py-3 text-muted">{new Date(`${p.fecha_compra}T00:00:00`).toLocaleDateString("es-CL")}</td>
                  <td className="px-5 py-3 text-muted">
                    {p.vence_el ? new Date(`${p.vence_el}T00:00:00`).toLocaleDateString("es-CL") : "No vence"}
                  </td>
                  <td className="px-5 py-3 text-muted">{p.notas || "—"}</td>
                  <td className="px-5 py-3">
                    <Badge value={p.saldo <= 0 ? "agotado" : "disponible"} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <p className="mt-4 text-xs text-muted">
        El saldo se calcula a partir de las citas activas de cada paquete — no es un contador editable a mano. Para consumir sesiones
        de un paquete, asígnalo desde el formulario de una tarea en{" "}
        <Link href="/dashboard/agenda" className="font-medium text-brand hover:underline">
          Agenda
        </Link>
        .
      </p>
    </DashboardShell>
  );
}
