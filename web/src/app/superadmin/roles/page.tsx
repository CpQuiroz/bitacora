"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { SuperAdminShell } from "@/components/SuperAdminShell";
import { PageHeader } from "@/components/PageHeader";
import { IconPlus } from "@/components/icons";
import { obtenerTokenSuperAdmin, superadminFetch } from "@/lib/superadminApi";
import { ETIQUETA_ACCION, ETIQUETA_MODULO } from "@/lib/etiquetasModulo";
import { Aviso, Button, Card, Dialog, Input, StatusBadge, useConfirmar } from "@bitacora/ui/web";

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
          <Button iconoIzq={<IconPlus className="h-4 w-4" />} onPress={() => setModalNuevo(true)}>
            Nuevo rol
          </Button>
        }
      />

      {error && (
        <div className="my-4">
          <Aviso tono="error">{error}</Aviso>
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
        {datos === null && !error && <p className="text-sm text-ds-text-secondary">Cargando…</p>}
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
  const confirmar = useConfirmar();

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
    if (!(await confirmar({ titulo: `¿Borrar el rol "${rol.nombre}"?`, mensaje: "Esta acción no se puede deshacer.", accion: "Borrar", destructivo: true }))) return;
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
          <span className="font-semibold text-ds-text">{rol.nombre}</span>
          <span className="font-mono text-xs text-ds-text-secondary">{rol.slug}</span>
          <StatusBadge estado={rol.es_sistema ? "sistema" : "personalizado"} tonoForzado="en_progreso" />
          {rol.empresas.length > 0 && <StatusBadge estado={`${rol.empresas.length} empresa(s)`} tonoForzado="en_progreso" />}
        </div>
        <span className="shrink-0 text-xs text-ds-text-secondary">
          {esAdmin ? "acceso total" : `${rol.modulos.length} módulos · ${rol.acciones.length} acciones`} · {rol.usuarios} usuario(s)
        </span>
      </button>

      {abierto && (
        <div className="mt-4 flex flex-col gap-4 border-t border-ds-divider pt-4">
          {esAdmin ? (
            <p className="text-sm text-ds-text-secondary">
              El rol <strong>Admin</strong> siempre tiene acceso total a todos los módulos y acciones. No es editable — es la
              garantía de que cada empresa tiene al menos un rol que lo puede todo.
            </p>
          ) : (
            <>
              <div className="max-w-sm">
                <Input etiqueta="Nombre visible" valor={nombre} onCambio={setNombre} />
              </div>

              <fieldset>
                <legend className="mb-ds-1 text-ds-caption font-ds-body font-medium text-ds-text/70">Módulos que ve este rol</legend>
                <div className="mt-1 grid gap-2 sm:grid-cols-2">
                  {datos.catalogo.modulos.map((m) => (
                    <label key={m} className="flex items-center gap-2 rounded-lg border border-ds-divider px-3 py-2 text-sm">
                      <input type="checkbox" checked={modulos.includes(m)} onChange={() => toggle(modulos, setModulos, m)} />
                      <span className="text-ds-text">{ETIQUETA_MODULO[m] ?? m}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="mb-ds-1 text-ds-caption font-ds-body font-medium text-ds-text/70">Acciones sensibles delegadas</legend>
                <div className="mt-1 flex flex-col gap-2">
                  {datos.catalogo.acciones.map((a) => (
                    <label key={a} className="flex items-center gap-2 rounded-lg border border-ds-divider px-3 py-2 text-sm">
                      <input type="checkbox" checked={acciones.includes(a)} onChange={() => toggle(acciones, setAcciones, a)} />
                      <span className="text-ds-text">{ETIQUETA_ACCION[a] ?? a}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={requiere2fa} onChange={(e) => setRequiere2fa(e.target.checked)} />
                <span className="text-ds-text">Exigir verificación en dos pasos (2FA) a los usuarios con este rol</span>
              </label>
            </>
          )}

          <fieldset>
            <legend className="mb-ds-1 text-ds-caption font-ds-body font-medium text-ds-text/70">Disponibilidad</legend>
            <div className="mt-1 flex flex-col gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" checked={!restringido} onChange={() => setRestringido(false)} />
                <span className="text-ds-text">Todas las empresas</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" checked={restringido} onChange={() => setRestringido(true)} />
                <span className="text-ds-text">Solo empresas puntuales</span>
              </label>
              {restringido && (
                <div className="ml-6 grid max-h-56 gap-1 overflow-y-auto rounded-lg border border-ds-divider p-2 sm:grid-cols-2">
                  {datos.empresas.map((e) => (
                    <label key={e.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={empresasSel.includes(e.id)}
                        onChange={() => toggle(empresasSel, setEmpresasSel, e.id)}
                      />
                      <span className="text-ds-text">{e.nombre}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </fieldset>

          {msg && <Aviso tono={msg.tipo === "ok" ? "exito" : "error"}>{msg.texto}</Aviso>}

          <div className="flex flex-wrap gap-2">
            <Button onPress={guardar} deshabilitado={guardando}>
              {guardando ? "Guardando…" : "Guardar cambios"}
            </Button>
            {!rol.es_sistema && (
              <Button variante="ghost" onPress={borrar} deshabilitado={guardando || rol.usuarios > 0}>
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
    <Dialog abierto={open} onCerrar={onClose} titulo="Nuevo rol" tamano="ancho">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input etiqueta="Nombre visible" valor={nombre} onCambio={setNombre} requerido placeholder="Jefe de taller" />
          <div>
            <Input etiqueta="Identificador" valor={slug} onCambio={setSlug} autoCapitalizar={false} placeholder={slugAuto || "jefe_taller"} />
            <p className="mt-1 text-ds-micro text-ds-text-secondary">
              Minúsculas, números y <code>_</code>. Se usa como <code>{slugFinal || "…"}</code> y no se puede cambiar después.
            </p>
          </div>
        </div>

        <fieldset>
          <legend className="mb-ds-1 text-ds-caption font-ds-body font-medium text-ds-text/70">Módulos</legend>
          <div className="mt-1 grid gap-2 sm:grid-cols-2">
            {catalogo.modulos.map((m) => (
              <label key={m} className="flex items-center gap-2 rounded-lg border border-ds-divider px-3 py-2 text-sm">
                <input type="checkbox" checked={modulos.includes(m)} onChange={() => toggle(modulos, setModulos, m)} />
                <span className="text-ds-text">{ETIQUETA_MODULO[m] ?? m}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-ds-1 text-ds-caption font-ds-body font-medium text-ds-text/70">Acciones sensibles</legend>
          <div className="mt-1 flex flex-col gap-2">
            {catalogo.acciones.map((a) => (
              <label key={a} className="flex items-center gap-2 rounded-lg border border-ds-divider px-3 py-2 text-sm">
                <input type="checkbox" checked={acciones.includes(a)} onChange={() => toggle(acciones, setAcciones, a)} />
                <span className="text-ds-text">{ETIQUETA_ACCION[a] ?? a}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={requiere2fa} onChange={(e) => setRequiere2fa(e.target.checked)} />
          <span className="text-ds-text">Exigir 2FA a los usuarios con este rol</span>
        </label>

        {error && <Aviso tono="error">{error}</Aviso>}

        <div className="flex gap-2">
          <Button tipo="submit" deshabilitado={creando || !nombre.trim() || !slugFinal}>
            {creando ? "Creando…" : "Crear rol"}
          </Button>
          <Button variante="ghost" onPress={onClose}>
            Cancelar
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
