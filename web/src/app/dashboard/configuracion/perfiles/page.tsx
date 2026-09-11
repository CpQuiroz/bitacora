"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Shield } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { ETIQUETA_MODULO } from "@/lib/etiquetasModulo";
import { Button, Card } from "@bitacora/ui/web";

type RolFila = { slug: string; nombre: string; es_sistema: boolean; modulos: string[] };
type CatalogoItem = { modulo: string; contratado: boolean };
type Respuesta = { roles: RolFila[]; catalogo: CatalogoItem[] };

// PASO 6 (sistema de diseño) — migrado. Ver docs/design-system.md.
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

  if (error && !data) return <p className="font-ds-body text-ds-small text-ds-accent-700">{error}</p>;
  if (!data) return null;

  const catalogo = data.catalogo;

  return (
    <div className="flex flex-col gap-ds-6">
      <div>
        <p className="ds-heading text-ds-h3 text-ds-text">Perfiles y permisos</p>
        <p className="mt-ds-1 font-ds-body text-ds-small text-ds-text/70">Elige qué módulos ve cada perfil en tu empresa. No afecta a otras empresas.</p>
      </div>

      <Card>
        <div className="flex items-start gap-ds-3">
          <Shield size={20} strokeWidth={2.75} className="mt-0.5 shrink-0 text-ds-text/60" />
          <div className="font-ds-body text-ds-small text-ds-text/70">
            <p>
              El perfil <span className="font-medium text-ds-text">Admin</span> siempre tiene acceso total y no se
              edita. <span className="font-medium text-ds-text">Configuración</span> y{" "}
              <span className="font-medium text-ds-text">Grupo y usuario</span> tampoco se delegan desde acá.
            </p>
            <p className="mt-ds-1">
              Si un módulo aparece atenuado, tu plan no lo incluye: actívalo primero en{" "}
              <span className="font-medium text-ds-text">Configuración → Plan</span>.
            </p>
          </div>
        </div>
      </Card>

      {error ? <p className="font-ds-body text-ds-small text-ds-accent-700">{error}</p> : null}
      {okMsg ? <p className="font-ds-body text-ds-small font-medium text-ds-accent2-800">{okMsg}</p> : null}

      {data.roles.map((rol) => (
        <Card key={rol.slug}>
          <div className="mb-ds-4 flex items-center justify-between gap-ds-3">
            <div>
              <p className="font-ds-body text-ds-small font-semibold text-ds-text">{rol.nombre}</p>
              <p className="font-ds-body text-ds-caption text-ds-text/60">
                {rol.es_sistema ? "Perfil de sistema" : "Perfil personalizado"} · {rol.slug}
              </p>
            </div>
            {sucio(rol.slug) && (
              <Button onPress={() => guardar(rol.slug)} cargando={guardando === rol.slug}>
                Guardar cambios
              </Button>
            )}
          </div>
          <div className="grid gap-ds-2 sm:grid-cols-2">
            {catalogo.map((c) => {
              const marcado = (edicion[rol.slug] ?? new Set()).has(c.modulo);
              return (
                <label
                  key={c.modulo}
                  className={`flex items-center gap-ds-2 rounded-ds-md border px-ds-3 py-2 font-ds-body text-ds-small ${
                    c.contratado ? "border-ds-divider text-ds-text" : "border-dashed border-ds-divider text-ds-text/60"
                  }`}
                >
                  <input type="checkbox" className="accent-[var(--ds-brand)]" checked={marcado} disabled={!c.contratado} onChange={() => toggle(rol.slug, c.modulo)} />
                  <span>
                    {ETIQUETA_MODULO[c.modulo] ?? c.modulo}
                    {!c.contratado && <span className="ml-ds-1 text-ds-caption">(no incluido en tu plan)</span>}
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
