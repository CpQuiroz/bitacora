"use client";

import { useRef, useState, type CSSProperties, type DragEvent } from "react";
import { Briefcase, ClipboardCheck, Home, MapPin, Sparkle, Wallet } from "lucide-react";
import type { TipoCuenta } from "@bitacora/shared";
import { comunasDeRegion, formatearRut, REGIONES, validarRut } from "@bitacora/shared";
import { apiFetch } from "@/lib/api";
import { FUENTES, fuenteDe } from "@/lib/fuentes";
import { Button, Card, Input, Select } from "@bitacora/ui/web";
import { useConfiguracion } from "../ConfiguracionContext";

const MONEDAS = [
  { valor: "CLP", etiqueta: "CLP — Peso chileno" },
  { valor: "USD", etiqueta: "USD — Dólar" },
  { valor: "EUR", etiqueta: "EUR — Euro" },
  { valor: "PEN", etiqueta: "PEN — Sol peruano" },
  { valor: "COP", etiqueta: "COP — Peso colombiano" },
  { valor: "MXN", etiqueta: "MXN — Peso mexicano" },
  { valor: "ARS", etiqueta: "ARS — Peso argentino" },
];

const BANCOS = [
  "Banco de Chile", "Banco Estado", "Banco Santander", "Banco de Crédito e Inversiones (BCI)",
  "Scotiabank Chile", "Banco Itaú Chile", "Banco Security", "Banco Falabella",
  "Banco Ripley", "Banco Consorcio", "Banco BICE", "HSBC Bank Chile", "Banco Internacional",
];

const TIPOS_CUENTA: { valor: TipoCuenta; etiqueta: string }[] = [
  { valor: "corriente", etiqueta: "Cuenta Corriente" },
  { valor: "vista", etiqueta: "Cuenta Vista" },
  { valor: "ahorro", etiqueta: "Cuenta de Ahorro" },
];

const COLOR_PRIMARIO_DEFAULT = "#4338ca";
const COLOR_SECUNDARIO_DEFAULT = "#0d9488";

function contrasteTexto(hex: string): string {
  const limpio = hex.replace("#", "");
  const r = parseInt(limpio.slice(0, 2), 16);
  const g = parseInt(limpio.slice(2, 4), 16);
  const b = parseInt(limpio.slice(4, 6), 16);
  const brillo = (r * 299 + g * 587 + b * 114) / 1000;
  return brillo > 150 ? "#16161f" : "#ffffff";
}

// PASO 6 (sistema de diseño) — migrado. Ver docs/design-system.md.
// La "vista previa en vivo" de marca es una maqueta autocontenida que
// simula el sidebar/dashboard con las variables CSS de marca
// (--brand/--accent/--font-sans, definidas globalmente para retro-
// compatibilidad) — no representa el chrome real de la app (que ya
// usa tokens ds- fijos), así que queda tal cual, igual que la vista
// previa de PDF en plantillas/page.tsx.
export default function EmpresaPage() {
  const { usuario, recargar } = useConfiguracion();
  const inputLogoRef = useRef<HTMLInputElement>(null);
  const [arrastrando, setArrastrando] = useState(false);

  const [subiendoLogo, setSubiendoLogo] = useState(false);
  const [errorLogo, setErrorLogo] = useState<string | null>(null);

  // --- datos de la empresa ---
  const [nombre, setNombre] = useState(usuario.empresa.nombre);
  const [razonSocial, setRazonSocial] = useState(usuario.empresa.razon_social ?? "");
  const [giro, setGiro] = useState(usuario.empresa.giro ?? "");
  const [rut, setRut] = useState(usuario.empresa.rut ?? "");
  const [correoEmpresa, setCorreoEmpresa] = useState(usuario.empresa.correo_empresa ?? "");
  const [telefonoEmpresa, setTelefonoEmpresa] = useState(usuario.empresa.telefono_empresa ?? "");
  const [whatsapp, setWhatsapp] = useState(usuario.empresa.whatsapp ?? "");

  // --- dirección ---
  const [region, setRegion] = useState(usuario.empresa.region ?? "");
  const [comuna, setComuna] = useState(usuario.empresa.comuna ?? "");
  const comunasDisponibles = comunasDeRegion(region);

  function onCambiarRegion(nuevaRegion: string) {
    setRegion(nuevaRegion);
    // Si la comuna actual no pertenece a la nueva región, se limpia —
    // evita mandar una combinación región/comuna inconsistente.
    if (!comunasDeRegion(nuevaRegion).includes(comuna)) setComuna("");
  }
  const [calle, setCalle] = useState(usuario.empresa.direccion_calle ?? "");
  const [numero, setNumero] = useState(usuario.empresa.direccion_numero ?? "");
  const [depto, setDepto] = useState(usuario.empresa.direccion_depto ?? "");

  // --- datos de pago ---
  const [pagoActivado, setPagoActivado] = useState(usuario.empresa.pago_activado);
  const [banco, setBanco] = useState(usuario.empresa.pago_banco ?? "");
  const [tipoCuenta, setTipoCuenta] = useState<TipoCuenta>(usuario.empresa.pago_tipo_cuenta ?? "corriente");
  const [numeroCuenta, setNumeroCuenta] = useState(usuario.empresa.pago_numero_cuenta ?? "");
  const [titular, setTitular] = useState(usuario.empresa.pago_titular ?? "");

  const [guardandoDatos, setGuardandoDatos] = useState(false);
  const [errorDatos, setErrorDatos] = useState<string | null>(null);
  const [avisoDatos, setAvisoDatos] = useState<string | null>(null);

  // --- marca ---
  const [color, setColor] = useState(usuario.empresa.color_primario || COLOR_PRIMARIO_DEFAULT);
  const [colorSecundario, setColorSecundario] = useState(usuario.empresa.color_secundario || COLOR_SECUNDARIO_DEFAULT);
  const [fuente, setFuente] = useState(usuario.empresa.fuente || "sistema");
  const [moneda, setMoneda] = useState(usuario.empresa.moneda ?? "CLP");
  const [guardandoMarca, setGuardandoMarca] = useState(false);
  const [restableciendo, setRestableciendo] = useState(false);
  const [avisoMarca, setAvisoMarca] = useState<string | null>(null);
  const [errorMarca, setErrorMarca] = useState<string | null>(null);

  const rutValido = rut.trim() === "" || validarRut(rut);

  async function subirArchivoLogo(archivo: File) {
    setErrorLogo(null);
    setSubiendoLogo(true);
    const formData = new FormData();
    formData.append("logo", archivo);
    const res = await apiFetch("/api/empresa/logo", { method: "POST", body: formData });
    setSubiendoLogo(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErrorLogo(body.error ?? "No se pudo subir el logo");
      return;
    }
    recargar();
  }

  function onSubirLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    if (archivo) subirArchivoLogo(archivo);
    if (inputLogoRef.current) inputLogoRef.current.value = "";
  }

  function onSoltarLogo(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setArrastrando(false);
    const archivo = e.dataTransfer.files?.[0];
    if (archivo) subirArchivoLogo(archivo);
  }

  async function onGuardarDatos() {
    setErrorDatos(null);
    setAvisoDatos(null);
    if (rut.trim() && !validarRut(rut)) {
      setErrorDatos("El RUT no es válido (revisa el dígito verificador)");
      return;
    }
    setGuardandoDatos(true);
    const res = await apiFetch("/api/empresa", {
      method: "PATCH",
      body: JSON.stringify({
        nombre,
        razon_social: razonSocial,
        giro,
        rut: rut.trim() ? formatearRut(rut) : null,
        correo_empresa: correoEmpresa,
        telefono_empresa: telefonoEmpresa,
        whatsapp,
        region: region || null,
        comuna,
        direccion_calle: calle,
        direccion_numero: numero,
        direccion_depto: depto,
        pago_activado: pagoActivado,
        pago_banco: banco,
        pago_tipo_cuenta: tipoCuenta,
        pago_numero_cuenta: numeroCuenta,
        pago_titular: titular,
      }),
    });
    setGuardandoDatos(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErrorDatos(body.error ?? "No se pudo guardar");
      return;
    }
    const empresaActualizada = await res.json();
    setRut(empresaActualizada.rut ?? "");
    await recargar();
    setAvisoDatos("Datos guardados");
  }

  async function onGuardarMarca() {
    setErrorMarca(null);
    setAvisoMarca(null);
    setGuardandoMarca(true);
    const res = await apiFetch("/api/empresa", {
      method: "PATCH",
      body: JSON.stringify({ color_primario: color, color_secundario: colorSecundario, fuente, moneda }),
    });
    setGuardandoMarca(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErrorMarca(body.error ?? "No se pudo guardar");
      return;
    }
    await recargar();
    setAvisoMarca("Cambios guardados");
  }

  async function onRestablecerMarca() {
    setErrorMarca(null);
    setAvisoMarca(null);
    setRestableciendo(true);
    const res = await apiFetch("/api/empresa", {
      method: "PATCH",
      body: JSON.stringify({ color_primario: null, color_secundario: null, fuente: null }),
    });
    setRestableciendo(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErrorMarca(body.error ?? "No se pudo restablecer");
      return;
    }
    await recargar();
    setColor(COLOR_PRIMARIO_DEFAULT);
    setColorSecundario(COLOR_SECUNDARIO_DEFAULT);
    setFuente("sistema");
    setAvisoMarca("Se restableció a los valores por defecto");
  }

  const fuenteInfo = fuenteDe(fuente);
  const previewStyle: CSSProperties = {
    fontFamily: "var(--font-sans)",
    "--brand": color,
    "--brand-foreground": contrasteTexto(color),
    "--brand-soft": `color-mix(in srgb, ${color} 14%, var(--surface))`,
    "--accent": colorSecundario,
    ...(fuente !== "sistema" ? { "--font-sans": fuenteInfo.pila } : {}),
  } as CSSProperties;

  return (
    <div className="flex flex-col gap-ds-6">
      <div>
        <p className="ds-heading text-ds-h3 text-ds-text">Empresa</p>
        <p className="mt-ds-1 font-ds-body text-ds-small text-ds-text/70">Datos fiscales, dirección, medio de pago y marca</p>
      </div>

      <Card>
        <p className="mb-ds-4 flex items-center gap-2 font-ds-body text-ds-small font-semibold text-ds-text">
          <Briefcase size={16} strokeWidth={2.75} className="text-ds-brand" />
          Datos de la empresa
        </p>
        <div className="grid gap-ds-4 sm:grid-cols-2">
          <Input etiqueta="Nombre de fantasía *" requerido valor={nombre} onCambio={setNombre} />
          <Input etiqueta="Razón social" valor={razonSocial} onCambio={setRazonSocial} />
          <Input etiqueta="Giro" placeholder="Transporte de carga por carretera" valor={giro} onCambio={setGiro} />
          <Input
            etiqueta="RUT"
            placeholder="76.086.428-5"
            valor={rut}
            onCambio={setRut}
            error={!rutValido ? "RUT inválido — revisa el dígito verificador" : undefined}
          />
          <Input etiqueta="Correo" tipo="email" valor={correoEmpresa} onCambio={setCorreoEmpresa} />
          <Input etiqueta="Teléfono" tipo="tel" placeholder="+56 2 2345 6789" valor={telefonoEmpresa} onCambio={setTelefonoEmpresa} />
          <Input etiqueta="WhatsApp" tipo="tel" placeholder="+56 9 1234 5678" valor={whatsapp} onCambio={setWhatsapp} />
        </div>
      </Card>

      <Card>
        <p className="mb-ds-4 flex items-center gap-2 font-ds-body text-ds-small font-semibold text-ds-text">
          <MapPin size={16} strokeWidth={2.75} className="text-ds-brand" />
          Dirección
        </p>
        <div className="grid gap-ds-4 sm:grid-cols-2">
          <Select
            etiqueta="Región"
            valor={region}
            onCambio={onCambiarRegion}
            placeholder="Selecciona una región"
            opciones={REGIONES.map((r) => ({ valor: r, etiqueta: r }))}
          />
          <Select
            etiqueta="Comuna"
            valor={comuna}
            onCambio={setComuna}
            deshabilitado={!region}
            placeholder={region ? "Selecciona una comuna" : "Elige una región primero"}
            opciones={comunasDisponibles.map((c) => ({ valor: c, etiqueta: c }))}
          />
          <Input etiqueta="Calle" valor={calle} onCambio={setCalle} />
          <div className="grid grid-cols-2 gap-ds-4">
            <Input etiqueta="Número" valor={numero} onCambio={setNumero} />
            <Input etiqueta="Depto/Oficina" valor={depto} onCambio={setDepto} />
          </div>
        </div>
      </Card>

      <Card>
        <div className="mb-ds-4 flex items-center justify-between">
          <p className="flex items-center gap-2 font-ds-body text-ds-small font-semibold text-ds-text">
            <Wallet size={16} strokeWidth={2.75} className="text-ds-brand" />
            Datos de pago
          </p>
          <button
            type="button"
            role="switch"
            aria-checked={pagoActivado}
            onClick={() => setPagoActivado((v) => !v)}
            className={`relative h-6 w-11 shrink-0 rounded-ds-pill transition-colors ${pagoActivado ? "bg-ds-brand" : "bg-ds-divider"}`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-ds-pill bg-white shadow transition-transform ${
                pagoActivado ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>
        <p className="mb-ds-4 font-ds-body text-ds-caption text-ds-text/60">
          Datos de la cuenta bancaria donde tu empresa recibe pagos por transferencia — se muestran
          en las cotizaciones/cobranzas cuando está activado.
        </p>
        {pagoActivado && (
          <div className="grid gap-ds-4 sm:grid-cols-2">
            <Select etiqueta="Banco" valor={banco} onCambio={setBanco} placeholder="Selecciona un banco" opciones={BANCOS.map((b) => ({ valor: b, etiqueta: b }))} />
            <Select etiqueta="Tipo de cuenta" valor={tipoCuenta} onCambio={(v) => setTipoCuenta(v as TipoCuenta)} opciones={TIPOS_CUENTA} />
            <Input etiqueta="Número de cuenta" valor={numeroCuenta} onCambio={setNumeroCuenta} />
            <Input etiqueta="Titular" valor={titular} onCambio={setTitular} />
          </div>
        )}
      </Card>

      {errorDatos ? <p className="font-ds-body text-ds-small text-ds-accent-700">{errorDatos}</p> : null}
      {avisoDatos ? <p className="font-ds-body text-ds-small font-medium text-ds-accent2-800">{avisoDatos}</p> : null}
      <div className="self-start">
        <Button onPress={onGuardarDatos} cargando={guardandoDatos}>
          Guardar datos de la empresa
        </Button>
      </div>

      <div className="grid gap-ds-6 lg:grid-cols-[1fr_20rem]">
        <div className="flex flex-col gap-ds-6">
          <Card>
            <p className="mb-ds-4 flex items-center gap-2 font-ds-body text-ds-small font-semibold text-ds-text">
              <Briefcase size={16} strokeWidth={2.75} className="text-ds-brand" />
              Logo
            </p>
            <div className="flex items-center gap-ds-4">
              {usuario.empresa.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={usuario.empresa.logo_url}
                  alt={`Logo de ${usuario.empresa.nombre}`}
                  className="h-16 w-16 rounded-ds-lg border border-ds-divider object-cover"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-ds-lg border border-dashed border-ds-divider font-ds-body text-ds-caption text-ds-text/60">
                  Sin logo
                </div>
              )}
              <input
                ref={inputLogoRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={onSubirLogo}
                className="hidden"
                id="input-logo"
              />
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setArrastrando(true);
                }}
                onDragLeave={() => setArrastrando(false)}
                onDrop={onSoltarLogo}
                onClick={() => inputLogoRef.current?.click()}
                className={`flex flex-1 cursor-pointer flex-col items-center justify-center rounded-ds-lg border-2 border-dashed px-ds-4 py-5 text-center transition-colors ${
                  arrastrando ? "border-ds-brand bg-ds-brand/[0.08]" : "border-ds-divider hover:border-ds-brand hover:bg-ds-text/[0.04]"
                }`}
              >
                <p className="font-ds-body text-ds-small font-medium text-ds-text">
                  {subiendoLogo ? "Subiendo…" : "Arrastra una imagen o haz clic para elegir"}
                </p>
                <p className="mt-ds-1 font-ds-body text-ds-caption text-ds-text/60">Cuadrado, mín. 200×200px · PNG, JPG o WEBP · máx. 2MB</p>
              </div>
            </div>
            {errorLogo ? <p className="mt-ds-2 font-ds-body text-ds-small text-ds-accent-700">{errorLogo}</p> : null}
          </Card>

          <Card>
            <p className="mb-ds-1 font-ds-body text-ds-small font-semibold text-ds-text">Color de acento</p>
            <p className="mb-ds-4 font-ds-body text-ds-caption text-ds-text/60">
              Se usa para resaltar acciones y estados en la app. El resto de la interfaz mantiene la identidad de Bitácora. Tu logo se muestra igual.
            </p>
            <div className="grid gap-ds-4 sm:grid-cols-2">
              <div>
                <label className="font-ds-body text-ds-caption font-medium text-ds-text/70">Color de acento</label>
                <div className="mt-ds-1 flex items-center gap-ds-3">
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="h-10 w-14 cursor-pointer rounded-ds-md border border-ds-divider bg-ds-surface p-1"
                  />
                  <span className="font-ds-body text-ds-small text-ds-text/70">{color}</span>
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <p className="mb-ds-4 font-ds-body text-ds-small font-semibold text-ds-text">Tipografía y moneda</p>
            <div className="grid gap-ds-4 sm:grid-cols-2">
              <Select etiqueta="Tipografía" valor={fuente} onCambio={setFuente} opciones={FUENTES} />
              <Select etiqueta="Moneda" valor={moneda} onCambio={setMoneda} opciones={MONEDAS} />
            </div>
          </Card>

          {errorMarca ? <p className="font-ds-body text-ds-small text-ds-accent-700">{errorMarca}</p> : null}
          {avisoMarca ? <p className="font-ds-body text-ds-small font-medium text-ds-accent2-800">{avisoMarca}</p> : null}
          <div className="flex gap-ds-3">
            <Button onPress={onGuardarMarca} cargando={guardandoMarca}>
              Guardar marca
            </Button>
            <Button variante="secundario" onPress={onRestablecerMarca} cargando={restableciendo}>
              Restablecer valores por defecto
            </Button>
          </div>
        </div>

        <div>
          <p className="mb-ds-2 font-ds-body text-ds-caption font-medium uppercase tracking-wide text-ds-text/60">Vista previa en vivo</p>
          <div className="overflow-hidden rounded-2xl border border-ds-divider" style={previewStyle}>
            <div className="flex">
              <div className="flex w-36 flex-col gap-1 border-r border-border bg-surface p-2">
                <div className="mb-2 flex items-center gap-1.5 px-1">
                  {usuario.empresa.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={usuario.empresa.logo_url} alt="" className="h-5 w-5 rounded object-cover" />
                  ) : (
                    <div className="h-5 w-5 rounded bg-brand" />
                  )}
                  <span className="truncate text-[11px] font-semibold text-foreground">{nombre || usuario.empresa.nombre}</span>
                </div>
                <div className="flex items-center gap-1.5 rounded-md bg-brand-soft px-2 py-1.5 text-brand">
                  <Home size={12} strokeWidth={2.75} />
                  <span className="text-[10px] font-medium">Dashboard</span>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1.5 text-muted">
                  <ClipboardCheck size={12} strokeWidth={2.75} />
                  <span className="text-[10px] font-medium">Órdenes</span>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1.5 text-muted">
                  <Sparkle size={12} strokeWidth={2.75} />
                  <span className="text-[10px] font-medium">Informes</span>
                </div>
              </div>
              <div className="flex-1 bg-background p-3" style={{ fontFamily: "var(--font-sans)" }}>
                <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--accent)" }}>
                  Ingresos totales
                </p>
                <p className="mt-1 text-lg font-semibold text-foreground">$190.000</p>
                <button
                  type="button"
                  className="mt-3 rounded-md px-2.5 py-1.5 text-[10px] font-medium"
                  style={{ background: "var(--brand)", color: "var(--brand-foreground)" }}
                >
                  Actualizar
                </button>
              </div>
            </div>
          </div>
          <p className="mt-ds-2 font-ds-body text-ds-caption text-ds-text/60">Así se ve con los cambios sin guardar todavía.</p>
        </div>
      </div>
    </div>
  );
}
