"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { AuthLayout } from "@/components/AuthLayout";
import { Button, Input } from "@bitacora/ui/web";

// PASO 6 (sistema de diseño) — migrado. Ver docs/design-system.md.
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
        <p className="font-ds-body text-ds-small text-ds-accent-700">{error}</p>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-ds-4">
          <p className="font-ds-body text-ds-small text-ds-text/70">Elige una contraseña para tu cuenta.</p>
          <Input etiqueta="Contraseña" tipo="password" requerido minLongitud={6} valor={password} onCambio={setPassword} placeholder="Mínimo 6 caracteres" />
          <Input etiqueta="Confirmar contraseña" tipo="password" requerido valor={confirmar} onCambio={setConfirmar} />
          <label className="flex items-start gap-ds-2 font-ds-body text-ds-small text-ds-text/70">
            <input
              type="checkbox"
              className="mt-0.5 accent-[var(--ds-brand)]"
              checked={acepto}
              onChange={(e) => setAcepto(e.target.checked)}
            />
            <span>
              Acepto la{" "}
              <Link href="/privacidad" target="_blank" className="text-ds-brand hover:underline">Política de Privacidad</Link>{" "}
              y los{" "}
              <Link href="/terminos" target="_blank" className="text-ds-brand hover:underline">Términos</Link>.
            </span>
          </label>
          <Button tipo="submit" bloque deshabilitado={guardando || !acepto} cargando={guardando}>
            Entrar
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
