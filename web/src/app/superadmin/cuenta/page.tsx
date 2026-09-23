"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SuperAdminShell } from "@/components/SuperAdminShell";
import { Button, Card, ErrorText, Input, Label, PageHeader, Select } from "@/components/ui";
import { IconChevronLeft } from "@/components/icons";
import { obtenerTokenSuperAdmin, superadminFetch } from "@/lib/superadminApi";
import { guardarTemaSuperAdmin, type TemaSuperAdmin } from "@/lib/superadminTema";

type Cuenta = { correo: string; nombre: string; ultimo_login_en: string | null; creado_en: string; tema: TemaSuperAdmin };

const TEMAS: { value: TemaSuperAdmin; label: string }[] = [
  { value: "faena", label: "Faena (por defecto)" },
  { value: "taller", label: "Taller" },
  { value: "confianza", label: "Confianza" },
];

export default function SuperAdminCuentaPage() {
  const router = useRouter();
  const [cuenta, setCuenta] = useState<Cuenta | null>(null);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);

  // Estilo propio
  const [guardandoTema, setGuardandoTema] = useState(false);
  const [errorTema, setErrorTema] = useState<string | null>(null);

  // Cambiar contraseña
  const [passActual, setPassActual] = useState("");
  const [passNueva, setPassNueva] = useState("");
  const [passConfirma, setPassConfirma] = useState("");
  const [codigoPass, setCodigoPass] = useState("");
  const [guardandoPass, setGuardandoPass] = useState(false);
  const [errorPass, setErrorPass] = useState<string | null>(null);
  const [okPass, setOkPass] = useState(false);

  // Regenerar TOTP
  const [passTotp, setPassTotp] = useState("");
  const [codigoTotp, setCodigoTotp] = useState("");
  const [guardandoTotp, setGuardandoTotp] = useState(false);
  const [errorTotp, setErrorTotp] = useState<string | null>(null);
  const [totpNuevo, setTotpNuevo] = useState<{ secreto: string; otpauthUri: string } | null>(null);

  useEffect(() => {
    if (!obtenerTokenSuperAdmin()) {
      router.replace("/superadmin/login");
      return;
    }
    (async () => {
      const res = await superadminFetch("/api/superadmin/me");
      if (!res.ok) {
        if (res.status === 401) {
          router.replace("/superadmin/login");
          return;
        }
        setErrorCarga("No se pudo cargar tu cuenta");
        return;
      }
      setCuenta(await res.json());
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Optimista: el selector y el panel cambian al instante; si el guardado
  // falla se vuelve al anterior y se muestra el error REAL (antes, si el
  // fetch lanzaba — red/CORS —, la excepción se perdía: el selector
  // quedaba deshabilitado en el valor viejo sin ningún mensaje).
  async function onCambiarTema(nuevo: TemaSuperAdmin) {
    if (!cuenta || nuevo === cuenta.tema) return;
    const anterior = cuenta.tema;
    setErrorTema(null);
    setCuenta({ ...cuenta, tema: nuevo });
    guardarTemaSuperAdmin(nuevo);
    setGuardandoTema(true);
    try {
      const res = await superadminFetch("/api/superadmin/me/tema", { method: "PATCH", body: JSON.stringify({ tema: nuevo }) });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Error ${res.status}`);
      }
    } catch (e) {
      setCuenta((c) => (c ? { ...c, tema: anterior } : c));
      guardarTemaSuperAdmin(anterior);
      setErrorTema(`No se pudo guardar el estilo: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setGuardandoTema(false);
    }
  }

  async function onCambiarPassword(e: FormEvent) {
    e.preventDefault();
    setErrorPass(null);
    setOkPass(false);
    if (passNueva.length < 12) {
      setErrorPass("La contraseña nueva debe tener al menos 12 caracteres");
      return;
    }
    if (passNueva !== passConfirma) {
      setErrorPass("La confirmación no coincide");
      return;
    }
    setGuardandoPass(true);
    const res = await superadminFetch("/api/superadmin/me/cambiar-password", {
      method: "POST",
      body: JSON.stringify({ password_actual: passActual, password_nueva: passNueva, codigo: codigoPass }),
    });
    setGuardandoPass(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErrorPass(body.error ?? "No se pudo cambiar la contraseña");
      return;
    }
    setOkPass(true);
    setPassActual("");
    setPassNueva("");
    setPassConfirma("");
    setCodigoPass("");
  }

  async function onRegenerarTotp(e: FormEvent) {
    e.preventDefault();
    setErrorTotp(null);
    setTotpNuevo(null);
    setGuardandoTotp(true);
    const res = await superadminFetch("/api/superadmin/me/regenerar-totp", {
      method: "POST",
      body: JSON.stringify({ password_actual: passTotp, codigo: codigoTotp }),
    });
    setGuardandoTotp(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErrorTotp(body.error ?? "No se pudo regenerar el 2FA");
      return;
    }
    setTotpNuevo(await res.json());
    setPassTotp("");
    setCodigoTotp("");
  }

  return (
    <SuperAdminShell>
      <Link href="/superadmin" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">
        <IconChevronLeft className="h-4 w-4" />
        Empresas
      </Link>

      <PageHeader title="Mi cuenta" subtitle="Credenciales de tu acceso al Panel de Super-Admin" />

      {errorCarga && <ErrorText>{errorCarga}</ErrorText>}

      {cuenta && (
        <div className="my-6 flex flex-col gap-4">
          <Card>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <p className="text-xs text-muted">Nombre</p>
                <p className="text-sm font-medium text-foreground">{cuenta.nombre}</p>
              </div>
              <div>
                <p className="text-xs text-muted">Correo</p>
                <p className="text-sm font-medium text-foreground">{cuenta.correo}</p>
              </div>
              <div>
                <p className="text-xs text-muted">Último ingreso</p>
                <p className="text-sm font-medium text-foreground">
                  {cuenta.ultimo_login_en ? new Date(cuenta.ultimo_login_en).toLocaleString("es-CL") : "—"}
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <h2 className="mb-1 text-sm font-semibold text-foreground">Mi estilo</h2>
            <p className="mb-3 text-xs text-muted">
              Cómo ves vos el Panel de Super-Admin, en web y en mobile. No cambia el estilo de ninguna empresa (eso se elige en cada
              empresa).
            </p>
            <div className="max-w-xs">
              <Label>Tema</Label>
              <Select value={cuenta.tema} disabled={guardandoTema} onChange={(e) => onCambiarTema(e.target.value as TemaSuperAdmin)}>
                {TEMAS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </div>
            {errorTema && (
              <div className="mt-3">
                <ErrorText>{errorTema}</ErrorText>
              </div>
            )}
          </Card>

          <Card>
            <h2 className="mb-1 text-sm font-semibold text-foreground">Cambiar contraseña</h2>
            <p className="mb-4 text-xs text-muted">
              Para confirmar tu identidad se piden la contraseña actual y un código de tu app de autenticación.
            </p>
            <form onSubmit={onCambiarPassword} className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label>Contraseña actual</Label>
                <Input type="password" autoComplete="current-password" value={passActual} onChange={(e) => setPassActual(e.target.value)} required />
              </div>
              <div>
                <Label>Contraseña nueva (mín. 12)</Label>
                <Input type="password" autoComplete="new-password" value={passNueva} onChange={(e) => setPassNueva(e.target.value)} required />
              </div>
              <div>
                <Label>Repetir contraseña nueva</Label>
                <Input type="password" autoComplete="new-password" value={passConfirma} onChange={(e) => setPassConfirma(e.target.value)} required />
              </div>
              <div>
                <Label>Código (6 dígitos)</Label>
                <Input type="text" inputMode="numeric" maxLength={6} value={codigoPass} onChange={(e) => setCodigoPass(e.target.value)} required />
              </div>
              {errorPass && (
                <div className="sm:col-span-2">
                  <ErrorText>{errorPass}</ErrorText>
                </div>
              )}
              {okPass && <p className="text-sm text-brand sm:col-span-2">Contraseña actualizada.</p>}
              <div className="sm:col-span-2">
                <Button type="submit" disabled={guardandoPass}>
                  {guardandoPass ? "Guardando…" : "Cambiar contraseña"}
                </Button>
              </div>
            </form>
          </Card>

          <Card>
            <h2 className="mb-1 text-sm font-semibold text-foreground">Regenerar 2FA (TOTP)</h2>
            <p className="mb-4 text-xs text-muted">
              Genera una clave nueva y <strong>anula la actual</strong>. Úsalo si perdiste el acceso a tu app de autenticación o
              querés cambiar de dispositivo. La clave nueva se muestra una sola vez.
            </p>

            {totpNuevo ? (
              <div className="rounded-lg border border-brand/40 bg-brand-soft p-4 text-sm">
                <p className="font-medium text-foreground">Clave nueva — cárgala ahora en tu app (borrá primero la entrada vieja):</p>
                <p className="mt-2 font-mono text-base break-all text-foreground">{totpNuevo.secreto}</p>
                <p className="mt-2 text-xs text-muted break-all">{totpNuevo.otpauthUri}</p>
                <p className="mt-3 text-xs text-muted">No se vuelve a mostrar. La próxima vez que entres usá el código de esta clave.</p>
              </div>
            ) : (
              <form onSubmit={onRegenerarTotp} className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Contraseña actual</Label>
                  <Input type="password" autoComplete="current-password" value={passTotp} onChange={(e) => setPassTotp(e.target.value)} required />
                </div>
                <div>
                  <Label>Código actual (6 dígitos)</Label>
                  <Input type="text" inputMode="numeric" maxLength={6} value={codigoTotp} onChange={(e) => setCodigoTotp(e.target.value)} required />
                </div>
                {errorTotp && (
                  <div className="sm:col-span-2">
                    <ErrorText>{errorTotp}</ErrorText>
                  </div>
                )}
                <div className="sm:col-span-2">
                  <Button type="submit" variant="outline" disabled={guardandoTotp}>
                    {guardandoTotp ? "Generando…" : "Regenerar 2FA"}
                  </Button>
                </div>
              </form>
            )}
          </Card>
        </div>
      )}
    </SuperAdminShell>
  );
}
