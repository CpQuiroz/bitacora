"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Rol, Usuario } from "@bitacora/shared";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { DashboardShell } from "@/components/DashboardShell";
import {
  Badge,
  Button,
  Card,
  ErrorText,
  Input,
  Label,
  PageHeader,
  Select,
  SuccessText,
} from "@/components/ui";
import { IconMail, IconUsers } from "@/components/icons";

const ROLES: { value: Rol; label: string }[] = [
  { value: "chofer", label: "Chofer / técnico" },
  { value: "contador", label: "Contador" },
  { value: "admin", label: "Admin" },
];

export default function EquipoPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<{ nombre: string; rol: string; empresaNombre: string } | null>(null);
  const [usuarios, setUsuarios] = useState<Usuario[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const [invitando, setInvitando] = useState(false);

  const [email, setEmail] = useState("");
  const [nombre, setNombre] = useState("");
  const [rol, setRol] = useState<Rol>("chofer");

  async function cargar() {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      router.replace("/login");
      return;
    }
    const [resMe, resUsuarios] = await Promise.all([
      apiFetch("/api/me"),
      apiFetch("/api/usuarios"),
    ]);
    if (resMe.ok) {
      const { usuario: u } = await resMe.json();
      if (u) setUsuario({ nombre: u.nombre, rol: u.rol, empresaNombre: u.empresa?.nombre ?? "" });
    }
    if (!resUsuarios.ok) {
      setError("No se pudo cargar el equipo");
      return;
    }
    setUsuarios(await resUsuarios.json());
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setExito(null);
    setInvitando(true);
    const res = await apiFetch("/api/usuarios/invitar", {
      method: "POST",
      body: JSON.stringify({ email, nombre, rol }),
    });
    setInvitando(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setFormError(body.error ?? "No se pudo invitar al usuario");
      return;
    }
    setExito(`Invitación enviada a ${email}`);
    setEmail("");
    setNombre("");
    setRol("chofer");
    cargar();
  }

  if (!usuario) return null;

  return (
    <DashboardShell usuario={usuario}>
      <PageHeader title="Equipo" subtitle="Invita choferes, técnicos y contadores" />

      <Card className="my-6">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
          <IconMail className="h-4 w-4 text-brand" />
          Invitar a alguien nuevo
        </h2>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Correo</Label>
              <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <Label>Nombre</Label>
              <Input type="text" required value={nombre} onChange={(e) => setNombre(e.target.value)} />
            </div>
            <div>
              <Label>Rol</Label>
              <Select value={rol} onChange={(e) => setRol(e.target.value as Rol)}>
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          {formError && <ErrorText>{formError}</ErrorText>}
          {exito && <SuccessText>{exito}</SuccessText>}
          <Button type="submit" disabled={invitando} className="self-start">
            {invitando ? "Invitando…" : "Invitar"}
          </Button>
        </form>
      </Card>

      {error && <ErrorText>{error}</ErrorText>}
      {usuarios === null && !error && <p className="text-sm text-muted">Cargando…</p>}
      {usuarios?.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
          <IconUsers className="h-8 w-8 text-muted" />
          <p className="text-sm text-muted">Todavía no hay nadie en el equipo.</p>
        </div>
      )}
      {usuarios && usuarios.length > 0 && (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted">
                <th className="px-5 py-3 font-medium">Nombre</th>
                <th className="px-5 py-3 font-medium">Rol</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id} className="border-b border-border last:border-0 hover:bg-brand-soft/40">
                  <td className="px-5 py-3 font-medium text-foreground">{u.nombre}</td>
                  <td className="px-5 py-3">
                    <Badge value={u.rol} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </DashboardShell>
  );
}
