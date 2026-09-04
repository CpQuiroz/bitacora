"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { CategoriaGasto, Proveedor } from "@bitacora/shared";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { DashboardShell, type UsuarioShell } from "@/components/DashboardShell";
import { SelectCrear } from "@/components/SelectCrear";
import { Badge, Button, Card, ErrorText, Input, Label, PageHeader, SuccessText } from "@/components/ui";
import { IconPlus, IconTruck } from "@/components/icons";
import { EstadoCargando, EstadoVacio } from "@/components/estados";

type ProveedorConCategoria = Proveedor & { categoria: Pick<CategoriaGasto, "id" | "nombre" | "color"> | null };

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
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <PageHeader title="Proveedores" subtitle="Gestiona tus proveedores y contactos" />
        <Button type="button" onClick={() => (formAbierto ? setFormAbierto(false) : abrirNuevo())}>
          <IconPlus className="h-4 w-4" />
          Nuevo Proveedor
        </Button>
      </div>

      {formAbierto && (
        <Card className="mb-6">
          <h2 className="mb-4 text-sm font-semibold text-foreground">{editandoId ? "Editar proveedor" : "Nuevo proveedor"}</h2>
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Nombre</Label>
                <Input type="text" required value={nombre} onChange={(e) => setNombre(e.target.value)} />
              </div>
              <div>
                <Label>Razón social</Label>
                <Input type="text" value={razonSocial} onChange={(e) => setRazonSocial(e.target.value)} />
              </div>
              <div>
                <Label>RUT</Label>
                <Input type="text" placeholder="12.345.678-9" value={rut} onChange={(e) => setRut(e.target.value)} />
              </div>
              <div>
                <Label>Categoría de gasto</Label>
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
              <div>
                <Label>Teléfono</Label>
                <div className="flex items-center gap-2">
                  <span className="shrink-0 rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-muted">+56 9</span>
                  <Input
                    type="tel"
                    inputMode="numeric"
                    placeholder="1234 5678"
                    maxLength={8}
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value.replace(/\D/g, "").slice(0, 8))}
                  />
                </div>
              </div>
              <div>
                <Label>Correo</Label>
                <Input type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} />
              </div>
            </div>
            {formError && <ErrorText>{formError}</ErrorText>}
            <div className="flex gap-2">
              <Button type="submit" disabled={guardando} className="self-start">
                {guardando ? "Guardando…" : editandoId ? "Guardar cambios" : "Agregar proveedor"}
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
        <Input type="text" placeholder="Buscar proveedores..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="max-w-sm" />
      </div>

      {error && <ErrorText>{error}</ErrorText>}
      {proveedores === null && !error && <EstadoCargando />}

      {proveedores?.length === 0 && (
        <Card>
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-soft text-brand">
              <IconTruck className="h-6 w-6" />
            </div>
            <p className="font-medium text-foreground">Ningún proveedor registrado</p>
            <p className="text-sm text-muted">Registra tu primer proveedor para comenzar.</p>
            <Button type="button" onClick={abrirNuevo}>
              <IconPlus className="h-4 w-4" />
              Nuevo Proveedor
            </Button>
          </div>
        </Card>
      )}

      {proveedores && proveedores.length > 0 && filtrados.length === 0 && (
        <EstadoVacio icono={IconTruck} titulo="Ningún proveedor coincide con la búsqueda" />
      )}

      {filtrados.length > 0 && (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-sunken font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
                <th className="px-5 py-3 font-medium">Nombre</th>
                <th className="px-5 py-3 font-medium">Razón social</th>
                <th className="px-5 py-3 font-medium">RUT</th>
                <th className="px-5 py-3 font-medium">Contacto</th>
                <th className="px-5 py-3 font-medium">Categoría</th>
                <th className="px-5 py-3 font-medium">Estado</th>
                <th className="px-5 py-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((p) => (
                <tr key={p.id} className="border-b border-border-soft last:border-0 hover:bg-surface-sunken">
                  <td className="px-5 py-3 font-medium text-foreground">{p.nombre}</td>
                  <td className="px-5 py-3 text-muted">{p.razon_social || "—"}</td>
                  <td className="px-5 py-3 text-muted">{p.rut || "—"}</td>
                  <td className="px-5 py-3 text-muted">
                    {p.telefono && <p>{p.telefono}</p>}
                    {p.correo && <p className="text-xs">{p.correo}</p>}
                    {!p.telefono && !p.correo && "—"}
                  </td>
                  <td className="px-5 py-3">
                    {p.categoria ? (
                      <span
                        className="inline-flex items-center gap-1.5 text-xs font-medium"
                        style={{ color: p.categoria.color }}
                      >
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.categoria.color }} />
                        {p.categoria.nombre}
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <Badge value={p.activo ? "activo" : "inactivo"} />
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" onClick={() => abrirEdicion(p)}>
                        Editar
                      </Button>
                      <Button type="button" variant="ghost" onClick={() => onAlternarActivo(p)}>
                        {p.activo ? "Desactivar" : "Activar"}
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
