"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Camera, ChevronLeft, ClipboardCheck, Mail, Plus } from "lucide-react";
import type { AnalisisFoto, CatalogoItem, Plan, Cliente, OrdenServicio, OsItem, Trabajo, TipoOsTrabajo, Usuario } from "@bitacora/shared";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { abrirPdfOS } from "@/lib/descargarPdf";
import { CATEGORIAS_FOTO_OS, ETIQUETA_CATEGORIA_FOTO_OS, formatearCLP, formatearFolio, planPermiteIACompleta } from "@bitacora/shared";
import { DashboardShell, type UsuarioShell } from "@/components/DashboardShell";
import { Button, Card, Cifra, DatePicker, Input, Select, StatusBadge, Table, Textarea } from "@bitacora/ui/web";
import { InputMonto } from "@/components/InputMonto";
import { CatalogoSelectorModal, type ItemSeleccionadoCatalogo } from "@/components/CatalogoSelectorModal";
import { ComboboxResponsable } from "@/components/ComboboxResponsable";

type ItemOS = {
  catalogo_item_id: string | null;
  descripcion: string;
  cantidad: string;
  precio_unitario: string;
  // Solo si la empresa tiene precios_avanzados_activado (migración 116).
  costo: string;
  precio_mayorista: string;
  precio_minorista: string;
};

type OrdenConFirma = OrdenServicio & { firma_url_firmada: string | null };
type AnalisisFotoConUrl = AnalisisFoto & { url: string };

function aFecha(texto: string): Date | null {
  if (!texto) return null;
  const [y, m, d] = texto.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
function aTexto(fecha: Date | null): string {
  if (!fecha) return "";
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, "0");
  const d = String(fecha.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
type DetalleOS = Trabajo & {
  cliente_info: Cliente | null;
  responsable: Usuario | null;
  tipo: TipoOsTrabajo | null;
  orden: OrdenConFirma | null;
  items: OsItem[];
  fotos: AnalisisFotoConUrl[];
};

// Fase 3.3 — GET /api/trabajos/:id/pdf-versiones (ver trabajos.ts).
type VersionPdf = { id: string; version: number; informeIA: string | null; creadoEn: string | null; url: string };

// PASO 6 (sistema de diseño) — migrado. Ver docs/design-system.md.
// Seams conocidos: DashboardShell (fuera de este bucket) y
// CatalogoSelectorModal (compartido con Catálogo/Cotizaciones, 5
// pantallas — tocarlo ahora habría salido del alcance de "Órdenes").
export default function DetalleOrdenServicioPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [usuario, setUsuario] = useState<UsuarioShell | null>(null);
  const [detalle, setDetalle] = useState<DetalleOS | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [descargando, setDescargando] = useState(false);

  const [email, setEmail] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [avisoEnvio, setAvisoEnvio] = useState<string | null>(null);
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);

  const [generandoInforme, setGenerandoInforme] = useState(false);
  const [errorInforme, setErrorInforme] = useState<string | null>(null);
  // Fase 3.3 (23-sep-2026, pedido explícito): el Admin revisa/edita el
  // texto que generó la IA ANTES de empaquetarlo en una versión nueva
  // del PDF — separado de detalle.orden.informe_ia (el guardado real)
  // para no perder lo que se está tipeando si el fetch de abajo
  // recarga el detalle por otro motivo mientras se edita.
  const [informeEditado, setInformeEditado] = useState("");
  const [guardandoInforme, setGuardandoInforme] = useState(false);
  const [versiones, setVersiones] = useState<VersionPdf[] | null>(null);
  const [generandoVersion, setGenerandoVersion] = useState(false);
  const [errorVersion, setErrorVersion] = useState<string | null>(null);
  const [modulosVisibles, setModulosVisibles] = useState<string[]>([]);
  // Migración 116 — ver nota en ordenes/nueva/page.tsx.
  const [preciosAvanzados, setPreciosAvanzados] = useState(false);
  const [planEmpresa, setPlanEmpresa] = useState<Plan | null>(null);
  const [patrones, setPatrones] = useState("");

  const [eliminando, setEliminando] = useState(false);
  const [errorEliminar, setErrorEliminar] = useState<string | null>(null);

  const [editando, setEditando] = useState(false);
  const [descEdit, setDescEdit] = useState("");
  const [itemsEdit, setItemsEdit] = useState<ItemOS[]>([]);
  const [notasEdit, setNotasEdit] = useState("");
  const [ordenCompraEdit, setOrdenCompraEdit] = useState("");
  const [fechaEdit, setFechaEdit] = useState("");
  const [horaEdit, setHoraEdit] = useState("");
  const [datosEdit, setDatosEdit] = useState<Record<string, string>>({});
  const [responsableEdit, setResponsableEdit] = useState("");
  const [equipo, setEquipo] = useState<Usuario[]>([]);
  const [catalogo, setCatalogo] = useState<CatalogoItem[]>([]);
  const [selectorAbierto, setSelectorAbierto] = useState(false);
  const [guardandoEdit, setGuardandoEdit] = useState(false);
  const [errorEdit, setErrorEdit] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      router.replace("/login");
      return;
    }
    const [resMe, resDetalle, resCatalogo, resEquipo] = await Promise.all([
      apiFetch("/api/me"),
      apiFetch(`/api/ordenes-servicio/${params.id}`),
      apiFetch("/api/catalogo"),
      apiFetch("/api/usuarios"),
    ]);
    if (resCatalogo.ok) setCatalogo(await resCatalogo.json());
    if (resEquipo.ok) setEquipo(await resEquipo.json());
    if (resMe.ok) {
      const cuerpoMe = await resMe.json();
      const u = cuerpoMe.usuario;
      if (u) {
        setUsuario({ nombre: u.nombre, rol: u.rol, empresaNombre: u.empresa?.nombre ?? "", empresaLogoUrl: u.empresa?.logo_url ?? null, colorPrimario: u.empresa?.color_primario ?? null, tema: u.empresa?.tema ?? "faena", colorPrimarioForeground: u.empresa?.color_primario_foreground ?? null, colorSecundario: u.empresa?.color_secundario ?? null, fuente: u.empresa?.fuente ?? null, moneda: u.empresa?.moneda ?? "CLP" });
        setPreciosAvanzados(Boolean(u.empresa?.precios_avanzados_activado));
        setPlanEmpresa((u.empresa?.plan as Plan | undefined) ?? null);
      }
      if (Array.isArray(cuerpoMe.modulos_visibles)) setModulosVisibles(cuerpoMe.modulos_visibles);
    }
    if (!resDetalle.ok) {
      setError("No se pudo cargar la orden de servicio");
      return;
    }
    setDetalle(await resDetalle.json());
  }, [params.id, router]);

  // Fase 3.3 — historial de versiones del PDF.
  const cargarVersiones = useCallback(async () => {
    const res = await apiFetch(`/api/trabajos/${params.id}/pdf-versiones`);
    if (res.ok) setVersiones(await res.json());
  }, [params.id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Fase 3.3 — sincroniza el texto editable cuando cambia lo guardado
  // de verdad (recién cargado, o después de Generar/Guardar), y trae
  // el historial de versiones una vez que ya se sabe si la OS está
  // cerrada (antes de eso no puede haber ninguna versión creada).
  useEffect(() => {
    setInformeEditado(detalle?.orden?.informe_ia ?? "");
  }, [detalle?.orden?.informe_ia]);
  useEffect(() => {
    if (detalle?.orden?.firma_url_firmada || detalle?.orden?.cliente_no_disponible) void cargarVersiones();
  }, [detalle?.orden?.firma_url_firmada, detalle?.orden?.cliente_no_disponible, cargarVersiones]);

  async function onDescargarPdf() {
    setDescargando(true);
    const ok = await abrirPdfOS(params.id);
    setDescargando(false);
    if (!ok) setError("No se pudo generar el PDF");
  }

  async function onGenerarInforme() {
    setErrorInforme(null);
    setGenerandoInforme(true);
    const res = await apiFetch(`/api/trabajos/${params.id}/informe-ia`, {
      method: "POST",
      body: JSON.stringify({ patrones: patrones.trim() }),
    });
    setGenerandoInforme(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErrorInforme(body.error ?? "No se pudo generar el informe");
      return;
    }
    await cargar();
  }

  // Fase 3.3 — guarda el texto tal como quedó editado (sin volver a
  // llamar a la IA, eso es onGenerarInforme arriba).
  async function onGuardarInforme() {
    setErrorInforme(null);
    setGuardandoInforme(true);
    const res = await apiFetch(`/api/trabajos/${params.id}/informe-ia`, {
      method: "PATCH",
      body: JSON.stringify({ informe_ia: informeEditado }),
    });
    setGuardandoInforme(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErrorInforme(body.error ?? "No se pudo guardar");
      return;
    }
    await cargar();
  }

  // v1 (la original firmada) NO se pisa nunca — cada click acá crea
  // una fila NUEVA en el historial, con el texto de informeEditado ya
  // guardado (ver onGuardarInforme).
  async function onGenerarVersion() {
    setErrorVersion(null);
    setGenerandoVersion(true);
    const res = await apiFetch(`/api/trabajos/${params.id}/pdf-versiones`, { method: "POST" });
    setGenerandoVersion(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErrorVersion(body.error ?? "No se pudo generar la versión");
      return;
    }
    await cargarVersiones();
  }

  async function onEnviarEmail(e: FormEvent) {
    e.preventDefault();
    setAvisoEnvio(null);
    setErrorEnvio(null);
    if (!email.trim()) return;
    setEnviando(true);
    const res = await apiFetch(`/api/trabajos/${params.id}/pdf/enviar`, {
      method: "POST",
      body: JSON.stringify({ destinatario: email.trim() }),
    });
    setEnviando(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErrorEnvio(body.error ?? "No se pudo enviar el correo");
      return;
    }
    setAvisoEnvio(`PDF enviado a ${email.trim()}`);
    setEmail("");
  }

  const tieneFirma = Boolean(detalle?.orden?.firma_url_firmada);

  function abrirEdicion() {
    if (!detalle) return;
    setDescEdit(detalle.descripcion ?? "");
    setItemsEdit(
      detalle.items.map((it) => ({
        catalogo_item_id: it.catalogo_item_id,
        descripcion: it.descripcion,
        cantidad: String(it.cantidad),
        precio_unitario: String(it.precio_unitario),
        costo: it.costo != null ? String(it.costo) : "",
        precio_mayorista: it.precio_mayorista != null ? String(it.precio_mayorista) : "",
        precio_minorista: it.precio_minorista != null ? String(it.precio_minorista) : "",
      }))
    );
    setNotasEdit(detalle.notas_internas ?? "");
    setOrdenCompraEdit(detalle.orden?.orden_compra_cliente ?? "");
    setFechaEdit(detalle.fecha);
    setHoraEdit(detalle.hora_programada ?? "");
    setResponsableEdit(detalle.responsable_id ?? "");
    setDatosEdit(
      Object.fromEntries(
        Object.entries((detalle.datos ?? {}) as Record<string, unknown>).map(([k, v]) => [k, String(v ?? "")])
      )
    );
    setErrorEdit(null);
    setEditando(true);
  }

  function quitarItemEdit(i: number) {
    setItemsEdit((prev) => prev.filter((_, idx) => idx !== i));
  }
  function actualizarItemEdit(i: number, campo: keyof ItemOS, valor: string) {
    setItemsEdit((prev) => prev.map((it, idx) => (idx === i ? { ...it, [campo]: valor } : it)));
  }
  function onAgregarDesdeSelectorEdit(items: ItemSeleccionadoCatalogo[]) {
    setItemsEdit((prev) => [
      ...prev,
      ...items.map((item) => ({
        catalogo_item_id: item.catalogo_item_id,
        descripcion: item.descripcion,
        cantidad: String(item.cantidad),
        precio_unitario: String(item.precio_unitario),
        costo: item.costo != null ? String(item.costo) : "",
        precio_mayorista: item.precio_mayorista != null ? String(item.precio_mayorista) : "",
        precio_minorista: item.precio_minorista != null ? String(item.precio_minorista) : "",
      })),
    ]);
  }

  async function onGuardarEdicion() {
    setErrorEdit(null);
    setGuardandoEdit(true);
    const body: Record<string, unknown> = {
      notas_internas: notasEdit.trim() || null,
      fecha: fechaEdit,
      hora_programada: horaEdit || null,
    };
    if (usuario?.rol !== "colaborador") {
      body.responsable_id = responsableEdit || null;
      body.orden_compra_cliente = ordenCompraEdit.trim() || null;
    }
    if (detalle?.tipo && detalle.tipo.campos.length > 0) {
      body.datos = datosEdit;
    }
    if (!tieneFirma) {
      body.descripcion = descEdit.trim() || null;
      body.items = JSON.stringify(
        itemsEdit
          .filter((it) => it.descripcion.trim())
          .map((it) => ({
            catalogo_item_id: it.catalogo_item_id,
            descripcion: it.descripcion.trim(),
            cantidad: Number(it.cantidad || 0),
            precio_unitario: Number(it.precio_unitario || 0),
            costo: it.costo.trim() ? Number(it.costo) : null,
            precio_mayorista: it.precio_mayorista.trim() ? Number(it.precio_mayorista) : null,
            precio_minorista: it.precio_minorista.trim() ? Number(it.precio_minorista) : null,
          }))
      );
    }
    const res = await apiFetch(`/api/trabajos/${params.id}`, { method: "PATCH", body: JSON.stringify(body) });
    setGuardandoEdit(false);
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      setErrorEdit(errBody.error ?? "No se pudo guardar la orden de servicio");
      return;
    }
    setEditando(false);
    await cargar();
  }

  // Mismo patrón que Cotizaciones/Cobros: el botón directamente
  // desaparece una vez que la OS está bloqueada (firmada/finalizada),
  // no un mensaje de error al hacer clic. El backend (trabajos.ts,
  // trabajoBloqueado()) ya rechaza el delete en ese caso igual — doble
  // resguardo, no solo el frontend.
  async function onEliminar() {
    if (!confirm("¿Eliminar esta orden de servicio? Esta acción no se puede deshacer.")) return;
    setErrorEliminar(null);
    setEliminando(true);
    const res = await apiFetch(`/api/trabajos/${params.id}`, { method: "DELETE" });
    setEliminando(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErrorEliminar(body.error ?? "No se pudo eliminar la orden de servicio");
      return;
    }
    router.push("/dashboard/ordenes");
  }

  if (!usuario) return null;

  return (
    <DashboardShell usuario={usuario}>
      <Link href="/dashboard/ordenes" className="mb-ds-4 inline-flex items-center gap-ds-1 font-ds-body text-ds-small font-medium text-ds-brand hover:underline">
        <ChevronLeft size={16} strokeWidth={2.75} />
        Órdenes de Trabajo/Servicio
      </Link>

      {error && !detalle ? <p className="font-ds-body text-ds-small text-ds-accent-700">{error}</p> : null}

      {detalle ? (
        <>
          <div className="mb-ds-6 flex flex-col gap-ds-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="ds-heading text-ds-h2 text-ds-text">
                {formatearFolio("OS", detalle.orden?.folio) ?? "Orden de servicio"}
              </p>
              <p className="mt-ds-1 font-ds-body text-ds-small text-ds-text/70">
                {detalle.cliente_info?.nombre ?? detalle.cliente} · {detalle.fecha}
                {detalle.hora_programada ? ` ${detalle.hora_programada}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-ds-2">
              <StatusBadge estado={detalle.orden?.estado_os ?? "pendiente"} />
              {!editando ? (
                <Button variante="secundario" onPress={abrirEdicion}>
                  Editar
                </Button>
              ) : null}
            </div>
          </div>

          {editando ? (
            <div className="my-ds-6">
              <Card elevacion="md">
                <p className="mb-ds-4 font-ds-body text-ds-small font-semibold text-ds-text">Editar orden de servicio</p>

                {tieneFirma ? (
                  <p className="mb-ds-4 rounded-ds-md bg-ds-accent-100 px-ds-3 py-ds-2 font-ds-body text-ds-caption text-ds-accent-800">
                    Esta OS ya tiene firma de conformidad — los ítems y la descripción quedaron bloqueados. Solo las notas
                    internas siguen editables.
                  </p>
                ) : null}

                <div className="mb-ds-5 grid gap-ds-4 sm:grid-cols-2">
                  <DatePicker etiqueta="Fecha" valor={aFecha(fechaEdit)} onCambio={(f) => setFechaEdit(aTexto(f))} />
                  <Input etiqueta="Hora (opcional)" tipo="hora" valor={horaEdit} onCambio={setHoraEdit} />
                </div>

                {usuario?.rol !== "colaborador" ? (
                  <div className="mb-ds-5">
                    <label className="mb-ds-1 block font-ds-body text-ds-caption font-medium text-ds-text/70">Colaborador asignado</label>
                    <ComboboxResponsable
                      value={responsableEdit}
                      onChange={setResponsableEdit}
                      equipo={equipo}
                      opcionVacia="Sin asignar"
                      gestionHref="/dashboard/personas"
                      gestionLabel="Gestionar equipo"
                    />
                  </div>
                ) : null}

                {usuario?.rol !== "colaborador" ? (
                  <div className="mb-ds-5">
                    <Input
                      etiqueta="Orden de compra del cliente (opcional)"
                      valor={ordenCompraEdit}
                      onCambio={setOrdenCompraEdit}
                      placeholder="N° de OC del cliente"
                    />
                  </div>
                ) : null}

                <div className="mb-ds-5">
                  <Textarea etiqueta="Descripción" filas={2} valor={descEdit} onCambio={setDescEdit} deshabilitado={tieneFirma} />
                </div>

                {detalle.tipo && detalle.tipo.campos.some((c) => c.tipo !== "foto") ? (
                  <div className="mb-ds-5 grid gap-ds-3 rounded-ds-md bg-ds-neutral-200 p-ds-3 sm:grid-cols-2">
                    <p className="font-ds-body text-ds-caption font-medium text-ds-text/60 sm:col-span-2">
                      Datos medidos — {detalle.tipo.nombre}
                    </p>
                    {/* Campos tipo "foto" (migración 105) no se editan acá — no
                        hay cámara en desktop. El técnico las sube en el
                        celular; se ven en el PDF/informe de la OS. */}
                    {detalle.tipo.campos.filter((c) => c.tipo !== "foto").map((campo) =>
                      campo.tipo === "fecha" ? (
                        <DatePicker
                          key={campo.clave}
                          etiqueta={campo.etiqueta}
                          valor={aFecha(datosEdit[campo.clave] ?? "")}
                          onCambio={(f) => setDatosEdit((prev) => ({ ...prev, [campo.clave]: aTexto(f) }))}
                        />
                      ) : campo.tipo === "seleccion" ? (
                        <Select
                          key={campo.clave}
                          etiqueta={campo.etiqueta}
                          valor={datosEdit[campo.clave] ?? ""}
                          onCambio={(v) => setDatosEdit((prev) => ({ ...prev, [campo.clave]: v }))}
                          opciones={[{ valor: "", etiqueta: "Sin definir" }, ...(campo.opciones ?? []).map((o) => ({ valor: o, etiqueta: o }))]}
                        />
                      ) : (
                        <Input
                          key={campo.clave}
                          etiqueta={campo.etiqueta}
                          tipo={campo.tipo === "numero" ? "numero" : "texto"}
                          valor={datosEdit[campo.clave] ?? ""}
                          onCambio={(v) => setDatosEdit((prev) => ({ ...prev, [campo.clave]: v }))}
                        />
                      )
                    )}
                  </div>
                ) : null}

                <div className="mb-ds-5">
                  <div className="mb-ds-3 flex items-center justify-between">
                    <label className="font-ds-body text-ds-caption font-medium text-ds-text/70">Ítems / materiales</label>
                    {!tieneFirma ? (
                      <Button variante="secundario" tamano="sm" iconoIzq={<Plus size={14} strokeWidth={2.75} />} onPress={() => setSelectorAbierto(true)}>
                        Agregar del catálogo
                      </Button>
                    ) : null}
                  </div>
                  <div className="flex flex-col gap-ds-2">
                    {itemsEdit.map((it, i) => {
                      const cat = it.catalogo_item_id ? catalogo.find((c) => c.id === it.catalogo_item_id) : null;
                      const stock = cat && cat.tipo === "producto" && cat.stock_actual != null ? cat.stock_actual : null;
                      return (
                        <div key={i} className="flex flex-col gap-ds-2 border-b border-ds-divider pb-ds-2 last:border-0 last:pb-0">
                        <div className="grid grid-cols-[1fr_5rem_7rem_auto] items-start gap-ds-2">
                          <div>
                            <Input
                              placeholder="Descripción"
                              valor={it.descripcion}
                              deshabilitado={tieneFirma}
                              onCambio={(v) => actualizarItemEdit(i, "descripcion", v)}
                            />
                            {stock != null ? (
                              <p className={`mt-ds-1 font-ds-body text-ds-caption ${Number(it.cantidad || 0) > stock ? "text-ds-accent-700" : "text-ds-text/60"}`}>
                                Stock: {stock}
                              </p>
                            ) : null}
                          </div>
                          <Input
                            tipo="numero"
                            valor={it.cantidad}
                            deshabilitado={tieneFirma}
                            onCambio={(v) => actualizarItemEdit(i, "cantidad", v)}
                          />
                          <InputMonto value={it.precio_unitario} disabled={tieneFirma} onChange={(v) => actualizarItemEdit(i, "precio_unitario", v)} moneda={usuario.moneda} />
                          {!tieneFirma ? (
                            <Button variante="ghost" tamano="sm" onPress={() => quitarItemEdit(i)}>
                              Quitar
                            </Button>
                          ) : null}
                        </div>
                        {preciosAvanzados && (
                          <div className="grid grid-cols-3 gap-ds-2">
                            <InputMonto value={it.costo} disabled={tieneFirma} onChange={(v) => actualizarItemEdit(i, "costo", v)} moneda={usuario.moneda} placeholder="Costo" />
                            <InputMonto value={it.precio_mayorista} disabled={tieneFirma} onChange={(v) => actualizarItemEdit(i, "precio_mayorista", v)} moneda={usuario.moneda} placeholder="P. mayorista" />
                            <InputMonto value={it.precio_minorista} disabled={tieneFirma} onChange={(v) => actualizarItemEdit(i, "precio_minorista", v)} moneda={usuario.moneda} placeholder="P. minorista" />
                          </div>
                        )}
                        </div>
                      );
                    })}
                    {itemsEdit.length === 0 ? <p className="font-ds-body text-ds-small text-ds-text/60">Sin ítems.</p> : null}
                  </div>
                </div>

                <div className="mb-ds-5">
                  <Textarea etiqueta="Notas internas (no se muestran al cliente)" filas={3} valor={notasEdit} onCambio={setNotasEdit} />
                </div>

                {errorEdit ? <p className="mb-ds-4 font-ds-body text-ds-small text-ds-accent-700">{errorEdit}</p> : null}
                <div className="flex gap-ds-2">
                  <Button onPress={onGuardarEdicion} cargando={guardandoEdit}>
                    Guardar cambios
                  </Button>
                  <Button variante="ghost" onPress={() => setEditando(false)}>
                    Cancelar
                  </Button>
                </div>

                <CatalogoSelectorModal
                  open={selectorAbierto}
                  onClose={() => setSelectorAbierto(false)}
                  onAgregar={onAgregarDesdeSelectorEdit}
                  moneda={usuario.moneda ?? "CLP"}
                  avisaDescuentoStock
                />
              </Card>
            </div>
          ) : null}

          <div className="my-ds-6">
            <Card>
              <p className="mb-ds-4 flex items-center gap-ds-2 font-ds-body text-ds-small font-semibold text-ds-text">
                <ClipboardCheck size={16} strokeWidth={2.75} className="text-ds-brand" />
                Detalle
              </p>
              <div className="grid gap-ds-4 font-ds-body text-ds-small sm:grid-cols-2">
                <div>
                  <p className="text-ds-caption text-ds-text/60">Cliente</p>
                  <p className="font-medium text-ds-text">{detalle.cliente_info?.nombre ?? detalle.cliente}</p>
                </div>
                <div>
                  <p className="text-ds-caption text-ds-text/60">Colaborador asignado</p>
                  <p className="font-medium text-ds-text">{detalle.responsable?.nombre ?? "—"}</p>
                </div>
                <div>
                  <p className="text-ds-caption text-ds-text/60">Dirección</p>
                  <p className="font-medium text-ds-text">{detalle.ubicacion ?? detalle.cliente_info?.direccion ?? "—"}</p>
                </div>
                {/* Llegada/salida del colaborador (Fase 3.4d, 23-sep-2026,
                    pedido explícito: "Admin sigue viendo los tiempos de
                    llegada/salida y la ubicación en el detalle de la
                    OS") — no existía en esta pantalla todavía, aunque el
                    dato (check_in/check_out) se venía guardando desde la
                    migración 64. */}
                {detalle.orden?.check_in_at ? (
                  <div>
                    <p className="text-ds-caption text-ds-text/60">Llegada</p>
                    <p className="font-medium text-ds-text">
                      {new Date(detalle.orden.check_in_at).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" })}
                    </p>
                    <p className="text-ds-caption text-ds-text/60">
                      {detalle.orden.check_in_lat != null && detalle.orden.check_in_lng != null ? (
                        <a
                          href={`https://www.google.com/maps?q=${detalle.orden.check_in_lat},${detalle.orden.check_in_lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline hover:text-ds-brand"
                        >
                          {detalle.orden.check_in_lat.toFixed(5)}, {detalle.orden.check_in_lng.toFixed(5)}
                        </a>
                      ) : detalle.orden.check_in_sin_ubicacion ? (
                        "Sin ubicación"
                      ) : null}
                    </p>
                  </div>
                ) : null}
                {detalle.orden?.check_out_at ? (
                  <div>
                    <p className="text-ds-caption text-ds-text/60">Salida</p>
                    <p className="font-medium text-ds-text">
                      {new Date(detalle.orden.check_out_at).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" })}
                    </p>
                    <p className="text-ds-caption text-ds-text/60">
                      {detalle.orden.check_out_lat != null && detalle.orden.check_out_lng != null ? (
                        <a
                          href={`https://www.google.com/maps?q=${detalle.orden.check_out_lat},${detalle.orden.check_out_lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline hover:text-ds-brand"
                        >
                          {detalle.orden.check_out_lat.toFixed(5)}, {detalle.orden.check_out_lng.toFixed(5)}
                        </a>
                      ) : detalle.orden.check_out_sin_ubicacion ? (
                        "Sin ubicación"
                      ) : null}
                    </p>
                  </div>
                ) : null}
                {detalle.orden?.cliente_no_disponible ? (
                  <div className="sm:col-span-2">
                    <p className="text-ds-caption text-ds-text/60">Cliente no disponible al cierre</p>
                    <p className="text-ds-text">{detalle.orden.cliente_no_disponible_motivo ?? "—"}</p>
                  </div>
                ) : null}
                {detalle.descripcion ? (
                  <div className="sm:col-span-2">
                    <p className="text-ds-caption text-ds-text/60">Descripción</p>
                    <p className="text-ds-text">{detalle.descripcion}</p>
                  </div>
                ) : null}
                {detalle.tipo ? (
                  <div>
                    <p className="text-ds-caption text-ds-text/60">Tipo de servicio</p>
                    <p className="font-medium text-ds-text">{detalle.tipo.nombre}</p>
                  </div>
                ) : null}
                {detalle.orden?.orden_compra_cliente ? (
                  <div>
                    <p className="text-ds-caption text-ds-text/60">Orden de compra del cliente</p>
                    <p className="font-medium text-ds-text">{detalle.orden.orden_compra_cliente}</p>
                  </div>
                ) : null}
                {detalle.orden?.observaciones_cierre ? (
                  <div className="sm:col-span-2">
                    <p className="text-ds-caption text-ds-text/60">Comentarios del técnico</p>
                    <p className="text-ds-text">{detalle.orden.observaciones_cierre}</p>
                  </div>
                ) : null}
                {detalle.notas_internas ? (
                  <div className="sm:col-span-2">
                    <p className="text-ds-caption text-ds-text/60">Notas internas (no visibles para el cliente)</p>
                    <p className="text-ds-text">{detalle.notas_internas}</p>
                  </div>
                ) : null}
              </div>

              {detalle.tipo && detalle.tipo.campos.some((c) => c.tipo !== "foto") ? (
                <div className="mt-ds-5 border-t border-ds-divider pt-ds-5">
                  <p className="mb-ds-3 font-ds-body text-ds-caption font-medium text-ds-text/60">
                    Datos medidos — {detalle.tipo.nombre}
                  </p>
                  {/* Campos tipo "foto" (migración 105) se ven en el PDF/
                      informe de la OS, no acá — ver arriba. */}
                  <div className="grid gap-ds-3 sm:grid-cols-3">
                    {detalle.tipo.campos.filter((c) => c.tipo !== "foto").map((c) => (
                      <div key={c.clave} className="rounded-ds-md border border-ds-divider p-ds-3">
                        <p className="font-ds-body text-ds-caption text-ds-text/60">{c.etiqueta}</p>
                        <p className="mt-ds-1 font-ds-body text-ds-small font-semibold text-ds-text">
                          {String((detalle.datos as Record<string, unknown>)?.[c.clave] ?? "—")}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </Card>
          </div>

          {detalle.items.length > 0 ? (
            <div className="my-ds-6">
              <Table<OsItem>
                filas={detalle.items}
                claveFila={(it) => it.id}
                vacio={{ titulo: "Sin ítems" }}
                columnas={[
                  { encabezado: "Ítem", celda: (it) => it.descripcion },
                  { encabezado: "Cant.", celda: (it) => <Cifra>{String(it.cantidad)}</Cifra> },
                  { encabezado: "P. unitario", celda: (it) => <Cifra>{formatearCLP(it.precio_unitario)}</Cifra> },
                  {
                    encabezado: "Total",
                    celda: (it) => (
                      <span className="font-medium text-ds-text">
                        <Cifra>{formatearCLP(it.cantidad * it.precio_unitario)}</Cifra>
                      </span>
                    ),
                  },
                ]}
              />
              <p className="mt-ds-2 flex justify-end gap-ds-2 font-ds-body text-ds-small">
                <span className="text-ds-text/60">Total</span>
                <span className="font-semibold text-ds-text">
                  <Cifra>{formatearCLP(detalle.items.reduce((acc, it) => acc + it.cantidad * it.precio_unitario, 0))}</Cifra>
                </span>
              </p>
            </div>
          ) : null}

          {detalle.fotos.length > 0 ? (
            <div className="my-ds-6">
              <Card>
                <p className="mb-ds-4 flex items-center gap-ds-2 font-ds-body text-ds-small font-semibold text-ds-text">
                  <Camera size={16} strokeWidth={2.75} className="text-ds-brand" />
                  Fotos
                </p>
                {/* Agrupadas por categoría con una franja entre grupos
                    (pedido 23-sep-2026) — mismo orden que en mobile. Antes
                    era una grilla plana sin categoría ni descripción. */}
                <div className="flex flex-col gap-ds-6">
                  {GRUPOS_FOTO.map((g) => {
                    const delGrupo = detalle.fotos.filter((f) =>
                      (CATEGORIAS_FOTO_OS as readonly string[]).includes(f.categoria ?? "") ? f.categoria === g.valor : g.valor === null
                    );
                    if (delGrupo.length === 0) return null;
                    return (
                      <section key={g.texto} className="border-t-2 border-ds-divider pt-ds-3">
                        <p className="mb-ds-3 flex items-center justify-between font-ds-body text-ds-caption font-semibold uppercase tracking-wide text-ds-text/70">
                          {g.texto}
                          <span className="font-normal text-ds-text/50">{delGrupo.length}</span>
                        </p>
                        <div className="grid gap-ds-4 sm:grid-cols-2 lg:grid-cols-3">
                          {delGrupo.map((f) => (
                            <FotoOS
                              key={f.id}
                              foto={f}
                              trabajoId={detalle.id}
                              editable={detalle.orden?.estado_os !== "firmada"}
                              puedeAnalizar={usuario?.rol === "admin" && planPermiteIACompleta(planEmpresa)}
                            />
                          ))}
                        </div>
                      </section>
                    );
                  })}
                </div>
              </Card>
            </div>
          ) : null}

          {/* Solo Admin con el módulo informe_ia activo (tarea 124)
              (el chequeo real es el backend — esto evita mostrar una
              acción que devolvería 403). */}
          {detalle.orden && usuario?.rol === "admin" && modulosVisibles.includes("informe_ia") ? (
            <div className="my-ds-6">
              <Card>
                <div className="mb-ds-4 flex flex-wrap items-center justify-between gap-ds-2">
                  <p className="font-ds-body text-ds-small font-semibold text-ds-text">Informe con IA (patrones personalizados)</p>
                  <Button variante="secundario" onPress={onGenerarInforme} cargando={generandoInforme}>
                    {detalle.orden.informe_ia ? "Regenerar" : "Generar informe con IA"}
                  </Button>
                </div>
                <div className="mb-ds-4">
                  <Textarea
                    etiqueta="Qué revisar en las fotos (opcional)"
                    filas={2}
                    valor={patrones}
                    onCambio={setPatrones}
                    placeholder="Ej.: revisa daños visibles en la carga, verifica que el packaging esté sellado…"
                    deshabilitado={generandoInforme}
                  />
                </div>
                {errorInforme ? <p className="mb-ds-2 font-ds-body text-ds-small text-ds-accent-700">{errorInforme}</p> : null}
                {detalle.orden.informe_ia ? (
                  <div className="flex flex-col gap-ds-3">
                    <Textarea
                      etiqueta="Texto del informe — revisalo y corregilo antes de generar una versión del PDF"
                      filas={8}
                      valor={informeEditado}
                      onCambio={setInformeEditado}
                      deshabilitado={generandoInforme}
                    />
                    <div className="flex flex-wrap gap-ds-2">
                      <Button
                        variante="secundario"
                        onPress={onGuardarInforme}
                        cargando={guardandoInforme}
                        deshabilitado={informeEditado === (detalle.orden.informe_ia ?? "")}
                      >
                        Guardar cambios
                      </Button>
                      {(detalle.orden.firma_url_firmada || detalle.orden.cliente_no_disponible) && (
                        <Button
                          onPress={onGenerarVersion}
                          cargando={generandoVersion}
                          deshabilitado={informeEditado !== (detalle.orden.informe_ia ?? "")}
                        >
                          Generar versión del PDF con este informe
                        </Button>
                      )}
                    </div>
                    {informeEditado !== (detalle.orden.informe_ia ?? "") ? (
                      <p className="font-ds-body text-ds-caption text-ds-text/60">Guardá los cambios antes de generar la versión.</p>
                    ) : null}
                  </div>
                ) : !errorInforme ? (
                  <p className="font-ds-body text-ds-small text-ds-text/60">
                    Redacta un informe técnico a partir de los datos medidos, el checklist, las observaciones y las
                    fotos de esta OS. Si escribís qué revisar, la IA analiza las fotos con ese foco.
                  </p>
                ) : null}

                {/* Historial de versiones (Fase 3.3) — v1 es siempre la
                    original firmada, inmutable; nunca se pisa. */}
                {versiones && versiones.length > 0 ? (
                  <div className="mt-ds-4 border-t border-ds-divider pt-ds-3">
                    <p className="mb-ds-2 font-ds-body text-ds-caption font-semibold uppercase tracking-[0.06em] text-ds-text/60">
                      Versiones del PDF
                    </p>
                    {errorVersion ? <p className="mb-ds-2 font-ds-body text-ds-small text-ds-accent-700">{errorVersion}</p> : null}
                    <div className="flex flex-col gap-ds-1">
                      {versiones.map((v) => (
                        <a
                          key={v.id}
                          href={v.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between gap-ds-2 rounded-ds-sm px-ds-2 py-ds-1 font-ds-body text-ds-small text-ds-text hover:bg-ds-neutral-100"
                        >
                          <span className="font-medium">v{v.version}{v.version === 1 ? " (original)" : ""}</span>
                          <span className="text-ds-caption text-ds-text/60">
                            {v.creadoEn ? new Date(v.creadoEn).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" }) : "—"}
                          </span>
                        </a>
                      ))}
                    </div>
                  </div>
                ) : null}
              </Card>
            </div>
          ) : null}

          <div className="my-ds-6">
            <Card>
              <p className="mb-ds-4 font-ds-body text-ds-small font-semibold text-ds-text">Firma de conformidad del cliente o encargado</p>
              {detalle.orden?.firma_url_firmada ? (
                <div className="flex flex-col gap-ds-3 sm:flex-row sm:items-center sm:gap-ds-6">
                  {/* URL firmada (vence) — sin optimizer, con lazy-load igual. */}
                  <Image
                    src={detalle.orden.firma_url_firmada}
                    alt="Firma del cliente o encargado"
                    width={192}
                    height={96}
                    unoptimized
                    className="h-24 w-48 rounded-ds-sm border border-ds-divider bg-white object-contain"
                  />
                  <div className="font-ds-body text-ds-small">
                    {detalle.orden.firmante_nombre ? (
                      <p className="text-ds-text">
                        <span className="text-ds-text/60">Nombre:</span> {detalle.orden.firmante_nombre}
                      </p>
                    ) : null}
                    {detalle.orden.firmante_documento ? (
                      <p className="text-ds-text">
                        <span className="text-ds-text/60">RUT/Documento:</span> {detalle.orden.firmante_documento}
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : (
                <p className="font-ds-body text-ds-small text-ds-text/60">Todavía no se ha registrado la firma.</p>
              )}
            </Card>
          </div>

          {detalle.orden ? (
            <div className="my-ds-6">
              <Card>
                <p className="mb-ds-4 font-ds-body text-ds-small font-semibold text-ds-text">PDF de la OS</p>
                <div className="flex flex-col gap-ds-4 sm:flex-row sm:items-start sm:justify-between">
                  <Button onPress={onDescargarPdf} cargando={descargando}>
                    Descargar PDF
                  </Button>
                  <form onSubmit={onEnviarEmail} className="flex w-full max-w-sm items-end gap-ds-2">
                    <div className="flex-1">
                      <Input
                        etiqueta="Enviar por email"
                        iconoIzq={<Mail size={14} strokeWidth={2.75} />}
                        tipo="email"
                        placeholder="correo@cliente.cl"
                        valor={email}
                        onCambio={setEmail}
                      />
                    </div>
                    <Button tipo="submit" variante="secundario" deshabilitado={enviando || !email.trim()} cargando={enviando}>
                      Enviar
                    </Button>
                  </form>
                </div>
                {avisoEnvio ? <p className="mt-ds-3 font-ds-body text-ds-small font-medium text-ds-accent2-800">{avisoEnvio}</p> : null}
                {errorEnvio ? <p className="mt-ds-3 font-ds-body text-ds-small text-ds-accent-700">{errorEnvio}</p> : null}
              </Card>
            </div>
          ) : null}

          <div className="my-ds-6">
            <Card>
              <p className="mb-ds-4 font-ds-body text-ds-small font-semibold text-ds-text">Zona de peligro</p>
              {!detalle.orden?.finalizada_en ? (
                <div className="flex flex-col gap-ds-2">
                  <Button variante="peligro" onPress={onEliminar} cargando={eliminando}>
                    Eliminar orden de servicio
                  </Button>
                  {errorEliminar ? <p className="font-ds-body text-ds-small text-ds-accent-700">{errorEliminar}</p> : null}
                </div>
              ) : (
                <p className="font-ds-body text-ds-small text-ds-text/70">
                  Esta OS ya fue finalizada y no se puede eliminar — cancélala en vez de eliminarla si necesitás dejarla sin efecto.
                </p>
              )}
            </Card>
          </div>

          {error ? <p className="my-ds-4 font-ds-body text-ds-small text-ds-accent-700">{error}</p> : null}
        </>
      ) : null}
    </DashboardShell>
  );
}

// General primero, después las 4 categorías en su orden de trabajo.
const GRUPOS_FOTO: { valor: string | null; texto: string }[] = [
  { valor: null, texto: "General" },
  ...CATEGORIAS_FOTO_OS.map((c) => ({ valor: c, texto: ETIQUETA_CATEGORIA_FOTO_OS[c] })),
];

// Foto de la OS con descripción editable (analisis_fotos.descripcion,
// migración 125 — sale debajo de la foto en el PDF). Se guarda al salir
// del campo; el backend la bloquea si la OS ya está firmada.
// Análisis con IA (tarea 122): ya no es automático — solo el Admin en
// plan Pro lo pide por foto (el backend valida rol y plan de verdad).
function FotoOS({
  foto,
  trabajoId,
  editable,
  puedeAnalizar,
}: {
  foto: AnalisisFotoConUrl;
  trabajoId: string;
  editable: boolean;
  puedeAnalizar: boolean;
}) {
  const [descripcion, setDescripcion] = useState(foto.descripcion ?? "");
  const [guardada, setGuardada] = useState(foto.descripcion ?? "");
  const [estado, setEstado] = useState<"idle" | "guardando" | "ok" | "error">("idle");
  const [analisis, setAnalisis] = useState({ resumen: foto.resumen, alerta: foto.alerta, detalleAlerta: foto.detalle_alerta });
  const [analizando, setAnalizando] = useState(false);
  const [errorAnalisis, setErrorAnalisis] = useState<string | null>(null);

  async function analizar() {
    setAnalizando(true);
    setErrorAnalisis(null);
    const res = await apiFetch(`/api/trabajos/${trabajoId}/fotos/${foto.id}/analizar`, { method: "POST" });
    const cuerpo = await res.json().catch(() => null);
    setAnalizando(false);
    if (!res.ok) {
      setErrorAnalisis(cuerpo?.error ?? "No se pudo analizar la foto");
      return;
    }
    setAnalisis({ resumen: cuerpo.resumen, alerta: cuerpo.alerta, detalleAlerta: cuerpo.detalle_alerta });
  }

  async function guardar() {
    if (descripcion.trim() === guardada) return;
    setEstado("guardando");
    const res = await apiFetch(`/api/trabajos/${trabajoId}/fotos/${foto.id}`, {
      method: "PATCH",
      body: JSON.stringify({ descripcion: descripcion.trim() }),
    });
    setEstado(res.ok ? "ok" : "error");
    if (res.ok) setGuardada(descripcion.trim());
  }

  return (
    <div className="overflow-hidden rounded-ds-md border border-ds-divider">
      <div className="relative h-40 w-full">
        {/* URL firmada (vence) — sin optimizer, con lazy-load igual. */}
        <Image src={foto.url} alt={foto.descripcion ?? foto.resumen ?? "Foto de la OS"} fill unoptimized className="object-cover" />
      </div>
      <div className="flex flex-col gap-ds-1 p-ds-2">
        {editable ? (
          <textarea
            value={descripcion}
            onChange={(e) => {
              setDescripcion(e.target.value);
              setEstado("idle");
            }}
            onBlur={() => void guardar()}
            rows={2}
            placeholder="Descripción de la foto"
            className="w-full resize-none rounded-ds-sm border border-ds-divider bg-ds-surface px-ds-2 py-1 font-ds-body text-ds-caption text-ds-text"
          />
        ) : foto.descripcion ? (
          <p className="font-ds-body text-ds-caption text-ds-text">{foto.descripcion}</p>
        ) : null}
        {estado === "guardando" ? <p className="font-ds-body text-ds-caption text-ds-text/50">Guardando…</p> : null}
        {estado === "ok" ? <p className="font-ds-body text-ds-caption text-ds-text/50">Guardado</p> : null}
        {estado === "error" ? <p className="font-ds-body text-ds-caption text-ds-danger">No se pudo guardar</p> : null}
        {analisis.resumen ? <p className="font-ds-body text-ds-caption text-ds-text/60">{analisis.resumen}</p> : null}
        {analisis.alerta && analisis.detalleAlerta ? (
          <p className="font-ds-body text-ds-caption text-ds-danger">⚠ {analisis.detalleAlerta}</p>
        ) : null}
        {puedeAnalizar && editable ? (
          <Button variante="ghost" tamano="sm" onPress={() => void analizar()} cargando={analizando}>
            {analisis.resumen ? "Volver a analizar con IA" : "Analizar con IA"}
          </Button>
        ) : null}
        {errorAnalisis ? <p className="font-ds-body text-ds-caption text-ds-danger">{errorAnalisis}</p> : null}
      </div>
    </div>
  );
}
