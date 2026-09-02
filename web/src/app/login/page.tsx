"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { API_URL } from "@/lib/api";
import { resolverDestinoPostLogin } from "@/lib/accesoPostLogin";
import { AuthLayout } from "@/components/AuthLayout";
import { Button, ErrorText, Input, Label } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Paso 2 — solo si el usuario tiene 2FA activo (ver POST /api/auth/login).
  const [ticket, setTicket] = useState<string | null>(null);
  const [metodo, setMetodo] = useState<"totp" | "email" | null>(null);
  const [codigo, setCodigo] = useState("");

  async function continuarConSesion(accessToken: string, refreshToken: string) {
    await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    const r = await resolverDestinoPostLogin();
    setCargando(false);
    if ("error" in r) {
      setError(r.error);
      return;
    }
    router.push(r.destino);
  }

  // Bloque A: login con Google — flujo OAuth de Supabase, separado del
  // login por contraseña de arriba (ese pasa por /api/auth/login para
  // el gate de 2FA). El callback en /auth/callback hace el mismo
  // chequeo de "usuario ya asociado a una empresa" vía /api/me.
  const [errorGoogle, setErrorGoogle] = useState<string | null>(null);

  async function onGoogleClick() {
    setErrorGoogle(null);
    const { error: errorOAuth } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (errorOAuth) setErrorGoogle("No se pudo iniciar sesión con Google. Intenta de nuevo.");
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setCargando(true);

    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setCargando(false);
      setError(body.error ?? "No se pudo iniciar sesión");
      return;
    }

    if (body.requiere_codigo) {
      setCargando(false);
      setTicket(body.ticket);
      setMetodo(body.metodo);
      return;
    }

    await continuarConSesion(body.access_token, body.refresh_token);
  }

  async function onSubmitCodigo(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setCargando(true);

    const res = await fetch(`${API_URL}/api/auth/login/verificar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticket, codigo }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setCargando(false);
      setError(body.error ?? "Código incorrecto");
      return;
    }

    await continuarConSesion(body.access_token, body.refresh_token);
  }

  if (ticket) {
    return (
      <AuthLayout title="Verificación en dos pasos" subtitle={metodo === "totp" ? "Ingresa el código de tu app de autenticación" : "Te enviamos un código a tu correo"}>
        <form onSubmit={onSubmitCodigo} className="flex flex-col gap-4">
          <div>
            <Label>Código de 6 dígitos</Label>
            <Input
              type="text"
              inputMode="numeric"
              autoFocus
              maxLength={6}
              required
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
            />
          </div>
          {error && <ErrorText>{error}</ErrorText>}
          <Button type="submit" disabled={cargando || codigo.length !== 6} className="mt-2 w-full">
            {cargando ? "Verificando…" : "Verificar"}
          </Button>
          <button
            type="button"
            onClick={() => {
              setTicket(null);
              setMetodo(null);
              setCodigo("");
              setError(null);
            }}
            className="text-sm font-medium text-muted hover:text-brand"
          >
            Volver a intentar con otra cuenta
          </button>
        </form>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Iniciar sesión"
      subtitle="Entra a tu cuenta de Bitácora"
      footer={
        <span className="text-muted">
          ¿No tienes cuenta?{" "}
          <Link href="/registro" className="font-medium text-brand hover:underline">
            Crear una
          </Link>
        </span>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div>
          <Label>Correo</Label>
          <Input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <Label>Contraseña</Label>
          <Input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && <ErrorText>{error}</ErrorText>}
        <Button type="submit" disabled={cargando} className="mt-2 w-full">
          {cargando ? "Entrando…" : "Entrar"}
        </Button>
      </form>

      <div className="my-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted">o</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <button
        type="button"
        onClick={onGoogleClick}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-brand-soft"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
          <path fill="#4285F4" d="M23.49 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.44c-.28 1.48-1.13 2.74-2.4 3.58v2.98h3.88c2.27-2.09 3.57-5.17 3.57-8.75z" />
          <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-2.98c-1.08.72-2.45 1.15-4.05 1.15-3.11 0-5.75-2.1-6.69-4.92H1.3v3.07C3.26 21.3 7.31 24 12 24z" />
          <path fill="#FBBC05" d="M5.31 14.34A7.2 7.2 0 0 1 4.9 12c0-.81.14-1.6.4-2.34V6.6H1.3A11.98 11.98 0 0 0 0 12c0 1.94.46 3.77 1.3 5.4z" />
          <path fill="#EA4335" d="M12 4.75c1.76 0 3.34.6 4.58 1.79l3.44-3.44C17.94 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.3 6.6l4 3.06C6.25 6.85 8.89 4.75 12 4.75z" />
        </svg>
        Iniciar sesión con Google
      </button>
      {errorGoogle && (
        <div className="mt-3">
          <ErrorText>{errorGoogle}</ErrorText>
        </div>
      )}
    </AuthLayout>
  );
}
