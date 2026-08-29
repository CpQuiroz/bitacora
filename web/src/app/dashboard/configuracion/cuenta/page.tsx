"use client";

import { useEffect, useRef, useState } from "react";
import type { NotificacionPreferencia, TipoNotificacion } from "@bitacora/shared";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { Button, Card, ErrorText, Input, Label, PageHeader, Select, SuccessText } from "@/components/ui";
import { IconBell, IconUser } from "@/components/icons";
import { useConfiguracion } from "../ConfiguracionContext";

const TIPO_LABEL: Record<TipoNotificacion, string> = {
  os_asignada: "Nueva orden de servicio asignada a mí",
  os_completada: "Orden de servicio completada",
  cobro_por_vencer: "Cobro próximo a vencer",
  cobro_vencido: "Cobro vencido",
  ruta_finalizada: "Ruta finalizada",
  tarea_retrasada: "Tarea retrasada",
  licencia_por_vencer: "Licencia próxima a vencer",
  email_fallido: "No se pudo enviar un correo (encuesta, PDF)",
  cotizacion_aprobada: "Cotización aprobada por el cliente",
};

const IDIOMAS = [
  { valor: "es", etiqueta: "Español" },
  { valor: "en", etiqueta: "English" },
  { valor: "pt", etiqueta: "Português" },
];

const PAISES = [
  { valor: "CL", etiqueta: "Chile" },
  { valor: "AR", etiqueta: "Argentina" },
  { valor: "PE", etiqueta: "Perú" },
  { valor: "CO", etiqueta: "Colombia" },
  { valor: "MX", etiqueta: "México" },
];

const HUSOS = [
  { valor: "America/Santiago", etiqueta: "Santiago (GMT-4 / GMT-3 en horario de verano)" },
  { valor: "America/Argentina/Buenos_Aires", etiqueta: "Buenos Aires (GMT-3)" },
  { valor: "America/Lima", etiqueta: "Lima (GMT-5)" },
  { valor: "America/Bogota", etiqueta: "Bogotá (GMT-5)" },
  { valor: "America/Mexico_City", etiqueta: "Ciudad de México (GMT-6)" },
];

function iniciales(nombre: string) {
  return nombre.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}

export default function CuentaPage() {
  const { usuario, recargar } = useConfiguracion();
  const inputFotoRef = useRef<HTMLInputElement>(null);

  const [correo, setCorreo] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setCorreo(data.session?.user.email ?? null));
  }, []);

  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [errorFoto, setErrorFoto] = useState<string | null>(null);

  const [nombre, setNombre] = useState(usuario.nombre);
  const [telefono, setTelefono] = useState(usuario.telefono ?? "");
  const [idioma, setIdioma] = useState(usuario.idioma);
  const [pais, setPais] = useState(usuario.pais);
  const [husoHorario, setHusoHorario] = useState(usuario.huso_horario);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [preferencias, setPreferencias] = useState<NotificacionPreferencia[] | null>(null);
  const [guardandoTipo, setGuardandoTipo] = useState<TipoNotificacion | null>(null);

  useEffect(() => {
    apiFetch("/api/notificaciones-feed/preferencias").then(async (res) => {
      if (res.ok) setPreferencias(await res.json());
    });
  }, []);

  async function onCambiarPreferencia(tipo: TipoNotificacion, appActivado: boolean) {
    setGuardandoTipo(tipo);
    setPreferencias((prev) => prev?.map((p) => (p.tipo === tipo ? { ...p, app_activado: appActivado } : p)) ?? prev);
    await apiFetch(`/api/notificaciones-feed/preferencias/${tipo}`, {
      method: "PATCH",
      body: JSON.stringify({ app_activado: appActivado }),
    });
    setGuardandoTipo(null);
  }

  const [actualPass, setActualPass] = useState("");
  const [nuevaPass, setNuevaPass] = useState("");
  const [confirmarPass, setConfirmarPass] = useState("");
  const [cambiandoPass, setCambiandoPass] = useState(false);
  const [errorPass, setErrorPass] = useState<string | null>(null);
  const [avisoPass, setAvisoPass] = useState<string | null>(null);

  async function onSubirFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    setErrorFoto(null);
    setSubiendoFoto(true);
    const formData = new FormData();
    formData.append("foto", archivo);
    const res = await apiFetch("/api/usuarios/me/foto", { method: "POST", body: formData });
    setSubiendoFoto(false);
    if (inputFotoRef.current) inputFotoRef.current.value = "";
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErrorFoto(body.error ?? "No se pudo subir la foto");
      return;
    }
    recargar();
  }

  async function onGuardarDatos() {
    setError(null);
    setAviso(null);
    setGuardando(true);
    const res = await apiFetch("/api/usuarios/me", {
      method: "PATCH",
      body: JSON.stringify({ nombre, telefono, idioma, pais, huso_horario: husoHorario }),
    });
    setGuardando(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "No se pudo guardar");
      return;
    }
    await recargar();
    setAviso("Datos guardados");
  }

  async function onCambiarPassword(e: React.FormEvent) {
    e.preventDefault();
    setErrorPass(null);
    setAvisoPass(null);
    if (nuevaPass.length < 8) {
      setErrorPass("La nueva contraseña debe tener al menos 8 caracteres");
      return;
    }
    if (nuevaPass !== confirmarPass) {
      setErrorPass("Las contraseñas no coinciden");
      return;
    }
    if (!correo) return;
    setCambiandoPass(true);
    // Verifica la contraseña actual re-autenticando antes de cambiarla.
    const { error: errorVerificar } = await supabase.auth.signInWithPassword({
      email: correo,
      password: actualPass,
    });
    if (errorVerificar) {
      setCambiandoPass(false);
      setErrorPass("La contraseña actual no es correcta");
      return;
    }
    const { error: errorCambiar } = await supabase.auth.updateUser({ password: nuevaPass });
    setCambiandoPass(false);
    if (errorCambiar) {
      setErrorPass(errorCambiar.message);
      return;
    }
    setActualPass("");
    setNuevaPass("");
    setConfirmarPass("");
    setAvisoPass("Contraseña actualizada");
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Cuenta" subtitle="Tus datos personales y preferencias" />

      <Card>
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
          <IconUser className="h-4 w-4 text-brand" />
          Foto de perfil
        </h2>
        <div className="flex items-center gap-4">
          <input
            ref={inputFotoRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={onSubirFoto}
            className="hidden"
            id="input-foto-perfil"
          />
          <label htmlFor="input-foto-perfil" onClick={() => inputFotoRef.current?.click()} className="cursor-pointer">
            {usuario.foto_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={usuario.foto_url} alt={usuario.nombre} className="h-16 w-16 rounded-full border border-border object-cover" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand text-lg font-semibold text-brand-foreground">
                {iniciales(usuario.nombre)}
              </div>
            )}
          </label>
          <div>
            <label htmlFor="input-foto-perfil" onClick={() => inputFotoRef.current?.click()} className="inline-block cursor-pointer">
              <Button type="button" variant="outline" disabled={subiendoFoto} className="pointer-events-none">
                {subiendoFoto ? "Subiendo…" : "Cambiar imagen"}
              </Button>
            </label>
            <p className="mt-2 text-xs text-muted">JPG, PNG o WEBP · máx. 5MB</p>
            {errorFoto && (
              <div className="mt-2">
                <ErrorText>{errorFoto}</ErrorText>
              </div>
            )}
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 text-sm font-semibold text-foreground">Datos de la cuenta</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Nombre completo</Label>
            <Input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>
          <div>
            <Label>Correo</Label>
            <Input type="email" value={correo ?? ""} disabled className="opacity-60" />
          </div>
          <div>
            <Label>Teléfono</Label>
            <Input type="tel" placeholder="+56 9 1234 5678" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
          </div>
          <div>
            <Label>Idioma</Label>
            <Select value={idioma} onChange={(e) => setIdioma(e.target.value)}>
              {IDIOMAS.map((i) => (
                <option key={i.valor} value={i.valor}>
                  {i.etiqueta}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <h3 className="mb-3 mt-6 text-xs font-semibold uppercase tracking-wide text-muted">Configuración regional</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>País</Label>
            <Select value={pais} onChange={(e) => setPais(e.target.value)}>
              {PAISES.map((p) => (
                <option key={p.valor} value={p.valor}>
                  {p.etiqueta}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Huso horario</Label>
            <Select value={husoHorario} onChange={(e) => setHusoHorario(e.target.value)}>
              {HUSOS.map((h) => (
                <option key={h.valor} value={h.valor}>
                  {h.etiqueta}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {error && (
          <div className="mt-4">
            <ErrorText>{error}</ErrorText>
          </div>
        )}
        {aviso && (
          <div className="mt-4">
            <SuccessText>{aviso}</SuccessText>
          </div>
        )}
        <Button type="button" onClick={onGuardarDatos} disabled={guardando} className="mt-4">
          {guardando ? "Guardando…" : "Guardar"}
        </Button>
      </Card>

      <Card>
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
          <IconBell className="h-4 w-4 text-brand" />
          Notificaciones
        </h2>
        <p className="mb-4 text-xs text-muted">
          Elige qué alertas quieres recibir dentro de la app. El envío por correo se activará más adelante.
        </p>
        {preferencias === null ? (
          <p className="text-sm text-muted">Cargando…</p>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {preferencias.map((p) => (
              <label key={p.tipo} className="flex items-center justify-between gap-4 py-3">
                <span className="text-sm text-foreground">{TIPO_LABEL[p.tipo]}</span>
                <input
                  type="checkbox"
                  checked={p.app_activado}
                  disabled={guardandoTipo === p.tipo}
                  onChange={(e) => onCambiarPreferencia(p.tipo, e.target.checked)}
                  className="h-4 w-4 accent-brand"
                />
              </label>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <h2 className="mb-4 text-sm font-semibold text-foreground">Cambiar contraseña</h2>
        <form onSubmit={onCambiarPassword} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label>Contraseña actual</Label>
              <Input type="password" required value={actualPass} onChange={(e) => setActualPass(e.target.value)} />
            </div>
            <div>
              <Label>Nueva contraseña</Label>
              <Input type="password" required minLength={8} value={nuevaPass} onChange={(e) => setNuevaPass(e.target.value)} />
            </div>
            <div>
              <Label>Confirmar contraseña</Label>
              <Input type="password" required minLength={8} value={confirmarPass} onChange={(e) => setConfirmarPass(e.target.value)} />
            </div>
          </div>
          {errorPass && <ErrorText>{errorPass}</ErrorText>}
          {avisoPass && <SuccessText>{avisoPass}</SuccessText>}
          <Button type="submit" disabled={cambiandoPass} className="self-start">
            {cambiandoPass ? "Cambiando…" : "Cambiar contraseña"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
