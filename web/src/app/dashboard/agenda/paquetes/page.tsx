"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Cliente, PaqueteSesionesConSaldo } from "@bitacora/shared";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { DashboardShell, type UsuarioShell } from "@/components/DashboardShell";
import { Badge, Button, Card, ErrorText, Input, Label, PageHeader, Select, SuccessText, Textarea } from "@/components/ui";
import { IconBox, IconPlus } from "@/components/icons";

type PaqueteListado = PaqueteSesionesConSaldo & { cliente: { nombre: string } | null };

export default function PaquetesSesionesPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<UsuarioShell | null>(null);
  const [paquetes, setPaquetes] = useState<PaqueteListado[] | null>(null);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");

  const [formAbierto, setFormAbierto] = useState(false);
  const [clienteId, setClienteId] = useState("");
  const [nombre, setNombre] = useState("");
  const [cantidadTotal, setCantidadTotal] = useState(5);
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
    const [resMe, resPaquetes, resClientes] = await Promise.all([
      apiFetch("/api/me"),
      apiFetch("/api/paquetes-sesiones"),
      apiFetch("/api/clientes"),
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
    setNombre("");
    setCantidadTotal(5);
    setNotas("");
    setFormError(null);
    setFormAbierto(true);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!clienteId) {
      setFormError("Selecciona un cliente");
      return;
    }
    if (!nombre.trim()) {
      setFormError("Falta nombre");
      return;
    }
    if (!Number.isInteger(cantidadTotal) || cantidadTotal <= 0) {
      setFormError("La cantidad debe ser un entero mayor a 0");
      return;
    }
    setGuardando(true);
    const res = await apiFetch("/api/paquetes-sesiones", {
      method: "POST",
      body: JSON.stringify({ cliente_id: clienteId, nombre, cantidad_total: cantidadTotal, notas: notas || null }),
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
                <Select value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
                  <option value="">Selecciona un cliente</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Nombre del paquete</Label>
                <Input type="text" placeholder="Ej: Pack 10 sesiones" value={nombre} onChange={(e) => setNombre(e.target.value)} />
              </div>
              <div>
                <Label>Cantidad de sesiones</Label>
                <Input type="number" min={1} value={cantidadTotal} onChange={(e) => setCantidadTotal(Number(e.target.value) || 1)} />
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
      {paquetes === null && !error && <p className="text-sm text-muted">Cargando…</p>}

      {paquetes?.length === 0 && (
        <Card>
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-soft text-brand">
              <IconBox className="h-6 w-6" />
            </div>
            <p className="font-medium text-foreground">Ningún paquete registrado</p>
            <p className="text-sm text-muted">Crea el primer paquete de sesiones para un cliente.</p>
            <Button type="button" onClick={abrirNuevo}>
              <IconPlus className="h-4 w-4" />
              Nuevo Paquete
            </Button>
          </div>
        </Card>
      )}

      {paquetes && paquetes.length > 0 && filtrados.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
          <IconBox className="h-8 w-8 text-muted" />
          <p className="text-sm text-muted">Ningún paquete coincide con la búsqueda.</p>
        </div>
      )}

      {filtrados.length > 0 && (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted">
                <th className="px-5 py-3 font-medium">Cliente</th>
                <th className="px-5 py-3 font-medium">Paquete</th>
                <th className="px-5 py-3 font-medium">Saldo</th>
                <th className="px-5 py-3 font-medium">Fecha de compra</th>
                <th className="px-5 py-3 font-medium">Notas</th>
                <th className="px-5 py-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-0 hover:bg-brand-soft/40">
                  <td className="px-5 py-3 font-medium text-foreground">{p.cliente?.nombre ?? "—"}</td>
                  <td className="px-5 py-3 text-foreground">{p.nombre}</td>
                  <td className="px-5 py-3 text-foreground">
                    {p.saldo} / {p.cantidad_total}
                  </td>
                  <td className="px-5 py-3 text-muted">{new Date(`${p.fecha_compra}T00:00:00`).toLocaleDateString("es-CL")}</td>
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
