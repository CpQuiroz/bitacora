"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus, Truck } from "lucide-react";
import type { CategoriaGasto, Proveedor } from "@bitacora/shared";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { DashboardShell, type UsuarioShell } from "@/components/DashboardShell";
import { SelectCrear } from "@/components/SelectCrear";
import { Button, Card, EmptyState, ErrorState, Input, LoadingState, StatusBadge, Table } from "@bitacora/ui/web";

type ProveedorConCategoria = Proveedor & { categoria: Pick<CategoriaGasto, "id" | "nombre" | "color"> | null };

// PASO 6 (sistema de diseño) — migrado. Ver docs/design-system.md.
export default function ProveedoresPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<UsuarioShell | null>(null);
  const [proveedores, setProveedores] = useState<ProveedorConCategoria[] | null>(null);
  const [categorias, setCategorias] = useState<CategoriaGasto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");

  const [formAbierto, setFormAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [nombre, setNombre] = useState("");
  const [razonSocial, setRazonSocial] = useState("");
  const [rut, setRut] = useState("");
  const [telefono, setTelefono] = useState("");
  const [correo, setCorreo] = useState("");
  const [categoriaGastoId, setCategoriaGastoId] = useState("");

  async function cargar() {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      router.replace("/login");
      return;
    }
    const [resMe, resProveedores, resCategorias] = await Promise.all([
      apiFetch("/api/me"),
      apiFetch("/api/proveedores"),
      apiFetch("/api/categorias-gasto"),
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
    if (resCategorias.ok) setCategorias(await resCategorias.json());
    if (!resProveedores.ok) {
      setError("No se pudieron cargar los proveedores");
      return;
    }
    setProveedores(await resProveedores.json());
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function abrirNuevo() {
    setEditandoId(null);
    setNombre("");
    setRazonSocial("");
    setRut("");
    setTelefono("");
    setCorreo("");
    setCategoriaGastoId("");
    setFormError(null);
    setFormAbierto(true);
  }

  // El campo se guarda como texto completo ("+56 9XXXXXXXX") para que
  // linkWhatsapp() y cualquier otro lector lo sigan tratando como
  // texto libre — acá solo se extraen los 8 dígitos locales para
  // precargar el input cuando el número ya tiene el formato esperado.
  function soloDigitosLocales(telefonoGuardado: string | null): string {
    if (!telefonoGuardado) return "";
    return telefonoGuardado.replace(/\D/g, "").replace(/^569/, "").slice(0, 8);
  }

  function abrirEdicion(p: ProveedorConCategoria) {
    setEditandoId(p.id);
    setNombre(p.nombre);
    setRazonSocial(p.razon_social ?? "");
    setRut(p.rut ?? "");
    setTelefono(soloDigitosLocales(p.telefono));
    setCorreo(p.correo ?? "");
    setCategoriaGastoId(p.categoria_gasto_id ?? "");
    setFormError(null);
    setFormAbierto(true);
  }

  async function onAlternarActivo(p: ProveedorConCategoria) {
    const res = await apiFetch(`/api/proveedores/${p.id}`, { method: "PATCH", body: JSON.stringify({ activo: !p.activo }) });
    if (res.ok) cargar();
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setAviso(null);
    setGuardando(true);
    const body = JSON.stringify({
      nombre,
      razon_social: razonSocial,
      rut,
      telefono: telefono ? `+56 9${telefono}` : "",
      correo,
      categoria_gasto_id: categoriaGastoId || null,
    });
    const res = editandoId
      ? await apiFetch(`/api/proveedores/${editandoId}`, { method: "PATCH", body })
      : await apiFetch("/api/proveedores", { method: "POST", body });
    setGuardando(false);
    if (!res.ok) {
      const respBody = await res.json().catch(() => ({}));
      setFormError(respBody.error ?? "No se pudo guardar el proveedor");
      return;
    }
    setAviso(editandoId ? "Proveedor actualizado." : "Proveedor creado.");
    setFormAbierto(false);
    setEditandoId(null);
    cargar();
  }

  if (!usuario) return null;

  const lista = proveedores ?? [];
  const filtrados = lista.filter((p) => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return true;
    return (
      p.nombre.toLowerCase().includes(q) ||
      (p.razon_social ?? "").toLowerCase().includes(q) ||
      (p.rut ?? "").toLowerCase().includes(q) ||
      (p.correo ?? "").toLowerCase().includes(q) ||
      (p.telefono ?? "").includes(q)
    );
  });

  return (
    <DashboardShell usuario={usuario}>
      <div className="mb-ds-6 flex flex-wrap items-center justify-between gap-ds-3">
        <div>
          <p className="ds-heading text-ds-h2 text-ds-text">Proveedores</p>
          <p className="mt-ds-1 font-ds-body text-ds-small text-ds-text/70">Gestiona tus proveedores y contactos</p>
        </div>
        <Button iconoIzq={<Plus size={16} strokeWidth={2.75} />} onPress={() => (formAbierto ? setFormAbierto(false) : abrirNuevo())}>
          Nuevo Proveedor
        </Button>
      </div>

      {formAbierto && (
        <div className="mb-ds-6">
          <Card>
            <p className="mb-ds-4 font-ds-body text-ds-small font-semibold text-ds-text">{editandoId ? "Editar proveedor" : "Nuevo proveedor"}</p>
            <form onSubmit={onSubmit} className="flex flex-col gap-ds-4">
              <div className="grid gap-ds-4 sm:grid-cols-2">
                <Input etiqueta="Nombre" requerido valor={nombre} onCambio={setNombre} />
                <Input etiqueta="Razón social" valor={razonSocial} onCambio={setRazonSocial} />
                <Input etiqueta="RUT" placeholder="12.345.678-9" valor={rut} onCambio={setRut} />
                <div className="flex flex-col gap-ds-1">
                  <label className="font-ds-body text-ds-caption font-medium text-ds-text/70">Categoría de gasto</label>
                  <SelectCrear
                    value={categoriaGastoId}
                    onChange={setCategoriaGastoId}
                    opciones={categorias}
                    endpoint="/api/categorias-gasto"
                    placeholder="Sin categoría"
                    etiquetaCrear="+ Crear categoría"
                    onCreado={(nueva) => setCategorias((prev) => [...prev, nueva])}
                  />
                </div>
                <div className="flex flex-col gap-ds-1">
                  <label className="font-ds-body text-ds-caption font-medium text-ds-text/70">Teléfono</label>
                  <div className="flex items-center gap-ds-2">
                    <span className="shrink-0 rounded-ds-pill border border-ds-divider bg-ds-surface px-ds-3 py-2.5 font-ds-body text-ds-small text-ds-text/60">+56 9</span>
                    <Input tipo="tel" placeholder="1234 5678" maxLongitud={8} valor={telefono} onCambio={(v) => setTelefono(v.replace(/\D/g, "").slice(0, 8))} />
                  </div>
                </div>
                <Input etiqueta="Correo" tipo="email" valor={correo} onCambio={setCorreo} />
              </div>
              {formError ? <p className="font-ds-body text-ds-small text-ds-accent-700">{formError}</p> : null}
              <div className="flex gap-ds-2">
                <Button tipo="submit" cargando={guardando}>
                  {editandoId ? "Guardar cambios" : "Agregar proveedor"}
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

      <div className="mb-ds-4 max-w-sm">
        <Input placeholder="Buscar proveedores..." valor={busqueda} onCambio={setBusqueda} />
      </div>

      {error ? <ErrorState mensaje={error} /> : null}
      {proveedores === null && !error ? <LoadingState /> : null}

      {proveedores?.length === 0 && (
        <EmptyState
          icono={<Truck size={28} strokeWidth={2.75} />}
          titulo="Ningún proveedor registrado"
          mensaje="Registra tu primer proveedor para comenzar"
          accion={
            <Button iconoIzq={<Plus size={16} strokeWidth={2.75} />} onPress={abrirNuevo}>
              Nuevo Proveedor
            </Button>
          }
        />
      )}

      {proveedores && proveedores.length > 0 && filtrados.length === 0 && (
        <EmptyState icono={<Truck size={28} strokeWidth={2.75} />} titulo="Ningún proveedor coincide con la búsqueda" />
      )}

      {filtrados.length > 0 && (
        <Table<ProveedorConCategoria>
          filas={filtrados}
          claveFila={(p) => p.id}
          vacio={{ titulo: "Ningún proveedor coincide con la búsqueda" }}
          columnas={[
            { encabezado: "Nombre", celda: (p) => p.nombre },
            { encabezado: "Razón social", celda: (p) => p.razon_social || "—" },
            { encabezado: "RUT", celda: (p) => p.rut || "—" },
            {
              encabezado: "Contacto",
              celda: (p) => (
                <>
                  {p.telefono ? <p>{p.telefono}</p> : null}
                  {p.correo ? <p className="text-ds-caption">{p.correo}</p> : null}
                  {!p.telefono && !p.correo ? "—" : null}
                </>
              ),
            },
            {
              encabezado: "Categoría",
              celda: (p) =>
                p.categoria ? (
                  <span className="inline-flex items-center gap-1.5 text-ds-caption font-medium" style={{ color: p.categoria.color }}>
                    <span className="h-2 w-2 rounded-ds-pill" style={{ backgroundColor: p.categoria.color }} />
                    {p.categoria.nombre}
                  </span>
                ) : (
                  <span className="text-ds-text/60">—</span>
                ),
            },
            { encabezado: "Estado", celda: (p) => <StatusBadge estado={p.activo ? "activo" : "inactivo"} /> },
            {
              encabezado: "Acciones",
              celda: (p) => (
                <div className="flex gap-ds-2">
                  <Button variante="secundario" onPress={() => abrirEdicion(p)}>
                    Editar
                  </Button>
                  <Button variante="ghost" onPress={() => onAlternarActivo(p)}>
                    {p.activo ? "Desactivar" : "Activar"}
                  </Button>
                </div>
              ),
            },
          ]}
        />
      )}
    </DashboardShell>
  );
}
