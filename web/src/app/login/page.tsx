"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { AuthLayout } from "@/components/AuthLayout";
import { Button, ErrorText, Input, Label } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setCargando(true);

    const { error: errorLogin } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (errorLogin) {
      setCargando(false);
      setError(errorLogin.message);
      return;
    }

    const res = await apiFetch("/api/me");
    setCargando(false);
    if (!res.ok) {
      setError("No se pudo verificar la cuenta. Intenta de nuevo.");
      return;
    }
    const { usuario } = await res.json();
    router.push(usuario ? "/dashboard" : "/onboarding");
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
