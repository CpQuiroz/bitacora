"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, User } from "lucide-react";
import type { NotificacionPreferencia, TipoNotificacion } from "@bitacora/shared";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { Button, Card, Input, LoadingState, Select } from "@bitacora/ui/web";
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
  tarea_asignada: "Nueva tarea de agenda asignada a mí",
  documento_por_vencer: "Documento próximo a vencer o vencido",
  cita_confirmada: "Cliente confirmó una cita",
  cita_cancelada: "Cliente canceló una cita",
  solicitud_correccion_datos: "Un cliente pidió corregir sus datos",
  levantamiento_asignado: "Nuevo levantamiento asignado a mí",
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

// PASO 6 (sistema de diseño) — migrado. Ver docs/design-system.md.
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
  const [descargando, setDescargando] = useState(false);

  async function descargarMisDatos() {
    setDescargando(true);
    try {
      const res = await apiFetch("/api/usuarios/me/datos");
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mis-datos-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDescargando(false);
    }
  }
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
    <div className="flex flex-col gap-ds-6">
      <div>
        <p className="ds-heading text-ds-h3 text-ds-text">Cuenta</p>
        <p className="mt-ds-1 font-ds-body text-ds-small text-ds-text/70">Tus datos personales y preferencias</p>
      </div>

      <Card>
        <p className="mb-ds-4 flex items-center gap-2 font-ds-body text-ds-small font-semibold text-ds-text">
          <User size={16} strokeWidth={2.75} className="text-ds-brand" />
          Foto de perfil
        </p>
        <div className="flex items-center gap-ds-4">
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
              <img src={usuario.foto_url} alt={usuario.nombre} className="h-16 w-16 rounded-ds-pill border border-ds-divider object-cover" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-ds-pill bg-ds-brand text-lg font-semibold text-ds-brand-foreground">
                {iniciales(usuario.nombre)}
              </div>
            )}
          </label>
          <div>
            <label htmlFor="input-foto-perfil" onClick={() => inputFotoRef.current?.click()} className="inline-block cursor-pointer">
              <div className="pointer-events-none">
                <Button variante="secundario" deshabilitado={subiendoFoto}>
                  {subiendoFoto ? "Subiendo…" : "Cambiar imagen"}
                </Button>
              </div>
            </label>
            <p className="mt-ds-2 font-ds-body text-ds-caption text-ds-text/60">JPG, PNG o WEBP · máx. 5MB</p>
            {errorFoto ? <p className="mt-ds-2 font-ds-body text-ds-small text-ds-accent-700">{errorFoto}</p> : null}
          </div>
        </div>
      </Card>

      <Card>
        <p className="mb-ds-4 font-ds-body text-ds-small font-semibold text-ds-text">Datos de la cuenta</p>
        <div className="grid gap-ds-4 sm:grid-cols-2">
          <Input etiqueta="Nombre completo" valor={nombre} onCambio={setNombre} />
          <Input etiqueta="Correo" tipo="email" valor={correo ?? ""} onCambio={() => {}} deshabilitado />
          <Input etiqueta="Teléfono" tipo="tel" placeholder="+56 9 1234 5678" valor={telefono} onCambio={setTelefono} />
          <Select etiqueta="Idioma" valor={idioma} onCambio={setIdioma} opciones={IDIOMAS} />
        </div>

        <p className="mb-ds-3 mt-ds-6 font-ds-body text-ds-caption font-semibold uppercase tracking-wide text-ds-text/60">Configuración regional</p>
        <div className="grid gap-ds-4 sm:grid-cols-2">
          <Select etiqueta="País" valor={pais} onCambio={setPais} opciones={PAISES} />
          <Select etiqueta="Huso horario" valor={husoHorario} onCambio={setHusoHorario} opciones={HUSOS} />
        </div>

        {error ? <p className="mt-ds-4 font-ds-body text-ds-small text-ds-accent-700">{error}</p> : null}
        {aviso ? <p className="mt-ds-4 font-ds-body text-ds-small font-medium text-ds-accent2-800">{aviso}</p> : null}
        <div className="mt-ds-4">
          <Button onPress={onGuardarDatos} cargando={guardando}>
            Guardar
          </Button>
        </div>
      </Card>

      <Card>
        <p className="mb-ds-4 flex items-center gap-2 font-ds-body text-ds-small font-semibold text-ds-text">
          <Bell size={16} strokeWidth={2.75} className="text-ds-brand" />
          Notificaciones
        </p>
        <p className="mb-ds-4 font-ds-body text-ds-caption text-ds-text/60">
          Elige qué alertas quieres recibir dentro de la app. El envío por correo se activará más adelante.
        </p>
        {preferencias === null ? (
          <LoadingState />
        ) : (
          <div className="flex flex-col divide-y divide-ds-divider">
            {preferencias.map((p) => (
              <label key={p.tipo} className="flex items-center justify-between gap-ds-4 py-ds-3">
                <span className="font-ds-body text-ds-small text-ds-text">{TIPO_LABEL[p.tipo]}</span>
                <input
                  type="checkbox"
                  checked={p.app_activado}
                  disabled={guardandoTipo === p.tipo}
                  onChange={(e) => onCambiarPreferencia(p.tipo, e.target.checked)}
                  className="h-4 w-4 accent-[var(--ds-brand)]"
                />
              </label>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <p className="mb-ds-4 font-ds-body text-ds-small font-semibold text-ds-text">Cambiar contraseña</p>
        <form onSubmit={onCambiarPassword} className="flex flex-col gap-ds-4">
          <div className="grid gap-ds-4 sm:grid-cols-3">
            <Input etiqueta="Contraseña actual" tipo="password" requerido valor={actualPass} onCambio={setActualPass} />
            <Input etiqueta="Nueva contraseña" tipo="password" requerido minLongitud={8} valor={nuevaPass} onCambio={setNuevaPass} />
            <Input etiqueta="Confirmar contraseña" tipo="password" requerido minLongitud={8} valor={confirmarPass} onCambio={setConfirmarPass} />
          </div>
          {errorPass ? <p className="font-ds-body text-ds-small text-ds-accent-700">{errorPass}</p> : null}
          {avisoPass ? <p className="font-ds-body text-ds-small font-medium text-ds-accent2-800">{avisoPass}</p> : null}
          <div className="self-start">
            <Button tipo="submit" cargando={cambiandoPass}>
              Cambiar contraseña
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <p className="mb-ds-2 font-ds-body text-ds-small font-semibold text-ds-text">Mis datos personales</p>
        <p className="mb-ds-4 font-ds-body text-ds-small text-ds-text/70">
          Descarga un archivo con todos los datos personales que Bitácora guarda sobre ti
          (perfil, datos laborales, liquidaciones, accesos, avisos). Ley 21.719 — derecho
          de acceso.
        </p>
        <Button variante="secundario" cargando={descargando} onPress={descargarMisDatos}>
          Descargar mis datos (JSON)
        </Button>
      </Card>
    </div>
  );
}
