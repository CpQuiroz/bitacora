"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Camera, ChevronLeft, ClipboardCheck, Mail, Plus } from "lucide-react";
import type { AnalisisFoto, CatalogoItem, Cliente, OrdenServicio, OsItem, Trabajo, TipoTrabajo, Usuario } from "@bitacora/shared";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { abrirPdfOS } from "@/lib/descargarPdf";
import { formatearCLP } from "@bitacora/shared";
import { DashboardShell, type UsuarioShell } from "@/components/DashboardShell";
import { Button, Card, Cifra, DatePicker, Input, StatusBadge, Table, Textarea } from "@bitacora/ui/web";
import { InputMonto } from "@/components/InputMonto";
import { CatalogoSelectorModal, type ItemSeleccionadoCatalogo } from "@/components/CatalogoSelectorModal";
import { ComboboxResponsable } from "@/components/ComboboxResponsable";

type ItemOS = { catalogo_item_id: string | null; descripcion: string; cantidad: string; precio_unitario: string };

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
  tipo_trabajo: TipoTrabajo | null;
  orden: OrdenConFirma | null;
  items: OsItem[];
  fotos: AnalisisFotoConUrl[];
};

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
  const [modulosVisibles, setModulosVisibles] = useState<string[]>([]);
  const [patrones, setPatrones] = useState("");

  const [editando, setEditando] = useState(false);
  const [descEdit, setDescEdit] = useState("");
  const [itemsEdit, setItemsEdit] = useState<ItemOS[]>([]);
  const [notasEdit, setNotasEdit] = useState("");
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
      if (u) setUsuario({ nombre: u.nombre, rol: u.rol, empresaNombre: u.empresa?.nombre ?? "", empresaLogoUrl: u.empresa?.logo_url ?? null, colorPrimario: u.empresa?.color_primario ?? null, colorPrimarioForeground: u.empresa?.color_primario_foreground ?? null, colorSecundario: u.empresa?.color_secundario ?? null, fuente: u.empresa?.fuente ?? null, moneda: u.empresa?.moneda ?? "CLP" });
      if (Array.isArray(cuerpoMe.modulos_visibles)) setModulosVisibles(cuerpoMe.modulos_visibles);
    }
    if (!resDetalle.ok) {
      setError("No se pudo cargar la orden de servicio");
      return;
    }
    setDetalle(await resDetalle.json());
  }, [params.id, router]);

  useEffect(() => {
    cargar();
  }, [cargar]);

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
      }))
    );
    setNotasEdit(detalle.notas_internas ?? "");
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
    }
    if (detalle?.tipo_trabajo && detalle.tipo_trabajo.campos.length > 0) {
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
                {detalle.orden?.folio != null ? `OS N° ${detalle.orden.folio}` : "Orden de servicio"}
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

                <div className="mb-ds-5">
                  <Textarea etiqueta="Descripción" filas={2} valor={descEdit} onCambio={setDescEdit} deshabilitado={tieneFirma} />
                </div>

                {detalle.tipo_trabajo && detalle.tipo_trabajo.campos.length > 0 ? (
                  <div className="mb-ds-5 grid gap-ds-3 rounded-ds-md bg-ds-neutral-200 p-ds-3 sm:grid-cols-2">
                    <p className="font-ds-body text-ds-caption font-medium text-ds-text/60 sm:col-span-2">
                      Datos medidos — {detalle.tipo_trabajo.nombre}
                    </p>
                    {detalle.tipo_trabajo.campos.map((campo) =>
                      campo.tipo === "fecha" ? (
                        <DatePicker
                          key={campo.clave}
                          etiqueta={campo.etiqueta}
                          valor={aFecha(datosEdit[campo.clave] ?? "")}
                          onCambio={(f) => setDatosEdit((prev) => ({ ...prev, [campo.clave]: aTexto(f) }))}
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
                        <div key={i} className="grid grid-cols-[1fr_5rem_7rem_auto] items-start gap-ds-2">
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
                  <p className="text-ds-caption text-ds-text/60">Colaborador asignado</p>
                  <p className="font-medium text-ds-text">{detalle.responsable?.nombre ?? "—"}</p>
                </div>
                <div>
                  <p className="text-ds-caption text-ds-text/60">Dirección</p>
                  <p className="font-medium text-ds-text">{detalle.ubicacion ?? detalle.cliente_info?.direccion ?? "—"}</p>
                </div>
                {detalle.descripcion ? (
                  <div className="sm:col-span-2">
                    <p className="text-ds-caption text-ds-text/60">Descripción</p>
                    <p className="text-ds-text">{detalle.descripcion}</p>
                  </div>
                ) : null}
                {detalle.tipo_trabajo ? (
                  <div>
                    <p className="text-ds-caption text-ds-text/60">Tipo de servicio</p>
                    <p className="font-medium text-ds-text">{detalle.tipo_trabajo.nombre}</p>
                  </div>
                ) : null}
                {detalle.orden?.observaciones_cierre ? (
                  <div className="sm:col-span-2">
                    <p className="text-ds-caption text-ds-text/60">Observaciones de cierre</p>
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

              {detalle.tipo_trabajo && detalle.tipo_trabajo.campos.length > 0 ? (
                <div className="mt-ds-5 border-t border-ds-divider pt-ds-5">
                  <p className="mb-ds-3 font-ds-body text-ds-caption font-medium text-ds-text/60">
                    Datos medidos — {detalle.tipo_trabajo.nombre}
                  </p>
                  <div className="grid gap-ds-3 sm:grid-cols-3">
                    {detalle.tipo_trabajo.campos.map((c) => (
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
                <div className="grid gap-ds-4 sm:grid-cols-2 lg:grid-cols-3">
                  {detalle.fotos.map((f) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <div key={f.id} className="overflow-hidden rounded-ds-md border border-ds-divider">
                      <img src={f.url} alt={f.resumen ?? "Foto de la OS"} className="h-40 w-full object-cover" />
                      {f.resumen ? <p className="p-ds-2 font-ds-body text-ds-caption text-ds-text/60">{f.resumen}</p> : null}
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          ) : null}

          {/* Solo Admin, o Supervisor con el módulo informe_ia habilitado
              (el chequeo real es el backend — esto evita mostrar una
              acción que devolvería 403). */}
          {detalle.orden && (usuario?.rol === "admin" || (usuario?.rol === "supervisor" && modulosVisibles.includes("informe_ia"))) ? (
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
                {errorInforme ? <p className="font-ds-body text-ds-small text-ds-accent-700">{errorInforme}</p> : null}
                {detalle.orden.informe_ia ? (
                  <pre className="whitespace-pre-wrap font-ds-body text-ds-small leading-relaxed text-ds-text">{detalle.orden.informe_ia}</pre>
                ) : !errorInforme ? (
                  <p className="font-ds-body text-ds-small text-ds-text/60">
                    Redacta un informe técnico a partir de los datos medidos, el checklist, las observaciones y las
                    fotos de esta OS. Si escribís qué revisar, la IA analiza las fotos con ese foco.
                  </p>
                ) : null}
              </Card>
            </div>
          ) : null}

          <div className="my-ds-6">
            <Card>
              <p className="mb-ds-4 font-ds-body text-ds-small font-semibold text-ds-text">Firma de conformidad</p>
              {detalle.orden?.firma_url_firmada ? (
                <div className="flex flex-col gap-ds-3 sm:flex-row sm:items-center sm:gap-ds-6">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={detalle.orden.firma_url_firmada}
                    alt="Firma"
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

          {error ? <p className="my-ds-4 font-ds-body text-ds-small text-ds-accent-700">{error}</p> : null}
        </>
      ) : null}
    </DashboardShell>
  );
}
