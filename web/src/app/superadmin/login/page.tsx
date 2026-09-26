"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AuthLayout } from "@/components/AuthLayout";
import { Aviso, Button, Input } from "@bitacora/ui/web";
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
      <form onSubmit={onSubmit} className="flex flex-col gap-ds-4">
        <Input etiqueta="Correo" tipo="email" requerido autoFoco autoCapitalizar={false} valor={correo} onCambio={setCorreo} />
        <Input etiqueta="Password" tipo="password" requerido valor={password} onCambio={setPassword} />
        <Input
          etiqueta="Código de 6 dígitos"
          tipo="codigo"
          requerido
          minLongitud={6}
          maxLongitud={6}
          placeholder="123456"
          valor={codigo}
          onCambio={(v) => setCodigo(v.replace(/\D/g, "").slice(0, 6))}
        />
        {error && <Aviso tono="error">{error}</Aviso>}
        <div className="mt-ds-2">
          <Button tipo="submit" bloque deshabilitado={cargando}>
            {cargando ? "Entrando…" : "Entrar"}
          </Button>
        </div>
      </form>
    </AuthLayout>
  );
}
