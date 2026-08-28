"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Cliente, Equipo } from "@bitacora/shared";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { DashboardShell, type UsuarioShell } from "@/components/DashboardShell";
import { Badge, Button, Card, ErrorText, Input, Label, PageHeader, Select, SuccessText } from "@/components/ui";
import { IconPlus, IconWrench } from "@/components/icons";

type EquipoConCliente = Equipo & { cliente: Pick<Cliente, "id" | "nombre"> | null };
type Filtro = "todos" | "activos" | "inactivos";

export default function EquiposPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<UsuarioShell | null>(null);
  const [equipos, setEquipos] = useState<EquipoConCliente[] | null>(null);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");

  const [formAbierto, setFormAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [clienteId, setClienteId] = useState("");
  const [nombre, setNombre] = useState("");
  const [marca, setMarca] = useState("");
  const [modelo, setModelo] = useState("");
  const [numeroSerie, setNumeroSerie] = useState("");
  const [categoria, setCategoria] = useState("");

  function abrirNuevo() {
    setEditandoId(null);
    setClienteId("");
    setNombre("");
    setMarca("");
    setModelo("");
    setNumeroSerie("");
    setCategoria("");
    setFormError(null);
    setFormAbierto(true);
  }

  function abrirEdicion(e: EquipoConCliente) {
    setEditandoId(e.id);
    setClienteId(e.cliente_id);
    setNombre(e.nombre);
    setMarca(e.marca ?? "");
    setModelo(e.modelo ?? "");
    setNumeroSerie(e.numero_serie ?? "");
    setCategoria(e.categoria ?? "");
    setFormError(null);
    setFormAbierto(true);
  }

  async function onAlternarActivo(e: EquipoConCliente) {
    const res = await apiFetch(`/api/equipos/${e.id}`, { method: "PATCH", body: JSON.stringify({ activo: !e.activo }) });
    if (res.ok) cargar();
  }

  async function cargar() {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      router.replace("/login");
      return;
    }
    const [resMe, resEquipos, resClientes] = await Promise.all([
      apiFetch("/api/me"),
      apiFetch("/api/equipos"),
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
    if (!resEquipos.ok) {
      setError("No se pudieron cargar los equipos");
      return;
    }
    setEquipos(await resEquipos.json());
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setAviso(null);
    setGuardando(true);
    const body = JSON.stringify({
      cliente_id: clienteId,
      nombre,
      marca,
      modelo,
      numero_serie: numeroSerie,
      categoria,
    });
    const res = editandoId
      ? await apiFetch(`/api/equipos/${editandoId}`, { method: "PATCH", body })
      : await apiFetch("/api/equipos", { method: "POST", body });
    setGuardando(false);
    if (!res.ok) {
      const respBody = await res.json().catch(() => ({}));
      setFormError(respBody.error ?? "No se pudo guardar el equipo");
      return;
    }
    setAviso(editandoId ? "Equipo actualizado." : "Equipo creado.");
    setFormAbierto(false);
    setEditandoId(null);
    cargar();
  }

  if (!usuario) return null;

  const lista = equipos ?? [];
  const contadores = {
    todos: lista.length,
    activos: lista.filter((e) => e.activo).length,
    inactivos: lista.filter((e) => !e.activo).length,
  };

  const filtrados = lista.filter((e) => {
    const q = busqueda.trim().toLowerCase();
    if (
      q &&
      !e.nombre.toLowerCase().includes(q) &&
      !(e.marca ?? "").toLowerCase().includes(q) &&
      !(e.modelo ?? "").toLowerCase().includes(q) &&
      !(e.numero_serie ?? "").toLowerCase().includes(q) &&
      !(e.cliente?.nombre ?? "").toLowerCase().includes(q)
    ) {
      return false;
    }
    if (filtro === "activos") return e.activo;
    if (filtro === "inactivos") return !e.activo;
    return true;
  });

  const CHIPS: { valor: Filtro; etiqueta: string }[] = [
    { valor: "todos", etiqueta: "Todos" },
    { valor: "activos", etiqueta: "Activos" },
    { valor: "inactivos", etiqueta: "Inactivos" },
  ];

  return (
    <DashboardShell usuario={usuario}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <PageHeader title={`Equipos (${lista.length})`} subtitle="Gestiona los activos y maquinaria de tus clientes" />
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => alert("Importar equipos desde CSV — próximamente.")}>
            Importar Equipos
          </Button>
          <Button type="button" onClick={() => (formAbierto ? setFormAbierto(false) : abrirNuevo())} disabled={clientes.length === 0}>
            <IconPlus className="h-4 w-4" />
            Nuevo Equipo
          </Button>
        </div>
      </div>

      {clientes.length === 0 && (
        <div className="mb-6">
          <ErrorText>Registra al menos un cliente antes de agregar equipos — cada equipo debe pertenecer a uno.</ErrorText>
        </div>
      )}

      {formAbierto && (
        <Card className="mb-6">
          <h2 className="mb-4 text-sm font-semibold text-foreground">{editandoId ? "Editar equipo" : "Nuevo equipo"}</h2>
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Cliente</Label>
                <Select required value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
                  <option value="">Selecciona un cliente…</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Nombre del equipo</Label>
                <Input type="text" required value={nombre} onChange={(e) => setNombre(e.target.value)} />
              </div>
              <div>
                <Label>Marca</Label>
                <Input type="text" value={marca} onChange={(e) => setMarca(e.target.value)} />
              </div>
              <div>
                <Label>Modelo</Label>
                <Input type="text" value={modelo} onChange={(e) => setModelo(e.target.value)} />
              </div>
              <div>
                <Label>N° de serie</Label>
                <Input type="text" value={numeroSerie} onChange={(e) => setNumeroSerie(e.target.value)} />
              </div>
              <div>
                <Label>Categoría</Label>
                <Input type="text" placeholder="Vehículo, maquinaria, herramienta…" value={categoria} onChange={(e) => setCategoria(e.target.value)} />
              </div>
            </div>
            {formError && <ErrorText>{formError}</ErrorText>}
            <div className="flex gap-2">
              <Button type="submit" disabled={guardando} className="self-start">
                {guardando ? "Guardando…" : editandoId ? "Guardar cambios" : "Agregar equipo"}
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

      <div className="mb-4 flex flex-col gap-3">
        <Input type="text" placeholder="Buscar equipos..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="max-w-sm" />
        <div className="flex flex-wrap gap-2">
          {CHIPS.map((c) => (
            <button
              key={c.valor}
              type="button"
              onClick={() => setFiltro(c.valor)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                filtro === c.valor ? "border-transparent bg-brand-soft text-brand" : "border-border text-muted"
              }`}
            >
              {c.etiqueta} ({contadores[c.valor]})
            </button>
          ))}
        </div>
      </div>

      {error && <ErrorText>{error}</ErrorText>}
      {equipos === null && !error && <p className="text-sm text-muted">Cargando…</p>}

      {equipos?.length === 0 && (
        <Card>
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-soft text-brand">
              <IconWrench className="h-6 w-6" />
            </div>
            <p className="font-medium text-foreground">Ningún equipo registrado</p>
            <p className="text-sm text-muted">Registra el primer equipo de un cliente para comenzar.</p>
            <Button type="button" onClick={abrirNuevo} disabled={clientes.length === 0}>
              <IconPlus className="h-4 w-4" />
              Nuevo Equipo
            </Button>
          </div>
        </Card>
      )}

      {equipos && equipos.length > 0 && filtrados.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
          <IconWrench className="h-8 w-8 text-muted" />
          <p className="text-sm text-muted">Ningún equipo coincide con la búsqueda o el filtro.</p>
        </div>
      )}

      {filtrados.length > 0 && (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted">
                <th className="px-5 py-3 font-medium">Nombre</th>
                <th className="px-5 py-3 font-medium">Cliente</th>
                <th className="px-5 py-3 font-medium">Marca / Modelo</th>
                <th className="px-5 py-3 font-medium">Categoría</th>
                <th className="px-5 py-3 font-medium">Estado</th>
                <th className="px-5 py-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((e) => (
                <tr key={e.id} className="border-b border-border last:border-0 hover:bg-brand-soft/40">
                  <td className="px-5 py-3 font-medium text-foreground">{e.nombre}</td>
                  <td className="px-5 py-3 text-muted">{e.cliente?.nombre ?? "—"}</td>
                  <td className="px-5 py-3 text-muted">
                    {e.marca || e.modelo ? [e.marca, e.modelo].filter(Boolean).join(" / ") : "—"}
                  </td>
                  <td className="px-5 py-3 text-muted">{e.categoria ?? "—"}</td>
                  <td className="px-5 py-3">
                    <Badge value={e.activo ? "activo" : "inactivo"} />
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" onClick={() => abrirEdicion(e)}>
                        Editar
                      </Button>
                      <Button type="button" variant="ghost" onClick={() => onAlternarActivo(e)}>
                        {e.activo ? "Desactivar" : "Activar"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </DashboardShell>
  );
}
