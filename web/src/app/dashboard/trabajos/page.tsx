"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Cliente, EstadoTrabajo, Trabajo, Usuario } from "@bitacora/shared";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { DashboardShell, type UsuarioShell } from "@/components/DashboardShell";
import { Modal } from "@/components/Modal";
import { ComboboxCliente } from "@/components/ComboboxCliente";
import { ComboboxResponsable } from "@/components/ComboboxResponsable";
import {
  Badge,
  Button,
  Card,
  Cifra,
  ErrorText,
  Input,
  Label,
  PageHeader,
  Select,
} from "@/components/ui";
import { IconBriefcase, IconPlus } from "@/components/icons";
import { EstadoCargando, EstadoError, EstadoVacio } from "@/components/estados";

const ESTADOS: EstadoTrabajo[] = ["en_curso", "completado", "cancelado"];
const SIN_CLIENTE_GUARDADO = "";

export default function TrabajosPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<UsuarioShell | null>(null);
  const [trabajos, setTrabajos] = useState<Trabajo[] | null>(null);
  const [equipo, setEquipo] = useState<Usuario[]>([]);
  const [clientesGuardados, setClientesGuardados] = useState<Cliente[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [formAbierto, setFormAbierto] = useState(false);

  const [clienteId, setClienteId] = useState(SIN_CLIENTE_GUARDADO);
  const [cliente, setCliente] = useState("");
  const [responsableId, setResponsableId] = useState("");
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [monto, setMonto] = useState("");
  const [ubicacion, setUbicacion] = useState("");
  const [codigo, setCodigo] = useState("");
  const [estado, setEstado] = useState<EstadoTrabajo>("completado");

  async function cargar() {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      router.replace("/login");
      return;
    }
    const [resMe, resTrabajos, resEquipo, resClientes] = await Promise.all([
      apiFetch("/api/me"),
      apiFetch("/api/trabajos"),
      apiFetch("/api/usuarios"),
      apiFetch("/api/clientes"),
    ]);
    if (resMe.ok) {
      const { usuario: u } = await resMe.json();
      if (u) setUsuario({ nombre: u.nombre, rol: u.rol, empresaNombre: u.empresa?.nombre ?? "", empresaLogoUrl: u.empresa?.logo_url ?? null, colorPrimario: u.empresa?.color_primario ?? null, colorPrimarioForeground: u.empresa?.color_primario_foreground ?? null, colorSecundario: u.empresa?.color_secundario ?? null, fuente: u.empresa?.fuente ?? null, moneda: u.empresa?.moneda ?? "CLP" });
    }
    if (resEquipo.ok) {
      const lista: Usuario[] = await resEquipo.json();
      setEquipo(lista);
      setResponsableId((actual) => actual || lista[0]?.id || "");
    }
    if (resClientes.ok) setClientesGuardados(await resClientes.json());
    if (!resTrabajos.ok) {
      setError("No se pudieron cargar los trabajos");
      return;
    }
    setTrabajos(await resTrabajos.json());
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onSeleccionarClienteGuardado(id: string) {
    setClienteId(id);
    const c = clientesGuardados.find((c) => c.id === id);
    if (c) {
      setCliente(c.nombre);
      setUbicacion(c.direccion);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setGuardando(true);
    const res = await apiFetch("/api/trabajos", {
      method: "POST",
      body: JSON.stringify({
        cliente,
        cliente_id: clienteId || undefined,
        responsable_id: responsableId || undefined,
        fecha,
        monto: Number(monto || 0),
        ubicacion,
        codigo,
        estado,
      }),
    });
    setGuardando(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setFormError(body.error ?? "No se pudo crear el trabajo");
      return;
    }
    setClienteId(SIN_CLIENTE_GUARDADO);
    setCliente("");
    setMonto("");
    setUbicacion("");
    setCodigo("");
    setEstado("completado");
    setFormAbierto(false);
    cargar();
  }

  if (!usuario) return null;

  return (
    <DashboardShell usuario={usuario}>
      <PageHeader
        title="Trabajos"
        subtitle="Registra y revisa los trabajos en terreno"
        action={
          <Button type="button" onClick={() => setFormAbierto(true)}>
            <IconPlus className="h-4 w-4" />
            Nuevo trabajo
          </Button>
        }
      />

      <Modal open={formAbierto} onClose={() => setFormAbierto(false)} title="Nuevo trabajo" wide>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Cliente guardado (opcional)</Label>
              <ComboboxCliente
                value={clienteId}
                onChange={onSeleccionarClienteGuardado}
                clientes={clientesGuardados}
                onClienteCreado={(c) => {
                  setClientesGuardados((prev) => [...prev, c]);
                  setClienteId(c.id);
                  setCliente(c.nombre);
                  setUbicacion(c.direccion);
                }}
                opcionVacia="Sin cliente guardado — solo texto"
                placeholder="Sin cliente guardado — solo texto"
              />
            </div>
            <div>
              <Label>Cliente</Label>
              <Input type="text" required value={cliente} onChange={(e) => setCliente(e.target.value)} />
            </div>
            <div>
              <Label>Responsable</Label>
              <ComboboxResponsable value={responsableId} onChange={setResponsableId} equipo={equipo} placeholder="Selecciona un responsable" />
            </div>
            <div>
              <Label>Fecha</Label>
              <Input type="date" required value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>
            <div>
              <Label>Monto</Label>
              <Input type="number" step="0.01" min="0" value={monto} onChange={(e) => setMonto(e.target.value)} />
            </div>
            <div>
              <Label>Código / n° guía</Label>
              <Input type="text" value={codigo} onChange={(e) => setCodigo(e.target.value)} />
            </div>
            <div>
              <Label>Ubicación</Label>
              <Input type="text" value={ubicacion} onChange={(e) => setUbicacion(e.target.value)} />
            </div>
            <div>
              <Label>Estado</Label>
              <Select value={estado} onChange={(e) => setEstado(e.target.value as EstadoTrabajo)}>
                {ESTADOS.map((e) => (
                  <option key={e} value={e}>
                    {e.replace("_", " ")}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          {formError && <ErrorText>{formError}</ErrorText>}
          <Button type="submit" disabled={guardando} className="self-start">
            {guardando ? "Guardando…" : "Agregar trabajo"}
          </Button>
        </form>
      </Modal>

      <div className="mt-6">
        {error && <EstadoError mensaje={error} onReintentar={cargar} />}
        {trabajos === null && !error && <EstadoCargando />}
        {trabajos?.length === 0 && (
          <EstadoVacio
            icono={IconBriefcase}
            titulo="Todavía no hay trabajos"
            mensaje="Registra el primero con el botón «Nuevo trabajo»."
          />
        )}
        {trabajos && trabajos.length > 0 && (
          <Card className="overflow-x-auto p-0">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-sunken font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
                  <th className="px-5 py-3 font-medium">Fecha</th>
                  <th className="px-5 py-3 font-medium">Cliente</th>
                  <th className="px-5 py-3 text-right font-medium">Monto</th>
                  <th className="px-5 py-3 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {trabajos.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => router.push(`/dashboard/trabajos/${t.id}`)}
                    className="cursor-pointer border-b border-border-soft last:border-0 hover:bg-surface-sunken"
                  >
                    <td className="px-5 py-3"><Cifra>{t.fecha}</Cifra></td>
                    <td className="px-5 py-3 font-medium text-foreground">{t.cliente}</td>
                    <td className="px-5 py-3 text-right"><Cifra>${t.monto.toLocaleString("es-CL")}</Cifra></td>
                    <td className="px-5 py-3">
                      <Badge value={t.estado} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </DashboardShell>
  );
}
