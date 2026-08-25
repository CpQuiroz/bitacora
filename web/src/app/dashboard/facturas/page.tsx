"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Factura, Trabajo } from "@bitacora/shared";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { DashboardShell } from "@/components/DashboardShell";
import { Badge, Button, Card, ErrorText, Input, Label, PageHeader } from "@/components/ui";
import { IconPlus, IconReceipt } from "@/components/icons";

export default function FacturasPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<{ nombre: string; rol: string; empresaNombre: string } | null>(null);
  const [facturas, setFacturas] = useState<Factura[] | null>(null);
  const [trabajos, setTrabajos] = useState<Trabajo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const [cliente, setCliente] = useState("");
  const [semana, setSemana] = useState("");
  const [diasPlazo, setDiasPlazo] = useState("30");
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());

  async function cargar() {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      router.replace("/login");
      return;
    }
    const [resMe, resFacturas, resTrabajos] = await Promise.all([
      apiFetch("/api/me"),
      apiFetch("/api/facturas"),
      apiFetch("/api/trabajos"),
    ]);
    if (resMe.ok) {
      const { usuario: u } = await resMe.json();
      if (u) setUsuario({ nombre: u.nombre, rol: u.rol, empresaNombre: u.empresa?.nombre ?? "" });
    }
    if (!resFacturas.ok || !resTrabajos.ok) {
      setError("No se pudieron cargar las facturas");
      return;
    }
    setFacturas(await resFacturas.json());
    setTrabajos(await resTrabajos.json());
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleTrabajo(id: string) {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (seleccionados.size === 0) {
      setFormError("Selecciona al menos un trabajo");
      return;
    }
    setGuardando(true);
    const res = await apiFetch("/api/facturas", {
      method: "POST",
      body: JSON.stringify({
        cliente,
        semana,
        dias_plazo: Number(diasPlazo || 30),
        trabajo_ids: Array.from(seleccionados),
      }),
    });
    setGuardando(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setFormError(body.error ?? "No se pudo crear la factura");
      return;
    }
    setCliente("");
    setSemana("");
    setSeleccionados(new Set());
    cargar();
  }

  if (!usuario) return null;

  return (
    <DashboardShell usuario={usuario}>
      <PageHeader title="Facturas" subtitle="Arma facturas a partir de trabajos completados" />

      <Card className="my-6">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
          <IconPlus className="h-4 w-4 text-brand" />
          Nueva factura
        </h2>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <Label>Cliente a facturar</Label>
              <Input type="text" required value={cliente} onChange={(e) => setCliente(e.target.value)} />
            </div>
            <div>
              <Label>Semana</Label>
              <Input type="text" placeholder="ej: S33" value={semana} onChange={(e) => setSemana(e.target.value)} />
            </div>
          </div>
          <div className="w-40">
            <Label>Plazo de pago (días)</Label>
            <Input type="number" min="1" value={diasPlazo} onChange={(e) => setDiasPlazo(e.target.value)} />
          </div>

          <div>
            <Label>Trabajos a incluir</Label>
            {trabajos.length === 0 && (
              <p className="text-sm text-muted">
                No hay trabajos todavía —{" "}
                <Link href="/dashboard/trabajos" className="font-medium text-brand hover:underline">
                  crea uno primero
                </Link>
                .
              </p>
            )}
            <div className="flex max-h-48 flex-col gap-1 overflow-y-auto rounded-lg border border-border p-2">
              {trabajos.map((t) => (
                <label
                  key={t.id}
                  className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-brand-soft"
                >
                  <input
                    type="checkbox"
                    checked={seleccionados.has(t.id)}
                    onChange={() => toggleTrabajo(t.id)}
                    className="accent-brand"
                  />
                  <span className="text-foreground">{t.fecha} — {t.cliente}</span>
                  <span className="text-muted">${t.monto.toLocaleString("es-CL")}</span>
                </label>
              ))}
            </div>
          </div>

          {formError && <ErrorText>{formError}</ErrorText>}
          <Button type="submit" disabled={guardando} className="self-start">
            {guardando ? "Generando…" : "Generar factura"}
          </Button>
        </form>
      </Card>

      {error && <ErrorText>{error}</ErrorText>}
      {facturas === null && !error && <p className="text-sm text-muted">Cargando…</p>}
      {facturas?.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
          <IconReceipt className="h-8 w-8 text-muted" />
          <p className="text-sm text-muted">Todavía no hay facturas.</p>
        </div>
      )}
      {facturas && facturas.length > 0 && (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted">
                <th className="px-5 py-3 font-medium">Emisión</th>
                <th className="px-5 py-3 font-medium">Cliente</th>
                <th className="px-5 py-3 font-medium">Monto</th>
                <th className="px-5 py-3 font-medium">Vence</th>
                <th className="px-5 py-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {facturas.map((f) => (
                <tr key={f.id} className="border-b border-border last:border-0 hover:bg-brand-soft/40">
                  <td className="px-5 py-3">{f.fecha_emision}</td>
                  <td className="px-5 py-3 font-medium text-foreground">{f.cliente}</td>
                  <td className="px-5 py-3">${f.monto.toLocaleString("es-CL")}</td>
                  <td className="px-5 py-3">{f.fecha_vencimiento}</td>
                  <td className="px-5 py-3">
                    <Badge value={f.estado} />
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
