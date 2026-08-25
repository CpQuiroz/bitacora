"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { AuthLayout } from "@/components/AuthLayout";
import { Button, ErrorText, Input, Label } from "@/components/ui";

export default function InvitacionPage() {
  const router = useRouter();
  const [verificando, setVerificando] = useState(true);
  const [password, setPassword] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // El link del correo de invitación deja la sesión en el hash de la
    // URL; supabase-js la detecta y la guarda automáticamente al cargar.
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        setError(
          "El link de invitación no es válido o ya expiró. Pide que te reenvíen la invitación."
        );
      }
      setVerificando(false);
    });
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
      return;
    }
    if (password !== confirmar) {
      setError("Las contraseñas no coinciden");
      return;
    }
    setGuardando(true);
    const { error } = await supabase.auth.updateUser({ password });
    setGuardando(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/dashboard");
  }

  if (verificando) return null;

  return (
    <AuthLayout title="Bienvenido a Bitácora">
      {error ? (
        <ErrorText>{error}</ErrorText>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <p className="text-sm text-muted">Elige una contraseña para tu cuenta.</p>
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
          <div>
            <Label>Confirmar contraseña</Label>
            <Input
              type="password"
              required
              value={confirmar}
              onChange={(e) => setConfirmar(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={guardando} className="mt-2 w-full">
            {guardando ? "Guardando…" : "Entrar"}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
