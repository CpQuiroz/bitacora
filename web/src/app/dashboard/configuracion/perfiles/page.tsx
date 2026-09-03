"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { ETIQUETA_MODULO } from "@/lib/etiquetasModulo";
import { Button, Card, ErrorText, PageHeader, SuccessText } from "@/components/ui";
import { IconShield } from "@/components/icons";

type RolFila = { slug: string; nombre: string; es_sistema: boolean; modulos: string[] };
type CatalogoItem = { modulo: string; contratado: boolean };
type Respuesta = { roles: RolFila[]; catalogo: CatalogoItem[] };

export default function PerfilesPage() {
  const [data, setData] = useState<Respuesta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  // Estado editable: slug -> Set<modulo>
  const [edicion, setEdicion] = useState<Record<string, Set<string>>>({});
  const [guardando, setGuardando] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setError(null);
    const res = await apiFetch("/api/empresa/roles");
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b.error ?? "No se pudieron cargar los perfiles");
      return;
    }
    const body: Respuesta = await res.json();
    setData(body);
    setEdicion(Object.fromEntries(body.roles.map((r) => [r.slug, new Set(r.modulos)])));
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const originales = useMemo(
    () => Object.fromEntries((data?.roles ?? []).map((r) => [r.slug, new Set(r.modulos)])),
    [data]
  );

  function toggle(slug: string, modulo: string) {
    setOkMsg(null);
    setEdicion((prev) => {
      const next = new Set(prev[slug] ?? []);
      if (next.has(modulo)) next.delete(modulo);
      else next.add(modulo);
      return { ...prev, [slug]: next };
    });
  }

  function sucio(slug: string): boolean {
    const a = originales[slug] ?? new Set();
    const b = edicion[slug] ?? new Set();
    if (a.size !== b.size) return true;
    for (const m of a) if (!b.has(m)) return true;
    return false;
  }

  async function guardar(slug: string) {
    setGuardando(slug);
    setError(null);
    setOkMsg(null);
    const res = await apiFetch(`/api/empresa/roles/${slug}/modulos`, {
      method: "PUT",
      body: JSON.stringify({ modulos: Array.from(edicion[slug] ?? []) }),
    });
    setGuardando(null);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b.error ?? "No se pudo guardar");
      return;
    }
    setOkMsg("Cambios guardados. Las personas con ese perfil los verán al recargar.");
    cargar();
  }

  if (error && !data) return <ErrorText>{error}</ErrorText>;
  if (!data) return null;

  const catalogo = data.catalogo;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Perfiles y permisos"
        subtitle="Elige qué módulos ve cada perfil en tu empresa. No afecta a otras empresas."
      />

      <Card>
        <div className="flex items-start gap-3">
          <IconShield className="mt-0.5 h-5 w-5 shrink-0 text-muted" />
          <div className="text-sm text-muted">
            <p>
              El perfil <span className="font-medium text-foreground">Admin</span> siempre tiene acceso total y no se
              edita. <span className="font-medium text-foreground">Configuración</span> y{" "}
              <span className="font-medium text-foreground">Grupo y usuario</span> tampoco se delegan desde acá.
            </p>
            <p className="mt-1">
              Si un módulo aparece atenuado, tu plan no lo incluye: actívalo primero en{" "}
              <span className="font-medium text-foreground">Configuración → Plan</span>.
            </p>
          </div>
        </div>
      </Card>

      {error && <ErrorText>{error}</ErrorText>}
      {okMsg && <SuccessText>{okMsg}</SuccessText>}

      {data.roles.map((rol) => (
        <Card key={rol.slug}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-foreground">{rol.nombre}</h2>
              <p className="text-xs text-muted">
                {rol.es_sistema ? "Perfil de sistema" : "Perfil personalizado"} · {rol.slug}
              </p>
            </div>
            {sucio(rol.slug) && (
              <Button type="button" onClick={() => guardar(rol.slug)} disabled={guardando === rol.slug}>
                {guardando === rol.slug ? "Guardando…" : "Guardar cambios"}
              </Button>
            )}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {catalogo.map((c) => {
              const marcado = (edicion[rol.slug] ?? new Set()).has(c.modulo);
              return (
                <label
                  key={c.modulo}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                    c.contratado ? "border-border text-foreground" : "border-dashed border-border text-muted"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="accent-brand"
                    checked={marcado}
                    disabled={!c.contratado}
                    onChange={() => toggle(rol.slug, c.modulo)}
                  />
                  <span>
                    {ETIQUETA_MODULO[c.modulo] ?? c.modulo}
                    {!c.contratado && <span className="ml-1 text-xs">(no incluido en tu plan)</span>}
                  </span>
                </label>
              );
            })}
          </div>
        </Card>
      ))}
    </div>
  );
}
