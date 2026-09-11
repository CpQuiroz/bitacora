"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { AuthLayout } from "@/components/AuthLayout";
import { Button, Input } from "@bitacora/ui/web";

// PASO 6 (sistema de diseño) — migrado. Ver docs/design-system.md.
export default function RegistroPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [correoEnviado, setCorreoEnviado] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setCargando(true);

    // self_signup marca que esta cuenta se creó por autorregistro (trial):
    // /api/me la deja pasar a /onboarding aunque su correo no esté
    // autorizado en ninguna empresa (ver migración 72). Los que entran
    // con Google sin invitación no lo tienen → acceso denegado.
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { self_signup: true } },
    });

    setCargando(false);
    if (error) {
      setError(error.message);
      return;
    }
    if (data.session) {
      router.push("/onboarding");
      return;
    }
    setCorreoEnviado(true);
  }

  if (correoEnviado) {
    return (
      <AuthLayout title="Revisa tu correo">
        <div className="flex flex-col items-center gap-ds-4 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-ds-accent-200 text-ds-accent-800">
            <Mail size={22} strokeWidth={2.75} />
          </div>
          <p className="font-ds-body text-ds-small text-ds-text/70">
            Te mandamos un link de confirmación a <strong className="text-ds-text">{email}</strong>.
            Confírmalo y después inicia sesión para crear tu empresa.
          </p>
          <Link href="/login" className="font-ds-body text-ds-small font-medium text-ds-brand hover:underline">
            Ya confirmé, iniciar sesión
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Crear cuenta"
      subtitle="Empieza a usar Bitácora"
      footer={
        <span className="text-ds-text/70">
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="font-medium text-ds-brand hover:underline">
            Inicia sesión
          </Link>
        </span>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-ds-4">
        <Input etiqueta="Correo" tipo="email" requerido valor={email} onCambio={setEmail} />
        <Input
          etiqueta="Contraseña"
          tipo="password"
          requerido
          minLongitud={6}
          valor={password}
          onCambio={setPassword}
          placeholder="Mínimo 6 caracteres"
          error={error}
        />
        <Button tipo="submit" bloque deshabilitado={cargando} cargando={cargando}>
          Crear cuenta
        </Button>
      </form>
    </AuthLayout>
  );
}
