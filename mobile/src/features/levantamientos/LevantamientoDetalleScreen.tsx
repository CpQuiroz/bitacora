import { useCallback, useEffect, useState } from "react";
import { FlatList, Image, Linking, Platform, Pressable, ScrollView, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AlertCircle, ArrowLeft, Camera, MapPin, Minus, Plus, RefreshCw, X } from "lucide-react-native";
import type { CatalogoItem, EstadoLevantamiento } from "@bitacora/shared";
import { formatearFolio } from "@bitacora/shared";
import { tokens } from "@bitacora/design-tokens";
import { Button, Dialog, ErrorState, Input, LoadingState, ScreenHeader, StatusBadge, Textarea, Texto, useMarca, useToast, type TonoEstado } from "@bitacora/ui/native";
import { elegirFotos } from "../../lib/imagen";
import { useAuth } from "../auth/AuthContext";
import { useRed } from "../../services/sync/NetworkProvider";
import { actualizarDireccionCliente } from "../../services/clientes";
import {
  completarLevantamiento,
  encolarCompletarLevantamiento,
  encolarFotoLevantamiento,
  listarCatalogo,
  obtenerDetalleLevantamiento,
  type DetalleLevantamiento,
} from "../../services/levantamientos";
import type { MasStackParamList } from "../../shell/navigation/types";

const ETIQUETA_ESTADO: Record<EstadoLevantamiento, string> = {
  creado: "Creado",
  asignado: "Por completar",
  en_terreno: "En terreno",
  completado_tecnico: "Completado — esperando cotización",
  cotizado_externo: "Cotizado — esperando aprobación",
  aprobado: "Aprobado",
  rechazado: "Rechazado",
};

// 20-sep-2026: antes el folio y este texto iban juntos en una sola
// línea chica del antetítulo del header — con estados largos como
// "Completado — esperando cotización" envolvía a 2-3 líneas en
// mayúscula y el folio quedaba enterrado ahí adentro. Ahora el folio
// va solo en el antetítulo (corto, como en Trabajos/Viajes) y el
// estado baja a un StatusBadge aparte. EstadoLevantamiento no está en
// MAPA_ESTADO_TONO (packages/ui/src/tipos.ts) — tonoForzado explícito
// para los 7, no dejar 2 al azar del fallback.
const TONO_ESTADO: Record<EstadoLevantamiento, TonoEstado> = {
  creado: "en_progreso",
  asignado: "en_progreso",
  en_terreno: "en_progreso",
  completado_tecnico: "completado",
  cotizado_externo: "en_progreso",
  aprobado: "completado",
  rechazado: "cancelado",
};

type MaterialLocal = { catalogo_item_id: string; cantidad: number; nombre: string; unidad: string; agregado_por_admin: boolean };

// Sistema visual móvil v2 (14-sep-2026) — migración del sistema viejo
// (useTema/Ionicons/components-ui) al nuevo: ScreenHeader propio con
// `accion`=volver (mismo criterio que LevantamientosListScreen, ya
// migrada), Textarea en vez de Input multiline (el contrato nuevo de
// Input no tiene esa prop), Dialog (bottom sheet) en vez del Modal a
// mano para el picker de catálogo. El técnico completa lo observado en
// terreno + materiales + fotos. Cotizar (fuera de Bitácora) y aprobar/
// rechazar es exclusivo de la web (Admin) — acá no hay esos botones, a
// propósito.
export function LevantamientoDetalleScreen({ route, navigation }: NativeStackScreenProps<MasStackParamList, "LevantamientoDetalle">) {
  const marca = useMarca();
  const auth = useAuth();
  const toast = useToast();
  const { enLinea, pendientes } = useRed();
  const { id } = route.params;
  const fotosEnCola = pendientes.filter((a) => a.recurso === `levantamiento:${id}` && a.etiqueta === "Foto de levantamiento");
  const [detalle, setDetalle] = useState<DetalleLevantamiento | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [descripcion, setDescripcion] = useState("");
  const [materiales, setMateriales] = useState<MaterialLocal[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [pickerAbierto, setPickerAbierto] = useState(false);
  const [catalogo, setCatalogo] = useState<CatalogoItem[] | null>(null);

  // Dirección del cliente (23-sep-2026, pedido explícito) — se muestra
  // la que ya tiene en su ficha; si no tiene, se ofrece agregarla acá
  // mismo (PATCH directo al cliente, no es un campo propio del
  // levantamiento — ver actualizarDireccionCliente).
  const [direccionNueva, setDireccionNueva] = useState("");
  const [guardandoDireccion, setGuardandoDireccion] = useState(false);

  // Descripción de la foto (mismo pedido) — se pide en un diálogo justo
  // después de elegirla, antes de encolar la subida.
  const [fotoElegida, setFotoElegida] = useState<{ uri: string; name?: string; type?: string } | null>(null);
  const [descripcionFoto, setDescripcionFoto] = useState("");

  const cargar = useCallback(async () => {
    setError(null);
    const r = await obtenerDetalleLevantamiento(id);
    if (r.error || !r.detalle) {
      setError(r.error ?? "No se pudo cargar el detalle");
      return;
    }
    setDetalle(r.detalle);
    setDescripcion(r.detalle.descripcion_tecnico ?? "");
    setMateriales(
      r.detalle.materiales.map((m) => ({
        catalogo_item_id: m.catalogo_item_id,
        cantidad: m.cantidad,
        nombre: m.catalogo_item?.nombre ?? "Ítem eliminado",
        unidad: m.catalogo_item?.unidad ?? "",
        agregado_por_admin: m.agregado_por_admin,
      }))
    );
  }, [id]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  // Cuando una foto sale de la cola (se subió o falló para siempre),
  // recargamos para reemplazar el placeholder por la real o quitarlo.
  useEffect(() => {
    void cargar();
  }, [fotosEnCola.length, cargar]);

  // El Admin ahora puede VER cualquier levantamiento de la empresa acá
  // (pedido 21-sep-2026, "el admin debiera poder ver todos los
  // levantamientos de todos los equipos" — antes esta sección ni le
  // aparecía en el celular) — pero completar/editar sigue siendo solo
  // del técnico asignado, no algo que el Admin haga por él desde el
  // celular (esto solo lo desconecta si reasigna, vía web). Sin esta
  // condición, el Admin vería el form editable de cualquier técnico.
  const esElTecnicoAsignado = auth.fase === "listo" && detalle?.tecnico?.id === auth.usuario.id;
  const editable = detalle != null && detalle.estado !== "aprobado" && detalle.estado !== "rechazado" && esElTecnicoAsignado;

  async function abrirPicker() {
    setPickerAbierto(true);
    if (!catalogo) setCatalogo(await listarCatalogo());
  }

  function agregarMaterial(item: CatalogoItem) {
    setMateriales((prev) => {
      const ya = prev.find((m) => m.catalogo_item_id === item.id);
      if (ya) return prev.map((m) => (m.catalogo_item_id === item.id ? { ...m, cantidad: m.cantidad + 1 } : m));
      return [...prev, { catalogo_item_id: item.id, cantidad: 1, nombre: item.nombre, unidad: item.unidad, agregado_por_admin: false }];
    });
    setPickerAbierto(false);
  }

  function cambiarCantidad(catalogoItemId: string, delta: number) {
    setMateriales((prev) =>
      prev.map((m) => (m.catalogo_item_id === catalogoItemId ? { ...m, cantidad: Math.max(1, m.cantidad + delta) } : m)).filter((m) => m.cantidad > 0)
    );
  }

  function quitarMaterial(catalogoItemId: string) {
    setMateriales((prev) => prev.filter((m) => m.catalogo_item_id !== catalogoItemId));
  }

  async function guardar() {
    setGuardando(true);
    const datos = {
      descripcion_tecnico: descripcion,
      // Los agregados por Admin (Fase 4) no son del técnico para
      // reenviar — el backend ya los protege del full-replace, pero no
      // hace falta ni mandarlos de vuelta acá.
      materiales: materiales.filter((m) => !m.agregado_por_admin).map((m) => ({ catalogo_item_id: m.catalogo_item_id, cantidad: m.cantidad })),
    };

    if (enLinea) {
      const res = await completarLevantamiento(id, datos);
      if (res.ok) {
        setGuardando(false);
        toast("Guardado. El levantamiento quedó completado.", { tono: "exito" });
        return void cargar();
      }
      if (!res.reintentable) {
        setGuardando(false);
        return toast(`No se pudo guardar: ${res.error}`, { tono: "error" });
      }
    }

    await encolarCompletarLevantamiento(id, datos);
    setGuardando(false);
    toast(`${enLinea ? "Se reintentará solo" : "Guardado sin conexión"}. Quedó guardado en el teléfono y se envía a la oficina cuando haya señal.`, {
      tono: "info",
    });
  }

  // Siempre por la cola, nunca un intento inline antes — mismo bug real
  // (14-sep-2026) encontrado y corregido en services/viajes.ts
  // (crearViaje): un intento inline con la foto que "timeoutea" en el
  // celular no se puede cancelar de verdad en RN, y si igual la
  // encolábamos como respaldo quedaban dos subidas de la MISMA foto
  // viajando a la vez. El placeholder en `fotosEnCola` ya da feedback
  // inmediato — no hace falta el intento inline para que se sienta rápido.
  // Elegir la foto y encolarla son 2 pasos separados (23-sep-2026): en
  // el medio se pide una descripción opcional (Dialog más abajo) antes
  // de mandarla a la cola.
  async function agregarFoto() {
    const [elegida] = await elegirFotos({ avisar: toast });
    if (!elegida) return;
    setDescripcionFoto("");
    setFotoElegida(elegida);
  }

  async function confirmarFoto() {
    if (!fotoElegida) return;
    await encolarFotoLevantamiento(id, fotoElegida, descripcionFoto);
    setFotoElegida(null);
    setDescripcionFoto("");
  }

  function abrirMapa(direccion: string) {
    const destino = encodeURIComponent(direccion);
    const url = Platform.select({
      ios: `http://maps.apple.com/?daddr=${destino}`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${destino}`,
    });
    Linking.openURL(url!);
  }

  async function guardarDireccion() {
    if (!detalle?.cliente || !direccionNueva.trim()) return;
    setGuardandoDireccion(true);
    const r = await actualizarDireccionCliente(detalle.cliente.id, direccionNueva);
    setGuardandoDireccion(false);
    if (!r.ok) return toast(`No se pudo guardar: ${r.error}`, { tono: "error" });
    setDireccionNueva("");
    await cargar();
  }

  const volver = { icono: <ArrowLeft size={20} strokeWidth={2.5} color={tokens.color.text} />, onPress: () => navigation.goBack(), etiquetaAccesible: "Volver" };

  if (!detalle && !error) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
        <ScreenHeader titulo="Levantamiento" accion={volver} />
        <View style={{ padding: tokens.space["4"] }}>
          <LoadingState />
        </View>
      </View>
    );
  }
  if (error && !detalle) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
        <ScreenHeader titulo="Levantamiento" accion={volver} />
        <ErrorState mensaje={error} onReintentar={() => void cargar()} />
      </View>
    );
  }
  if (!detalle) return null;

  return (
    <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
      <ScreenHeader
        antetitulo={formatearFolio("LEV", detalle.folio) ?? undefined}
        titulo={detalle.cliente?.nombre ?? "Cliente"}
        accion={volver}
      />
      <View style={{ paddingHorizontal: tokens.space["4"] }}>
        <StatusBadge estado={detalle.estado} etiqueta={ETIQUETA_ESTADO[detalle.estado]} tonoForzado={TONO_ESTADO[detalle.estado]} />
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: tokens.space["4"], gap: tokens.space["4"], paddingBottom: tokens.space["8"] * 2 }}>
        <View style={{ gap: 6 }}>
          <Texto tamano={tokens.size.micro} color={tokens.color.accent2Ramp["800"]} peso="semibold" style={{ textTransform: "uppercase", letterSpacing: 1.3 }}>
            Dirección
          </Texto>
          {detalle.cliente?.direccion ? (
            <Pressable onPress={() => abrirMapa(detalle.cliente!.direccion!)} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <MapPin size={16} strokeWidth={2.5} color={marca.base} />
              <Texto tamano={tokens.size.body} color={marca.base} style={{ textDecorationLine: "underline", flex: 1 }}>
                {detalle.cliente.direccion}
              </Texto>
            </Pressable>
          ) : editable ? (
            <View style={{ flexDirection: "row", gap: tokens.space["2"] }}>
              <View style={{ flex: 1 }}>
                <Input placeholder="Agregar dirección…" valor={direccionNueva} onCambio={setDireccionNueva} />
              </View>
              <Button variante="secundario" onPress={guardarDireccion} cargando={guardandoDireccion} deshabilitado={!direccionNueva.trim()}>
                Guardar
              </Button>
            </View>
          ) : (
            <Texto tamano={tokens.size.caption} color={tokens.color.textSecondary}>
              El cliente no tiene dirección cargada.
            </Texto>
          )}
        </View>

        {detalle.descripcion_requerimiento ? (
          <View style={{ gap: 4 }}>
            <Texto tamano={tokens.size.micro} color={tokens.color.accent2Ramp["800"]} peso="semibold" style={{ textTransform: "uppercase", letterSpacing: 1.3 }}>
              Qué pidió evaluar la oficina
            </Texto>
            <Texto tamano={tokens.size.body} color={tokens.color.text}>
              {detalle.descripcion_requerimiento}
            </Texto>
          </View>
        ) : null}

        <Textarea
          etiqueta="Lo que observaste en terreno"
          valor={descripcion}
          onCambio={setDescripcion}
          deshabilitado={!editable}
          filas={5}
          placeholder="Ej.: instalación en mal estado, requiere cambiar cableado y 2 enchufes…"
        />

        <View style={{ gap: tokens.space["2"] }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Texto tamano={tokens.size.body} color={tokens.color.text} peso="semibold">
              Materiales
            </Texto>
            {editable ? (
              <Pressable onPress={abrirPicker} hitSlop={8} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Plus size={16} strokeWidth={2.5} color={marca.base} />
                <Texto tamano={tokens.size.caption} color={marca.base} peso="semibold">
                  Agregar
                </Texto>
              </Pressable>
            ) : null}
          </View>
          {materiales.length === 0 ? (
            <Texto tamano={tokens.size.caption} color={tokens.color.textSecondary}>
              Sin materiales indicados todavía.
            </Texto>
          ) : (
            materiales.map((m) => {
              // Fase 4: lo que agregó el Admin (desde la web, sobre un
              // levantamiento que el técnico ya completó) se muestra
              // siempre de solo lectura acá, con la marca visual — el
              // técnico no lo edita ni lo reenvía, aunque el resto de la
              // lista siga editable.
              const soloLecturaFila = !editable || m.agregado_por_admin;
              return (
                <View
                  key={m.catalogo_item_id}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: tokens.space["2"],
                    borderWidth: 1,
                    borderColor: tokens.color.divider,
                    borderRadius: tokens.radius.md,
                    padding: tokens.space["3"],
                  }}
                >
                  <View style={{ flex: 1, gap: 3 }}>
                    <Texto tamano={tokens.size.body} color={tokens.color.text} numberOfLines={1}>
                      {m.nombre}
                    </Texto>
                    {m.agregado_por_admin ? <StatusBadge estado="agregado_admin" etiqueta="Agregado por Admin" tonoForzado="en_progreso" /> : null}
                  </View>
                  {soloLecturaFila ? (
                    <Texto tamano={tokens.size.caption} color={tokens.color.textSecondary} style={{ fontVariant: ["tabular-nums"] }}>
                      {m.cantidad} {m.unidad}
                    </Texto>
                  ) : (
                    <View style={{ flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: tokens.color.divider, borderRadius: tokens.radius.sm }}>
                      <Pressable accessibilityRole="button" accessibilityLabel="Restar uno" hitSlop={6} onPress={() => cambiarCantidad(m.catalogo_item_id, -1)} style={{ width: 32, height: 32, alignItems: "center", justifyContent: "center" }}>
                        <Minus size={15} strokeWidth={2.5} color={tokens.color.text} />
                      </Pressable>
                      <Texto tamano={tokens.size.small} color={tokens.color.text} peso="semibold" style={{ width: 32, textAlign: "center", fontVariant: ["tabular-nums"] }}>
                        {m.cantidad}
                      </Texto>
                      <Pressable accessibilityRole="button" accessibilityLabel="Sumar uno" hitSlop={6} onPress={() => cambiarCantidad(m.catalogo_item_id, 1)} style={{ width: 32, height: 32, alignItems: "center", justifyContent: "center" }}>
                        <Plus size={15} strokeWidth={2.5} color={tokens.color.text} />
                      </Pressable>
                    </View>
                  )}
                  {!soloLecturaFila ? (
                    <Pressable accessibilityRole="button" accessibilityLabel="Quitar material" onPress={() => quitarMaterial(m.catalogo_item_id)} hitSlop={8}>
                      <X size={18} strokeWidth={2.5} color={tokens.color.textSecondary} />
                    </Pressable>
                  ) : null}
                </View>
              );
            })
          )}
        </View>

        {editable ? (
          <Button tamano="lg" bloque onPress={guardar} cargando={guardando}>
            Guardar levantamiento
          </Button>
        ) : null}

        <View style={{ gap: tokens.space["2"] }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Texto tamano={tokens.size.body} color={tokens.color.text} peso="semibold">
              Fotos
            </Texto>
            {editable ? (
              <Button variante="secundario" iconoIzq={<Camera size={16} strokeWidth={2.5} color={tokens.color.text} />} onPress={agregarFoto}>
                Agregar
              </Button>
            ) : null}
          </View>
          {detalle.fotos.length === 0 && fotosEnCola.length === 0 ? (
            <Texto tamano={tokens.size.caption} color={tokens.color.textSecondary}>
              Sin fotos todavía.
            </Texto>
          ) : (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: tokens.space["2"] }}>
              {detalle.fotos.map((f) => (
                <View key={f.id} style={{ width: 88, gap: 3 }}>
                  <Image source={{ uri: f.url }} style={{ width: 88, height: 88, borderRadius: tokens.radius.md, backgroundColor: tokens.color.neutral["200"] }} />
                  {f.descripcion ? (
                    <Texto tamano={tokens.size.micro} color={tokens.color.textSecondary} numberOfLines={2}>
                      {f.descripcion}
                    </Texto>
                  ) : null}
                </View>
              ))}
              {fotosEnCola.map((a) => (
                <View
                  key={a.id}
                  style={{
                    width: 88,
                    height: 88,
                    borderRadius: tokens.radius.md,
                    backgroundColor: tokens.color.neutral["200"],
                    borderWidth: 1,
                    borderColor: tokens.color.divider,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {a.fallida ? (
                    <AlertCircle size={20} strokeWidth={2.5} color={tokens.color.accentRamp["700"]} />
                  ) : (
                    <RefreshCw size={20} strokeWidth={2.5} color={marca.base} />
                  )}
                </View>
              ))}
            </View>
          )}
        </View>

        {detalle.referencia_externa ? (
          <View style={{ gap: 4 }}>
            <Texto tamano={tokens.size.micro} color={tokens.color.accent2Ramp["800"]} peso="semibold" style={{ textTransform: "uppercase", letterSpacing: 1.3 }}>
              Referencia de la cotización
            </Texto>
            <Texto tamano={tokens.size.body} color={tokens.color.text}>
              {detalle.referencia_externa}
            </Texto>
          </View>
        ) : null}
      </ScrollView>

      <Dialog abierto={fotoElegida != null} onCerrar={() => setFotoElegida(null)} titulo="Descripción de la foto">
        {fotoElegida ? (
          <View style={{ gap: tokens.space["3"] }}>
            <Image source={{ uri: fotoElegida.uri }} style={{ width: "100%", height: 180, borderRadius: tokens.radius.md, backgroundColor: tokens.color.neutral["200"] }} resizeMode="cover" />
            <Textarea
              placeholder="Opcional — ej.: cableado dañado bajo el tablero"
              valor={descripcionFoto}
              onCambio={setDescripcionFoto}
              filas={3}
            />
            <Button tamano="lg" bloque onPress={confirmarFoto}>
              Agregar foto
            </Button>
          </View>
        ) : null}
      </Dialog>

      <Dialog abierto={pickerAbierto} onCerrar={() => setPickerAbierto(false)} titulo="Elegir del catálogo">
        {catalogo === null ? (
          <LoadingState />
        ) : (
          <View style={{ maxHeight: 420 }}>
            <FlatList
              data={catalogo}
              keyExtractor={(it) => it.id}
              ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: tokens.color.divider }} />}
              ListEmptyComponent={
                <Texto tamano={tokens.size.caption} color={tokens.color.textSecondary}>
                  Sin ítems en el catálogo.
                </Texto>
              }
              renderItem={({ item }) => (
                <Pressable onPress={() => agregarMaterial(item)} style={{ paddingVertical: tokens.space["3"] }}>
                  <Texto tamano={tokens.size.body} color={tokens.color.text}>
                    {item.nombre}
                  </Texto>
                  <Texto tamano={tokens.size.caption} color={tokens.color.textSecondary}>
                    {item.unidad}
                  </Texto>
                </Pressable>
              )}
            />
          </View>
        )}
      </Dialog>
    </View>
  );
}
