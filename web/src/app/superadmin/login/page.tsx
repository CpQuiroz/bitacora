"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AuthLayout } from "@/components/AuthLayout";
import { Button, ErrorText, Input, Label } from "@/components/ui";
import { superadminFetch, guardarTokenSuperAdmin } from "@/lib/superadminApi";

export default function SuperAdminLoginPage() {
  const router = useRouter();
  const [correo, setCorreo] = useState("");
  const [password, setPassword] = useState("");
  const [codigo, setCodigo] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setCargando(true);
    const res = await superadminFetch("/api/superadmin/login", {
      method: "POST",
      body: JSON.stringify({ correo, password, codigo }),
    });
    setCargando(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "No se pudo iniciar sesión");
      return;
    }
    const { token } = await res.json();
    guardarTokenSuperAdmin(token);
    router.push("/superadmin/resumen");
  }

  return (
    <AuthLayout title="Panel de Super-Admin" subtitle="Acceso reservado para la plataforma — correo, password y código de la app de autenticación">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div>
          <Label>Correo</Label>
          <Input type="email" required autoFocus value={correo} onChange={(e) => setCorreo(e.target.value)} />
        </div>
        <div>
          <Label>Password</Label>
          <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <div>
          <Label>Código de 6 dígitos</Label>
          <Input
            type="text"
            required
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            placeholder="123456"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))}
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
