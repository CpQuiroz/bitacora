"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Cliente } from "@bitacora/shared";
import { formatearRut, validarRut } from "@bitacora/shared";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { DashboardShell, type UsuarioShell } from "@/components/DashboardShell";
import { Badge, Button, Card, ErrorText, Input, Label, PageHeader, SuccessText } from "@/components/ui";
import { IconChat, IconMapPin, IconPlus } from "@/components/icons";
import { EstadoCargando, EstadoVacio } from "@/components/estados";
import { linkWhatsapp } from "@/lib/whatsapp";

type ClienteConDatos = Cliente & { cantidad_os: number; cantidad_cotizaciones: number; ultima_actividad: string | null };

type Filtro = "todos" | "activos" | "con_cotizaciones" | "con_os" | "inactivos";

export default function ClientesPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<UsuarioShell | null>(null);
  const [clientes, setClientes] = useState<ClienteConDatos[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");

  const [formAbierto, setFormAbierto] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [nombre, setNombre] = useState("");
  const [rut, setRut] = useState("");
  const [direccion, setDireccion] = useState("");
  const [comuna, setComuna] = useState("");
  const [telefono, setTelefono] = useState("");
  const [correo, setCorreo] = useState("");
  const [fechaNacimiento, setFechaNacimiento] = useState("");

  async function cargar() {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      router.replace("/login");
      return;
    }
    const [resMe, resClientes] = await Promise.all([apiFetch("/api/me"), apiFetch("/api/clientes")]);
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
    if (!resClientes.ok) {
      setError("No se pudieron cargar los clientes");
      return;
    }
    setClientes(await resClientes.json());
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setAviso(null);
    if (rut.trim() && !validarRut(rut)) {
      setFormError("El RUT no es válido (revisa el dígito verificador)");
      return;
    }
    setGuardando(true);
    const res = await apiFetch("/api/clientes", {
      method: "POST",
      body: JSON.stringify({ nombre, rut: rut.trim() || null, direccion, comuna, telefono, correo, fecha_nacimiento: fechaNacimiento || null }),
    });
    setGuardando(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setFormError(body.error ?? "No se pudo crear el cliente");
      return;
    }
    const nuevo = await res.json();
    setAviso(
      nuevo.geocodificado
        ? "Cliente creado y ubicado en el mapa."
        : "Cliente creado, pero no encontramos esa dirección en el mapa — revisa que esté bien escrita."
    );
    setNombre("");
    setRut("");
    setDireccion("");
    setComuna("");
    setTelefono("");
    setCorreo("");
    setFechaNacimiento("");
    setFormAbierto(false);
    cargar();
  }

  if (!usuario) return null;

  const lista = clientes ?? [];
  const contadores = {
    todos: lista.length,
    activos: lista.filter((c) => c.activo).length,
    con_cotizaciones: lista.filter((c) => c.cantidad_cotizaciones > 0).length,
    con_os: lista.filter((c) => c.cantidad_os > 0).length,
    inactivos: lista.filter((c) => !c.activo).length,
  };

  const filtrados = lista.filter((c) => {
    const q = busqueda.trim().toLowerCase();
    if (q && !c.nombre.toLowerCase().includes(q) && !(c.correo ?? "").toLowerCase().includes(q) && !(c.telefono ?? "").includes(q)) {
      return false;
    }
    if (filtro === "activos") return c.activo;
    if (filtro === "inactivos") return !c.activo;
    if (filtro === "con_cotizaciones") return c.cantidad_cotizaciones > 0;
    if (filtro === "con_os") return c.cantidad_os > 0;
    return true;
  });

  const CHIPS: { valor: Filtro; etiqueta: string }[] = [
    { valor: "todos", etiqueta: "Todos" },
    { valor: "activos", etiqueta: "Activos" },
    { valor: "con_cotizaciones", etiqueta: "Con Cotizaciones" },
    { valor: "con_os", etiqueta: "Con OS" },
    { valor: "inactivos", etiqueta: "Inactivos" },
  ];

  return (
    <DashboardShell usuario={usuario}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <PageHeader title="Clientes" subtitle="Gestiona tus clientes y revisa el historial" />
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => alert("Importar clientes desde CSV — próximamente.")}>
            Importar Clientes
          </Button>
          <Button type="button" onClick={() => setFormAbierto((v) => !v)}>
            <IconPlus className="h-4 w-4" />
            Nuevo Cliente
          </Button>
        </div>
      </div>

      {formAbierto && (
        <Card className="mb-6">
          <h2 className="mb-4 text-sm font-semibold text-foreground">Nuevo cliente</h2>
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Nombre</Label>
                <Input type="text" required value={nombre} onChange={(e) => setNombre(e.target.value)} />
              </div>
              <div>
                <Label>RUT (opcional — habilita el login al Portal de Cliente)</Label>
                <Input
                  type="text"
                  placeholder="12.345.678-9"
                  value={rut}
                  onChange={(e) => setRut(e.target.value)}
                  onBlur={() => rut.trim() && validarRut(rut) && setRut(formatearRut(rut))}
                />
              </div>
              <div>
                <Label>Teléfono (para WhatsApp, puedes escribirlo con +56 9…)</Label>
                <Input type="text" placeholder="+56 9 1234 5678" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
              </div>
              <div>
                <Label>Correo</Label>
                <Input type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} />
              </div>
              <div>
                <Label>Dirección</Label>
                <Input
                  type="text"
                  required
                  placeholder="Calle, número"
                  value={direccion}
                  onChange={(e) => setDireccion(e.target.value)}
                />
              </div>
              <div>
                <Label>Comuna</Label>
                <Input type="text" value={comuna} onChange={(e) => setComuna(e.target.value)} />
              </div>
              <div>
                <Label>Fecha de cumpleaños (opcional)</Label>
                <Input type="date" value={fechaNacimiento} onChange={(e) => setFechaNacimiento(e.target.value)} />
              </div>
            </div>
            {formError && <ErrorText>{formError}</ErrorText>}
            <div className="flex gap-2">
              <Button type="submit" disabled={guardando} className="self-start">
                {guardando ? "Ubicando en el mapa…" : "Agregar cliente"}
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
        <Input type="text" placeholder="Buscar clientes..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="max-w-sm" />
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
      {clientes === null && !error && <EstadoCargando />}

      {clientes?.length === 0 && (
        <Card>
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-soft text-brand">
              <IconMapPin className="h-6 w-6" />
            </div>
            <p className="font-medium text-foreground">Ningún cliente registrado</p>
            <p className="text-sm text-muted">Registra tu primer cliente para comenzar.</p>
            <Button type="button" onClick={() => setFormAbierto(true)}>
              <IconPlus className="h-4 w-4" />
              Nuevo Cliente
            </Button>
          </div>
        </Card>
      )}

      {clientes && clientes.length > 0 && filtrados.length === 0 && (
        <EstadoVacio icono={IconMapPin} titulo="Ningún cliente coincide con la búsqueda o el filtro" />
      )}

      {filtrados.length > 0 && (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted">
                <th className="px-5 py-3 font-medium">Nombre</th>
                <th className="px-5 py-3 font-medium">Contacto</th>
                <th className="px-5 py-3 font-medium">OS</th>
                <th className="px-5 py-3 font-medium">Última actividad</th>
                <th className="px-5 py-3 font-medium">Estado</th>
                <th className="px-5 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => router.push(`/dashboard/registros/clientes/${c.id}`)}
                  className="cursor-pointer border-b border-border last:border-0 hover:bg-brand-soft/40"
                >
                  <td className="px-5 py-3 font-medium text-foreground">{c.nombre}</td>
                  <td className="px-5 py-3 text-muted">
                    {c.telefono && <p>{c.telefono}</p>}
                    {c.correo && <p className="text-xs">{c.correo}</p>}
                    {!c.telefono && !c.correo && "—"}
                  </td>
                  <td className="px-5 py-3">{c.cantidad_os}</td>
                  <td className="px-5 py-3 text-muted">{c.ultima_actividad ?? "—"}</td>
                  <td className="px-5 py-3">
                    <Badge value={c.activo ? "activo" : "inactivo"} />
                  </td>
                  <td className="px-5 py-3">
                    {c.telefono && (
                      <a
                        href={linkWhatsapp(c.telefono)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        title="Contactar por WhatsApp"
                        className="inline-flex items-center justify-center rounded-full border border-border p-2 text-muted hover:border-brand hover:text-brand"
                      >
                        <IconChat className="h-4 w-4" />
                      </a>
                    )}
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
