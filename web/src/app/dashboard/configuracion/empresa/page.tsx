"use client";

import { useRef, useState, type CSSProperties, type DragEvent } from "react";
import type { TipoCuenta } from "@bitacora/shared";
import { comunasDeRegion, formatearRut, REGIONES, validarRut } from "@bitacora/shared";
import { apiFetch } from "@/lib/api";
import { FUENTES, fuenteDe } from "@/lib/fuentes";
import { Button, Card, ErrorText, Input, Label, PageHeader, Select, SuccessText } from "@/components/ui";
import { IconBriefcase, IconClipboardCheck, IconHome, IconMapPin, IconSparkle, IconWallet } from "@/components/icons";
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
        rut: rut.trim() || null,
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
    <div className="flex flex-col gap-6">
      <PageHeader title="Empresa" subtitle="Datos fiscales, dirección, medio de pago y marca" />

      <Card>
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
          <IconBriefcase className="h-4 w-4 text-brand" />
          Datos de la empresa
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Nombre de fantasía *</Label>
            <Input type="text" required value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>
          <div>
            <Label>Razón social</Label>
            <Input type="text" value={razonSocial} onChange={(e) => setRazonSocial(e.target.value)} />
          </div>
          <div>
            <Label>Giro</Label>
            <Input type="text" placeholder="Transporte de carga por carretera" value={giro} onChange={(e) => setGiro(e.target.value)} />
          </div>
          <div>
            <Label>RUT</Label>
            <Input
              type="text"
              placeholder="76.086.428-5"
              value={rut}
              onChange={(e) => setRut(e.target.value)}
              onBlur={() => rut.trim() && validarRut(rut) && setRut(formatearRut(rut))}
              className={!rutValido ? "border-danger" : undefined}
            />
            {!rutValido && <p className="mt-1 text-xs text-danger">RUT inválido — revisa el dígito verificador</p>}
          </div>
          <div>
            <Label>Correo</Label>
            <Input type="email" value={correoEmpresa} onChange={(e) => setCorreoEmpresa(e.target.value)} />
          </div>
          <div>
            <Label>Teléfono</Label>
            <Input type="tel" placeholder="+56 2 2345 6789" value={telefonoEmpresa} onChange={(e) => setTelefonoEmpresa(e.target.value)} />
          </div>
          <div>
            <Label>WhatsApp</Label>
            <Input type="tel" placeholder="+56 9 1234 5678" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
          <IconMapPin className="h-4 w-4 text-brand" />
          Dirección
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Región</Label>
            <Select value={region} onChange={(e) => onCambiarRegion(e.target.value)}>
              <option value="">Selecciona una región</option>
              {REGIONES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Comuna</Label>
            <Select value={comuna} onChange={(e) => setComuna(e.target.value)} disabled={!region}>
              <option value="">{region ? "Selecciona una comuna" : "Elige una región primero"}</option>
              {comunasDisponibles.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Calle</Label>
            <Input type="text" value={calle} onChange={(e) => setCalle(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Número</Label>
              <Input type="text" value={numero} onChange={(e) => setNumero(e.target.value)} />
            </div>
            <div>
              <Label>Depto/Oficina</Label>
              <Input type="text" value={depto} onChange={(e) => setDepto(e.target.value)} />
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <IconWallet className="h-4 w-4 text-brand" />
            Datos de pago
          </h2>
          <button
            type="button"
            role="switch"
            aria-checked={pagoActivado}
            onClick={() => setPagoActivado((v) => !v)}
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${pagoActivado ? "bg-brand" : "bg-border"}`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                pagoActivado ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>
        <p className="mb-4 text-xs text-muted">
          Datos de la cuenta bancaria donde tu empresa recibe pagos por transferencia — se muestran
          en las cotizaciones/cobranzas cuando está activado.
        </p>
        {pagoActivado && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Banco</Label>
              <Select value={banco} onChange={(e) => setBanco(e.target.value)}>
                <option value="">Selecciona un banco</option>
                {BANCOS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Tipo de cuenta</Label>
              <Select value={tipoCuenta} onChange={(e) => setTipoCuenta(e.target.value as TipoCuenta)}>
                {TIPOS_CUENTA.map((t) => (
                  <option key={t.valor} value={t.valor}>
                    {t.etiqueta}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Número de cuenta</Label>
              <Input type="text" value={numeroCuenta} onChange={(e) => setNumeroCuenta(e.target.value)} />
            </div>
            <div>
              <Label>Titular</Label>
              <Input type="text" value={titular} onChange={(e) => setTitular(e.target.value)} />
            </div>
          </div>
        )}
      </Card>

      {errorDatos && <ErrorText>{errorDatos}</ErrorText>}
      {avisoDatos && <SuccessText>{avisoDatos}</SuccessText>}
      <Button type="button" onClick={onGuardarDatos} disabled={guardandoDatos} className="self-start">
        {guardandoDatos ? "Guardando…" : "Guardar datos de la empresa"}
      </Button>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="flex flex-col gap-6">
          <Card>
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
              <IconBriefcase className="h-4 w-4 text-brand" />
              Logo
            </h2>
            <div className="flex items-center gap-4">
              {usuario.empresa.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={usuario.empresa.logo_url}
                  alt={`Logo de ${usuario.empresa.nombre}`}
                  className="h-16 w-16 rounded-xl border border-border object-cover"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-dashed border-border text-xs text-muted">
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
                className={`flex flex-1 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-5 text-center transition-colors ${
                  arrastrando ? "border-brand bg-brand-soft" : "border-border hover:border-brand hover:bg-surface-sunken"
                }`}
              >
                <p className="text-sm font-medium text-foreground">
                  {subiendoLogo ? "Subiendo…" : "Arrastra una imagen o haz clic para elegir"}
                </p>
                <p className="mt-1 text-xs text-muted">Cuadrado, mín. 200×200px · PNG, JPG o WEBP · máx. 2MB</p>
              </div>
            </div>
            {errorLogo && (
              <div className="mt-2">
                <ErrorText>{errorLogo}</ErrorText>
              </div>
            )}
          </Card>

          <Card>
            <h2 className="mb-1 text-sm font-semibold text-foreground">Color de acento</h2>
            <p className="mb-4 text-xs text-muted">
              Se usa para resaltar acciones y estados en la app. El resto de la interfaz mantiene la identidad de Bitácora. Tu logo se muestra igual.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Color de acento</Label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="h-10 w-14 cursor-pointer rounded-lg border border-border bg-surface p-1"
                  />
                  <span className="text-sm text-muted">{color}</span>
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <h2 className="mb-4 text-sm font-semibold text-foreground">Tipografía y moneda</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Tipografía</Label>
                <Select value={fuente} onChange={(e) => setFuente(e.target.value)}>
                  {FUENTES.map((f) => (
                    <option key={f.valor} value={f.valor}>
                      {f.etiqueta}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Moneda</Label>
                <Select value={moneda} onChange={(e) => setMoneda(e.target.value)}>
                  {MONEDAS.map((m) => (
                    <option key={m.valor} value={m.valor}>
                      {m.etiqueta}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </Card>

          {errorMarca && <ErrorText>{errorMarca}</ErrorText>}
          {avisoMarca && <SuccessText>{avisoMarca}</SuccessText>}
          <div className="flex gap-3">
            <Button type="button" onClick={onGuardarMarca} disabled={guardandoMarca}>
              {guardandoMarca ? "Guardando…" : "Guardar marca"}
            </Button>
            <Button type="button" variant="outline" onClick={onRestablecerMarca} disabled={restableciendo}>
              {restableciendo ? "Restableciendo…" : "Restablecer valores por defecto"}
            </Button>
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Vista previa en vivo</p>
          <div className="overflow-hidden rounded-2xl border border-border" style={previewStyle}>
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
                  <IconHome className="h-3 w-3" />
                  <span className="text-[10px] font-medium">Dashboard</span>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1.5 text-muted">
                  <IconClipboardCheck className="h-3 w-3" />
                  <span className="text-[10px] font-medium">Órdenes</span>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1.5 text-muted">
                  <IconSparkle className="h-3 w-3" />
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
          <p className="mt-2 text-xs text-muted">Así se ve con los cambios sin guardar todavía.</p>
        </div>
      </div>
    </div>
  );
}
