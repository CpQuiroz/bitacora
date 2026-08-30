"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { apiFetch, API_URL } from "@/lib/api";
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
    const res = await apiFetch("/api/me");
    setCargando(false);
    if (!res.ok) {
      setError("No se pudo verificar la cuenta. Intenta de nuevo.");
      return;
    }
    const { usuario } = await res.json();
    router.push(usuario ? "/dashboard" : "/onboarding");
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
    </AuthLayout>
  );
}
