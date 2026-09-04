"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { DashboardShell } from "@/components/DashboardShell";
import { Badge, Button, Card, ErrorText, Input, Label, PageHeader, Select, SuccessText } from "@/components/ui";
import { IconChevronLeft } from "@/components/icons";
import { EstadoCargando } from "@/components/estados";
import { useUsuarioShell } from "@/lib/useUsuarioShell";
import { remuneraciones, type FilaDatosLaborales } from "@/lib/remuneracionesApi";
import { AFP_CHILE, ISAPRES_CHILE } from "@bitacora/shared";

const VACIO = {
  rut: "",
  apellido_paterno: "",
  apellido_materno: "",
  tipo_contrato: "indefinido",
  fecha_ingreso: "",
  sueldo_base: "",
  gratificacion_legal: true,
  colacion_mensual: "",
  movilizacion_mensual: "",
  afp: "",
  sistema_salud: "fonasa",
  plan_isapre_uf: "",
  codigo_isapre: "",
  cargas_familiares: "",
};

export default function DatosLaboralesPage() {
  const { usuario } = useUsuarioShell();
  const [filas, setFilas] = useState<FilaDatosLaborales[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>(VACIO);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      setFilas(await remuneraciones.datosLaborales());
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar");
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  function abrir(f: FilaDatosLaborales) {
    setEditId(f.usuario.id);
    setAviso(null);
    const d = f.datos_laborales;
    setForm(
      d
        ? {
            rut: f.usuario.rut ?? "",
            apellido_paterno: d.apellido_paterno ?? "",
            apellido_materno: d.apellido_materno ?? "",
            tipo_contrato: d.tipo_contrato,
            fecha_ingreso: d.fecha_ingreso ?? "",
            sueldo_base: String(d.sueldo_base || ""),
            gratificacion_legal: d.gratificacion_legal,
            colacion_mensual: String(d.colacion_mensual || ""),
            movilizacion_mensual: String(d.movilizacion_mensual || ""),
            afp: d.afp ?? "",
            sistema_salud: d.sistema_salud,
            plan_isapre_uf: d.plan_isapre_uf ? String(d.plan_isapre_uf) : "",
            codigo_isapre: d.codigo_isapre ?? "",
            cargas_familiares: String(d.cargas_familiares || ""),
          }
        : { ...VACIO, rut: f.usuario.rut ?? "" }
    );
  }

  async function guardar(usuarioId: string) {
    setGuardando(true);
    setError(null);
    try {
      await remuneraciones.guardarDatosLaborales(usuarioId, form);
      setEditId(null);
      setAviso("Datos guardados.");
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setGuardando(false);
    }
  }

  if (!usuario) return null;
  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <DashboardShell usuario={usuario}>
      <Link href="/dashboard/remuneraciones" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">
        <IconChevronLeft className="h-4 w-4" />
        Liquidaciones
      </Link>
      <PageHeader title="Datos del equipo" subtitle="Contrato, previsión y haberes fijos de cada colaborador (para calcular su liquidación)" />

      <div className="my-4">
        {error && <ErrorText>{error}</ErrorText>}
        {aviso && <SuccessText>{aviso}</SuccessText>}
      </div>

      {filas === null && <EstadoCargando />}

      {filas && (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-sunken font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
                <th className="px-5 py-3 font-medium">Colaborador</th>
                <th className="px-5 py-3 font-medium">Contrato</th>
                <th className="px-5 py-3 font-medium">Sueldo base</th>
                <th className="px-5 py-3 font-medium">Previsión</th>
                <th className="px-5 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => {
                const d = f.datos_laborales;
                return (
                  <Fragment key={f.usuario.id}>
                    <tr className="border-b border-border last:border-0">
                      <td className="px-5 py-3 font-medium text-foreground">
                        {f.usuario.nombre} {!f.usuario.activo && <span className="text-xs text-muted">(inactivo)</span>}
                      </td>
                      <td className="px-5 py-3 text-muted">{d ? d.tipo_contrato.replace("_", " ") : <Badge value="pendiente" />}</td>
                      <td className="px-5 py-3 tabular-nums text-muted">{d?.sueldo_base ? `$${d.sueldo_base.toLocaleString("es-CL")}` : "—"}</td>
                      <td className="px-5 py-3 text-muted">
                        {d ? `${(d.afp ?? "sin AFP").toUpperCase()} · ${d.sistema_salud === "isapre" ? "Isapre" : "Fonasa"}` : "—"}
                      </td>
                      <td className="px-5 py-3">
                        <button
                          type="button"
                          onClick={() => (editId === f.usuario.id ? setEditId(null) : abrir(f))}
                          className="text-xs font-medium text-brand hover:underline"
                        >
                          {editId === f.usuario.id ? "Cerrar" : d ? "Editar" : "Configurar"}
                        </button>
                      </td>
                    </tr>
                    {editId === f.usuario.id && (
                      <tr className="border-b border-border bg-brand-soft/20">
                        <td colSpan={5} className="px-5 py-4">
                          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            <div>
                              <Label>RUT</Label>
                              <Input placeholder="12.345.678-9" value={String(form.rut)} onChange={(e) => set("rut", e.target.value)} />
                            </div>
                            <div>
                              <Label>Apellido paterno</Label>
                              <Input value={String(form.apellido_paterno)} onChange={(e) => set("apellido_paterno", e.target.value)} />
                            </div>
                            <div>
                              <Label>Apellido materno</Label>
                              <Input value={String(form.apellido_materno)} onChange={(e) => set("apellido_materno", e.target.value)} />
                            </div>
                            <div>
                              <Label>Tipo de contrato</Label>
                              <Select value={String(form.tipo_contrato)} onChange={(e) => set("tipo_contrato", e.target.value)}>
                                <option value="indefinido">Indefinido</option>
                                <option value="plazo_fijo">Plazo fijo</option>
                                <option value="por_obra">Por obra / faena</option>
                              </Select>
                            </div>
                            <div>
                              <Label>Fecha de ingreso</Label>
                              <Input type="date" value={String(form.fecha_ingreso)} onChange={(e) => set("fecha_ingreso", e.target.value)} />
                            </div>
                            <div>
                              <Label>Sueldo base ($)</Label>
                              <Input type="number" value={String(form.sueldo_base)} onChange={(e) => set("sueldo_base", e.target.value)} />
                            </div>
                            <div>
                              <Label>Colación mensual ($)</Label>
                              <Input type="number" value={String(form.colacion_mensual)} onChange={(e) => set("colacion_mensual", e.target.value)} />
                            </div>
                            <div>
                              <Label>Movilización mensual ($)</Label>
                              <Input
                                type="number"
                                value={String(form.movilizacion_mensual)}
                                onChange={(e) => set("movilizacion_mensual", e.target.value)}
                              />
                            </div>
                            <div>
                              <Label>AFP</Label>
                              <Select value={String(form.afp)} onChange={(e) => set("afp", e.target.value)}>
                                <option value="">Sin AFP</option>
                                {AFP_CHILE.map((a) => (
                                  <option key={a.afp} value={a.afp}>
                                    {a.nombre}
                                  </option>
                                ))}
                              </Select>
                            </div>
                            <div>
                              <Label>Sistema de salud</Label>
                              <Select value={String(form.sistema_salud)} onChange={(e) => set("sistema_salud", e.target.value)}>
                                <option value="fonasa">Fonasa</option>
                                <option value="isapre">Isapre</option>
                              </Select>
                            </div>
                            {form.sistema_salud === "isapre" && (
                              <>
                                <div>
                                  <Label>Plan Isapre (UF)</Label>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    value={String(form.plan_isapre_uf)}
                                    onChange={(e) => set("plan_isapre_uf", e.target.value)}
                                  />
                                </div>
                                <div>
                                  <Label>Isapre</Label>
                                  <Select value={String(form.codigo_isapre)} onChange={(e) => set("codigo_isapre", e.target.value)}>
                                    <option value="">Elegir…</option>
                                    {ISAPRES_CHILE.map((i) => (
                                      <option key={i.codigo} value={i.codigo}>
                                        {i.nombre}
                                      </option>
                                    ))}
                                  </Select>
                                </div>
                              </>
                            )}
                            <div>
                              <Label>Cargas familiares</Label>
                              <Input
                                type="number"
                                value={String(form.cargas_familiares)}
                                onChange={(e) => set("cargas_familiares", e.target.value)}
                              />
                            </div>
                            <label className="flex items-center gap-2 self-end pb-2.5 text-sm text-foreground">
                              <input
                                type="checkbox"
                                checked={Boolean(form.gratificacion_legal)}
                                onChange={(e) => set("gratificacion_legal", e.target.checked)}
                              />
                              Paga gratificación (Art. 50)
                            </label>
                          </div>
                          <div className="mt-3 flex gap-2">
                            <Button type="button" onClick={() => guardar(f.usuario.id)} disabled={guardando}>
                              {guardando ? "Guardando…" : "Guardar"}
                            </Button>
                            <Button type="button" variant="ghost" onClick={() => setEditId(null)}>
                              Cancelar
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </DashboardShell>
  );
}
