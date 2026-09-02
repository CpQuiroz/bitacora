"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { SuperAdminShell } from "@/components/SuperAdminShell";
import { Modal } from "@/components/Modal";
import { Badge, Button, Card, ErrorText, Input, Label, PageHeader, SuccessText } from "@/components/ui";
import { IconPlus } from "@/components/icons";
import { obtenerTokenSuperAdmin, superadminFetch } from "@/lib/superadminApi";
import { ETIQUETA_ACCION, ETIQUETA_MODULO } from "@/lib/etiquetasModulo";

type Rol = {
  slug: string;
  nombre: string;
  modulos: string[];
  acciones: string[];
  requiere_2fa: boolean;
  es_sistema: boolean;
  orden: number;
  empresas: string[];
  usuarios: number;
};

type EmpresaMin = { id: string; nombre: string };

type Datos = {
  roles: Rol[];
  empresas: EmpresaMin[];
  catalogo: { modulos: string[]; acciones: string[] };
};

export default function SuperAdminRolesPage() {
  const router = useRouter();
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandido, setExpandido] = useState<string | null>(null);

  const [modalNuevo, setModalNuevo] = useState(false);

  async function cargar() {
    const res = await superadminFetch("/api/superadmin/roles");
    if (!res.ok) {
      if (res.status === 401) {
        router.replace("/superadmin/login");
        return;
      }
      setError("No se pudieron cargar los roles");
      return;
    }
    setDatos(await res.json());
  }

  useEffect(() => {
    if (!obtenerTokenSuperAdmin()) {
      router.replace("/superadmin/login");
      return;
    }
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SuperAdminShell>
      <PageHeader
        title="Roles"
        subtitle="Qué módulos y acciones tiene cada rol. Los roles son globales; puedes restringir uno a empresas puntuales."
        action={
          <Button type="button" onClick={() => setModalNuevo(true)}>
            <IconPlus className="h-4 w-4" />
            Nuevo rol
          </Button>
        }
      />

      {error && (
        <div className="my-4">
          <ErrorText>{error}</ErrorText>
        </div>
      )}

      <div className="my-6 flex flex-col gap-3">
        {datos?.roles.map((rol) => (
          <RolCard
            key={rol.slug}
            rol={rol}
            datos={datos}
            abierto={expandido === rol.slug}
            onToggle={() => setExpandido((s) => (s === rol.slug ? null : rol.slug))}
            onCambio={cargar}
          />
        ))}
        {datos === null && !error && <p className="text-sm text-muted">Cargando…</p>}
      </div>

      {datos && (
        <ModalNuevoRol
          open={modalNuevo}
          onClose={() => setModalNuevo(false)}
          catalogo={datos.catalogo}
          onCreado={async () => {
            setModalNuevo(false);
            await cargar();
          }}
        />
      )}
    </SuperAdminShell>
  );
}

function RolCard({
  rol,
  datos,
  abierto,
  onToggle,
  onCambio,
}: {
  rol: Rol;
  datos: Datos;
  abierto: boolean;
  onToggle: () => void;
  onCambio: () => Promise<void>;
}) {
  const esAdmin = rol.slug === "admin";
  const [nombre, setNombre] = useState(rol.nombre);
  const [modulos, setModulos] = useState<string[]>(rol.modulos);
  const [acciones, setAcciones] = useState<string[]>(rol.acciones);
  const [requiere2fa, setRequiere2fa] = useState(rol.requiere_2fa);
  const [restringido, setRestringido] = useState(rol.empresas.length > 0);
  const [empresasSel, setEmpresasSel] = useState<string[]>(rol.empresas);
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);

  // Resetea el formulario al re-expandir con datos frescos.
  useEffect(() => {
    if (abierto) {
      setNombre(rol.nombre);
      setModulos(rol.modulos);
      setAcciones(rol.acciones);
      setRequiere2fa(rol.requiere_2fa);
      setRestringido(rol.empresas.length > 0);
      setEmpresasSel(rol.empresas);
      setMsg(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto]);

  function toggle(lista: string[], set: (v: string[]) => void, valor: string) {
    set(lista.includes(valor) ? lista.filter((x) => x !== valor) : [...lista, valor]);
  }

  async function guardar() {
    setGuardando(true);
    setMsg(null);
    const res = await superadminFetch(`/api/superadmin/roles/${rol.slug}`, {
      method: "PATCH",
      body: JSON.stringify({ nombre, modulos, acciones, requiere_2fa: requiere2fa }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setMsg({ tipo: "error", texto: body.error ?? "No se pudo guardar" });
      setGuardando(false);
      return;
    }
    const idsRes = await superadminFetch(`/api/superadmin/roles/${rol.slug}/empresas`, {
      method: "PUT",
      body: JSON.stringify({ empresa_ids: restringido ? empresasSel : [] }),
    });
    setGuardando(false);
    if (!idsRes.ok) {
      const body = await idsRes.json().catch(() => ({}));
      setMsg({ tipo: "error", texto: body.error ?? "El rol se guardó pero falló la disponibilidad por empresa" });
      await onCambio();
      return;
    }
    setMsg({ tipo: "ok", texto: "Guardado" });
    await onCambio();
  }

  async function borrar() {
    if (!window.confirm(`¿Borrar el rol "${rol.nombre}"? Esta acción no se puede deshacer.`)) return;
    setGuardando(true);
    setMsg(null);
    const res = await superadminFetch(`/api/superadmin/roles/${rol.slug}`, { method: "DELETE" });
    setGuardando(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setMsg({ tipo: "error", texto: body.error ?? "No se pudo borrar" });
      return;
    }
    await onCambio();
  }

  return (
    <Card>
      <button type="button" onClick={onToggle} className="flex w-full items-center justify-between gap-3 text-left">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-foreground">{rol.nombre}</span>
          <span className="font-mono text-xs text-muted">{rol.slug}</span>
          <Badge value={rol.es_sistema ? "sistema" : "personalizado"} />
          {rol.empresas.length > 0 && <Badge value={`${rol.empresas.length} empresa(s)`} />}
        </div>
        <span className="shrink-0 text-xs text-muted">
          {esAdmin ? "acceso total" : `${rol.modulos.length} módulos · ${rol.acciones.length} acciones`} · {rol.usuarios} usuario(s)
        </span>
      </button>

      {abierto && (
        <div className="mt-4 flex flex-col gap-4 border-t border-border pt-4">
          {esAdmin ? (
            <p className="text-sm text-muted">
              El rol <strong>Admin</strong> siempre tiene acceso total a todos los módulos y acciones. No es editable — es la
              garantía de que cada empresa tiene al menos un rol que lo puede todo.
            </p>
          ) : (
            <>
              <div>
                <Label>Nombre visible</Label>
                <Input value={nombre} onChange={(e) => setNombre(e.target.value)} className="max-w-sm" />
              </div>

              <div>
                <Label>Módulos que ve este rol</Label>
                <div className="mt-1 grid gap-2 sm:grid-cols-2">
                  {datos.catalogo.modulos.map((m) => (
                    <label key={m} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                      <input type="checkbox" checked={modulos.includes(m)} onChange={() => toggle(modulos, setModulos, m)} />
                      <span className="text-foreground">{ETIQUETA_MODULO[m] ?? m}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <Label>Acciones sensibles delegadas</Label>
                <div className="mt-1 flex flex-col gap-2">
                  {datos.catalogo.acciones.map((a) => (
                    <label key={a} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                      <input type="checkbox" checked={acciones.includes(a)} onChange={() => toggle(acciones, setAcciones, a)} />
                      <span className="text-foreground">{ETIQUETA_ACCION[a] ?? a}</span>
                    </label>
                  ))}
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={requiere2fa} onChange={(e) => setRequiere2fa(e.target.checked)} />
                <span className="text-foreground">Exigir verificación en dos pasos (2FA) a los usuarios con este rol</span>
              </label>
            </>
          )}

          <div>
            <Label>Disponibilidad</Label>
            <div className="mt-1 flex flex-col gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" checked={!restringido} onChange={() => setRestringido(false)} />
                <span className="text-foreground">Todas las empresas</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" checked={restringido} onChange={() => setRestringido(true)} />
                <span className="text-foreground">Solo empresas puntuales</span>
              </label>
              {restringido && (
                <div className="ml-6 grid max-h-56 gap-1 overflow-y-auto rounded-lg border border-border p-2 sm:grid-cols-2">
                  {datos.empresas.map((e) => (
                    <label key={e.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={empresasSel.includes(e.id)}
                        onChange={() => toggle(empresasSel, setEmpresasSel, e.id)}
                      />
                      <span className="text-foreground">{e.nombre}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          {msg && (msg.tipo === "ok" ? <SuccessText>{msg.texto}</SuccessText> : <ErrorText>{msg.texto}</ErrorText>)}

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={guardar} disabled={guardando}>
              {guardando ? "Guardando…" : "Guardar cambios"}
            </Button>
            {!rol.es_sistema && (
              <Button type="button" variant="ghost" onClick={borrar} disabled={guardando || rol.usuarios > 0}>
                {rol.usuarios > 0 ? `No se puede borrar (${rol.usuarios} usuario/s)` : "Borrar rol"}
              </Button>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

function ModalNuevoRol({
  open,
  onClose,
  catalogo,
  onCreado,
}: {
  open: boolean;
  onClose: () => void;
  catalogo: { modulos: string[]; acciones: string[] };
  onCreado: () => Promise<void>;
}) {
  const [slug, setSlug] = useState("");
  const [nombre, setNombre] = useState("");
  const [modulos, setModulos] = useState<string[]>([]);
  const [acciones, setAcciones] = useState<string[]>([]);
  const [requiere2fa, setRequiere2fa] = useState(false);
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const slugAuto = useMemo(
    () =>
      nombre
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 31),
    [nombre]
  );
  const slugFinal = (slug.trim() || slugAuto).toLowerCase();

  useEffect(() => {
    if (open) {
      setSlug("");
      setNombre("");
      setModulos([]);
      setAcciones([]);
      setRequiere2fa(false);
      setError(null);
    }
  }, [open]);

  function toggle(lista: string[], set: (v: string[]) => void, valor: string) {
    set(lista.includes(valor) ? lista.filter((x) => x !== valor) : [...lista, valor]);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setCreando(true);
    const res = await superadminFetch("/api/superadmin/roles", {
      method: "POST",
      body: JSON.stringify({ slug: slugFinal, nombre, modulos, acciones, requiere_2fa: requiere2fa }),
    });
    setCreando(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "No se pudo crear el rol");
      return;
    }
    await onCreado();
  }

  return (
    <Modal open={open} onClose={onClose} title="Nuevo rol" wide>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Nombre visible</Label>
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} required placeholder="Jefe de taller" />
          </div>
          <div>
            <Label>Identificador</Label>
            <Input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder={slugAuto || "jefe_taller"}
              className="font-mono"
            />
            <p className="mt-1 text-[11px] text-muted">
              Minúsculas, números y <code>_</code>. Se usa como <code>{slugFinal || "…"}</code> y no se puede cambiar después.
            </p>
          </div>
        </div>

        <div>
          <Label>Módulos</Label>
          <div className="mt-1 grid gap-2 sm:grid-cols-2">
            {catalogo.modulos.map((m) => (
              <label key={m} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                <input type="checkbox" checked={modulos.includes(m)} onChange={() => toggle(modulos, setModulos, m)} />
                <span className="text-foreground">{ETIQUETA_MODULO[m] ?? m}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <Label>Acciones sensibles</Label>
          <div className="mt-1 flex flex-col gap-2">
            {catalogo.acciones.map((a) => (
              <label key={a} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                <input type="checkbox" checked={acciones.includes(a)} onChange={() => toggle(acciones, setAcciones, a)} />
                <span className="text-foreground">{ETIQUETA_ACCION[a] ?? a}</span>
              </label>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={requiere2fa} onChange={(e) => setRequiere2fa(e.target.checked)} />
          <span className="text-foreground">Exigir 2FA a los usuarios con este rol</span>
        </label>

        {error && <ErrorText>{error}</ErrorText>}

        <div className="flex gap-2">
          <Button type="submit" disabled={creando || !nombre.trim() || !slugFinal}>
            {creando ? "Creando…" : "Crear rol"}
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </form>
    </Modal>
  );
}
