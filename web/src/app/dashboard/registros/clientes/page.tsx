"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { MapPin, MessageCircle, Plus } from "lucide-react";
import type { Cliente } from "@bitacora/shared";
import { formatearRut, validarRut } from "@bitacora/shared";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { DashboardShell, type UsuarioShell } from "@/components/DashboardShell";
import { Button, Card, EmptyState, Input, LoadingState, StatusBadge, Table } from "@bitacora/ui/web";
import { linkWhatsapp } from "@/lib/whatsapp";

type ClienteConDatos = Cliente & { cantidad_os: number; cantidad_cotizaciones: number; ultima_actividad: string | null };

type Filtro = "todos" | "activos" | "con_cotizaciones" | "con_os" | "inactivos";

// PASO 6 (sistema de diseño) — migrado. Ver docs/design-system.md.
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
      body: JSON.stringify({
        nombre,
        rut: rut.trim() ? formatearRut(rut) : null,
        direccion,
        comuna,
        telefono,
        correo,
        fecha_nacimiento: fechaNacimiento || null,
      }),
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
      <div className="mb-ds-6 flex flex-wrap items-center justify-between gap-ds-3">
        <div>
          <p className="ds-heading text-ds-h2 text-ds-text">Clientes</p>
          <p className="mt-ds-1 font-ds-body text-ds-small text-ds-text/70">Gestiona tus clientes y revisa el historial</p>
        </div>
        <div className="flex gap-ds-2">
          <Button variante="secundario" onPress={() => alert("Importar clientes desde CSV — próximamente.")}>
            Importar Clientes
          </Button>
          <Button iconoIzq={<Plus size={16} strokeWidth={2.75} />} onPress={() => setFormAbierto((v) => !v)}>
            Nuevo Cliente
          </Button>
        </div>
      </div>

      {formAbierto && (
        <div className="mb-ds-6">
          <Card>
            <p className="mb-ds-4 font-ds-body text-ds-small font-semibold text-ds-text">Nuevo cliente</p>
            <form onSubmit={onSubmit} className="flex flex-col gap-ds-4">
              <div className="grid gap-ds-4 sm:grid-cols-2">
                <Input etiqueta="Nombre" requerido valor={nombre} onCambio={setNombre} />
                {/* Input (ds-) no tiene onBlur (solo onSubmit, que dispara con
                    Enter) — se pierde el auto-formateo "al salir del campo"
                    que tenía el Input viejo (reformatear en cada tecla
                    movería el cursor mientras se escribe). La validación
                    real (validarRut) sigue intacta en el submit del form. */}
                <Input etiqueta="RUT (opcional — habilita el login al Portal de Cliente)" placeholder="12.345.678-9" valor={rut} onCambio={setRut} />
                <Input etiqueta="Teléfono (para WhatsApp, puedes escribirlo con +56 9…)" placeholder="+56 9 1234 5678" valor={telefono} onCambio={setTelefono} />
                <Input etiqueta="Correo" tipo="email" valor={correo} onCambio={setCorreo} />
                <Input etiqueta="Dirección" requerido placeholder="Calle, número" valor={direccion} onCambio={setDireccion} />
                <Input etiqueta="Comuna" valor={comuna} onCambio={setComuna} />
                <FechaCampo etiqueta="Fecha de cumpleaños (opcional)" valor={fechaNacimiento} onCambio={setFechaNacimiento} />
              </div>
              {formError ? <p className="font-ds-body text-ds-small text-ds-accent-700">{formError}</p> : null}
              <div className="flex gap-ds-2">
                <Button tipo="submit" cargando={guardando}>
                  Agregar cliente
                </Button>
                <Button variante="ghost" onPress={() => setFormAbierto(false)}>
                  Cancelar
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
      {aviso ? <p className="mb-ds-6 font-ds-body text-ds-small font-medium text-ds-accent2-800">{aviso}</p> : null}

      <div className="mb-ds-4 flex flex-col gap-ds-3">
        <div className="max-w-sm">
          <Input placeholder="Buscar clientes..." valor={busqueda} onCambio={setBusqueda} />
        </div>
        <div className="flex flex-wrap gap-ds-2">
          {CHIPS.map((c) => (
            <button
              key={c.valor}
              type="button"
              onClick={() => setFiltro(c.valor)}
              className={`rounded-ds-pill border px-ds-3 py-1 font-ds-body text-ds-caption font-medium transition-colors ${
                filtro === c.valor ? "border-ds-brand bg-ds-brand/[0.08] text-ds-brand" : "border-ds-divider text-ds-text/70 hover:border-ds-text/30"
              }`}
            >
              {c.etiqueta} ({contadores[c.valor]})
            </button>
          ))}
        </div>
      </div>

      {error ? <p className="font-ds-body text-ds-small text-ds-accent-700">{error}</p> : null}
      {clientes === null && !error ? <LoadingState /> : null}

      {clientes?.length === 0 && (
        <EmptyState
          icono={<MapPin size={28} strokeWidth={2.75} />}
          titulo="Ningún cliente registrado"
          mensaje="Registra tu primer cliente para comenzar"
          accion={
            <Button iconoIzq={<Plus size={16} strokeWidth={2.75} />} onPress={() => setFormAbierto(true)}>
              Nuevo Cliente
            </Button>
          }
        />
      )}

      {clientes && clientes.length > 0 && filtrados.length === 0 && (
        <EmptyState icono={<MapPin size={28} strokeWidth={2.75} />} titulo="Ningún cliente coincide con la búsqueda o el filtro" />
      )}

      {filtrados.length > 0 && (
        <Table<ClienteConDatos>
          filas={filtrados}
          claveFila={(c) => c.id}
          onFilaClick={(c) => router.push(`/dashboard/registros/clientes/${c.id}`)}
          vacio={{ titulo: "Ningún cliente coincide con la búsqueda o el filtro" }}
          columnas={[
            { encabezado: "Nombre", celda: (c) => c.nombre },
            {
              encabezado: "Contacto",
              celda: (c) => (
                <>
                  {c.telefono ? <p>{c.telefono}</p> : null}
                  {c.correo ? <p className="text-ds-caption">{c.correo}</p> : null}
                  {!c.telefono && !c.correo ? "—" : null}
                </>
              ),
            },
            { encabezado: "OS", celda: (c) => c.cantidad_os },
            { encabezado: "Última actividad", celda: (c) => c.ultima_actividad ?? "—" },
            {
              encabezado: "Estado",
              celda: (c) => <StatusBadge estado={c.activo ? "activo" : "inactivo"} />,
            },
            {
              encabezado: "",
              celda: (c) =>
                c.telefono ? (
                  <a
                    href={linkWhatsapp(c.telefono)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    title="Contactar por WhatsApp"
                    className="inline-flex items-center justify-center rounded-ds-pill border border-ds-divider p-ds-2 text-ds-text/60 hover:border-ds-brand hover:text-ds-brand"
                  >
                    <MessageCircle size={16} strokeWidth={2.75} />
                  </a>
                ) : null,
            },
          ]}
        />
      )}
    </DashboardShell>
  );
}

// Input nativo type="date" — ver el mismo helper en rutas/nueva/page.tsx.
function FechaCampo({ etiqueta, valor, onCambio }: { etiqueta: string; valor: string; onCambio: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-ds-1">
      <label className="font-ds-body text-ds-caption font-medium text-ds-text/70">{etiqueta}</label>
      <input
        type="date"
        value={valor}
        onChange={(e) => onCambio(e.target.value)}
        className="h-11 w-full rounded-ds-md border border-ds-divider bg-ds-surface px-ds-3 font-ds-body text-ds-body text-ds-text transition-colors hover:border-ds-text/30 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ds-brand)]"
      />
    </div>
  );
}
