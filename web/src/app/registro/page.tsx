"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { AuthLayout } from "@/components/AuthLayout";
import { Button, ErrorText, Input, Label } from "@/components/ui";
import { IconMail } from "@/components/icons";

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
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-brand-soft text-brand">
            <IconMail className="h-6 w-6" />
          </div>
          <p className="text-sm text-muted">
            Te mandamos un link de confirmación a <strong className="text-foreground">{email}</strong>.
            Confírmalo y después inicia sesión para crear tu empresa.
          </p>
          <Link href="/login" className="text-sm font-medium text-brand hover:underline">
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
        <span className="text-muted">
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="font-medium text-brand hover:underline">
            Inicia sesión
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
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mínimo 6 caracteres"
          />
        </div>
        {error && <ErrorText>{error}</ErrorText>}
        <Button type="submit" disabled={cargando} className="mt-2 w-full">
          {cargando ? "Creando cuenta…" : "Crear cuenta"}
        </Button>
      </form>
    </AuthLayout>
  );
}
