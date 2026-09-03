"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { AuthLayout } from "@/components/AuthLayout";
import { Button, ErrorText, Input, Label } from "@/components/ui";

export default function InvitacionPage() {
  const router = useRouter();
  const [verificando, setVerificando] = useState(true);
  const [password, setPassword] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [acepto, setAcepto] = useState(false);
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
    if (!acepto) {
      setError("Debes aceptar la Política de Privacidad y los Términos para continuar.");
      return;
    }
    setGuardando(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setGuardando(false);
      setError(error.message);
      return;
    }
    // Ley 21.719 — deja constancia de la aceptación.
    await apiFetch("/api/consentimiento", { method: "POST" }).catch(() => {});
    setGuardando(false);
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
          <label className="flex items-start gap-2 text-sm text-muted">
            <input type="checkbox" className="mt-0.5" checked={acepto} onChange={(e) => setAcepto(e.target.checked)} />
            <span>
              Acepto la{" "}
              <Link href="/privacidad" target="_blank" className="text-brand hover:underline">Política de Privacidad</Link>{" "}
              y los{" "}
              <Link href="/terminos" target="_blank" className="text-brand hover:underline">Términos</Link>.
            </span>
          </label>
          <Button type="submit" disabled={guardando || !acepto} className="mt-2 w-full">
            {guardando ? "Guardando…" : "Entrar"}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
