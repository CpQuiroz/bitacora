"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Cliente } from "@bitacora/shared";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { DashboardShell, type UsuarioShell } from "@/components/DashboardShell";
import { Button, Card, ErrorText, Input, Label, PageHeader, SuccessText } from "@/components/ui";
import { IconMapPin, IconPlus } from "@/components/icons";

export default function ClientesPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<UsuarioShell | null>(null);
  const [clientes, setClientes] = useState<Cliente[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const [nombre, setNombre] = useState("");
  const [direccion, setDireccion] = useState("");
  const [telefono, setTelefono] = useState("");

  async function cargar() {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      router.replace("/login");
      return;
    }
    const [resMe, resClientes] = await Promise.all([apiFetch("/api/me"), apiFetch("/api/clientes")]);
    if (resMe.ok) {
      const { usuario: u } = await resMe.json();
      if (u) setUsuario({ nombre: u.nombre, rol: u.rol, empresaNombre: u.empresa?.nombre ?? "", empresaLogoUrl: u.empresa?.logo_url ?? null });
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
    setGuardando(true);
    const res = await apiFetch("/api/clientes", {
      method: "POST",
      body: JSON.stringify({ nombre, direccion, telefono }),
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
    setDireccion("");
    setTelefono("");
    cargar();
  }

  if (!usuario) return null;

  return (
    <DashboardShell usuario={usuario}>
      <PageHeader
        title="Clientes"
        subtitle="La dirección se ubica sola en el mapa — para poder planificar rutas y navegar con Waze/Maps"
      />

      <Card className="my-6">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
          <IconPlus className="h-4 w-4 text-brand" />
          Nuevo cliente
        </h2>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Nombre</Label>
              <Input type="text" required value={nombre} onChange={(e) => setNombre(e.target.value)} />
            </div>
            <div>
              <Label>Teléfono</Label>
              <Input type="text" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Label>Dirección</Label>
              <Input
                type="text"
                required
                placeholder="Calle, número, comuna — mientras más completa, mejor la ubica el mapa"
                value={direccion}
                onChange={(e) => setDireccion(e.target.value)}
              />
            </div>
          </div>
          {formError && <ErrorText>{formError}</ErrorText>}
          {aviso && <SuccessText>{aviso}</SuccessText>}
          <Button type="submit" disabled={guardando} className="self-start">
            {guardando ? "Ubicando en el mapa…" : "Agregar cliente"}
          </Button>
        </form>
      </Card>

      {error && <ErrorText>{error}</ErrorText>}
      {clientes === null && !error && <p className="text-sm text-muted">Cargando…</p>}
      {clientes?.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
          <IconMapPin className="h-8 w-8 text-muted" />
          <p className="text-sm text-muted">Todavía no hay clientes.</p>
        </div>
      )}
      {clientes && clientes.length > 0 && (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted">
                <th className="px-5 py-3 font-medium">Nombre</th>
                <th className="px-5 py-3 font-medium">Dirección</th>
                <th className="px-5 py-3 font-medium">Teléfono</th>
                <th className="px-5 py-3 font-medium">Ubicación</th>
              </tr>
            </thead>
            <tbody>
              {clientes.map((c) => (
                <tr key={c.id} className="border-b border-border last:border-0 hover:bg-brand-soft/40">
                  <td className="px-5 py-3 font-medium text-foreground">{c.nombre}</td>
                  <td className="px-5 py-3 text-muted">{c.direccion}</td>
                  <td className="px-5 py-3 text-muted">{c.telefono ?? "—"}</td>
                  <td className="px-5 py-3">
                    {c.lat != null && c.lng != null ? (
                      <span className="inline-flex items-center gap-1 text-success">
                        <IconMapPin className="h-3.5 w-3.5" /> Ubicado
                      </span>
                    ) : (
                      <span className="text-muted">Sin ubicar</span>
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
