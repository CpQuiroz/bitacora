import { useEffect, useState } from "react";
import { Alert, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Camera } from "lucide-react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { CategoriaGasto, CentroCosto, EstadoGasto, Proveedor } from "@bitacora/shared";
import { formatearFolio } from "@bitacora/shared";
import { tokens } from "@bitacora/design-tokens";
import { Button, Input, LoadingState, SelectorDias, Texto, useMarca } from "@bitacora/ui/native";
import { PickerBuscable } from "../../components/ui";
import { InputMonto } from "../../components/InputMonto";
import { useRed } from "../../services/sync/NetworkProvider";
import { useAuth } from "../auth/AuthContext";
import { elegirFotos } from "../../lib/imagen";
import { listarTrabajos, type TrabajoLista } from "../../services/trabajos";
import {
  actualizarGasto,
  crearCategoriaGasto,
  crearGasto,
  crearProveedor,
  encolarComprobante,
  encolarGasto,
  listarCategoriasGasto,
  listarCentrosCosto,
  listarProveedores,
  obtenerComprobanteUrl,
  obtenerGasto,
  type BorradorGasto,
  type Foto,
} from "../../services/gastos";
import { agregarGastoRendicion } from "../../services/rendiciones";
import type { MasStackParamList } from "../../shell/navigation/types";

function clave(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const ESTADOS: { valor: EstadoGasto; label: string }[] = [
  { valor: "pendiente", label: "Pendiente" },
  { valor: "pagado", label: "Pagado" },
];

const VACIO: BorradorGasto = {
  descripcion: "",
  monto: "",
  categoria_gasto_id: "",
  centro_costo_id: "",
  proveedor_id: "",
  trabajo_id: "",
  fecha: clave(new Date()),
  estado: "pendiente",
  fecha_pago: clave(new Date()),
};

// Sistema visual móvil v2 — pantalla MODAL: sin ScreenHeader propio (el
// título nativo del stack, "Nuevo gasto", ya lo pone MasStack), solo se
// recolorea el contenido. `InputMonto` y `PickerBuscable` no tienen
// todavía equivalente v2 — quedan tal cual (gap conocido), el resto del
// contenido pasa a tokens/Texto/Button/Input de @bitacora/ui/native.
export function NuevoGastoScreen({ navigation, route }: NativeStackScreenProps<MasStackParamList, "GastoForm">) {
  // Rendiciones (migración 120, 21-sep-2026): mismo formulario, pero el
  // gasto queda asociado a una rendición en 'borrador' y la foto pasa a
  // ser obligatoria (una rendición sin respaldo fotográfico no sirve
  // para la reconciliación) — ver guardar() más abajo.
  const rendicionId = route.params?.rendicionId;
  // Editar/ver un gasto ya existente (RendicionDetalleScreen → tocar
  // una fila, 22-sep-2026) — mismo formulario, precargado; soloLectura
  // cuando la rendición ya no está en borrador o quien mira no puede
  // editarla (ver puedeEditar en esa pantalla).
  const gastoId = route.params?.gastoId;
  const soloLectura = Boolean(route.params?.soloLectura);
  // Pantalla modal (presentation: "modal" en MasStack.tsx) — no vive
  // dentro del pager de AppTabs.tsx, así que no hereda el fix de
  // paddingBottom de la tab bar (ver ese archivo, 20-sep-2026). Necesita
  // su propio insets.bottom para no quedar detrás de la barra de
  // gestos/navegación de Android.
  const insets = useSafeAreaInsets();
  const { enLinea } = useRed();
  const auth = useAuth();
  const [categorias, setCategorias] = useState<CategoriaGasto[] | null>(null);
  const [centros, setCentros] = useState<CentroCosto[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [trabajos, setTrabajos] = useState<TrabajoLista[]>([]);
  const [foto, setFoto] = useState<Foto | null>(null);
  const [guardando, setGuardando] = useState(false);
  // Foto ya subida de un gasto existente (URL firmada) — distinta de
  // `foto` (una recién elegida en el celular, todavía sin subir).
  // `null` mientras carga o si el gasto no tiene comprobante todavía
  // (la foto puede seguir en la cola de sincronización).
  const [fotoExistenteUrl, setFotoExistenteUrl] = useState<string | null>(null);
  const [cargandoGasto, setCargandoGasto] = useState(Boolean(gastoId));
  const [verFotoGrande, setVerFotoGrande] = useState(false);

  const [b, setB] = useState<BorradorGasto>(VACIO);
  const set = <K extends keyof BorradorGasto>(k: K, v: BorradorGasto[K]) => setB((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    navigation.setOptions({ title: gastoId ? (soloLectura ? "Gasto" : "Editar gasto") : rendicionId ? "Agregar gasto" : "Nuevo gasto" });
  }, [navigation, rendicionId, gastoId, soloLectura]);

  useEffect(() => {
    if (!gastoId) return;
    let activo = true;
    (async () => {
      const [rGasto, url] = await Promise.all([obtenerGasto(gastoId), obtenerComprobanteUrl(gastoId)]);
      if (!activo) return;
      if (rGasto.ok) {
        const g = rGasto.gasto;
        setB({
          descripcion: g.descripcion ?? "",
          monto: String(g.monto ?? ""),
          categoria_gasto_id: g.categoria_gasto_id ?? "",
          centro_costo_id: g.centro_costo_id ?? "",
          proveedor_id: g.proveedor_id ?? "",
          trabajo_id: g.trabajo_id ?? "",
          fecha: g.fecha,
          estado: g.estado,
          fecha_pago: g.fecha_pago ?? clave(new Date()),
        });
      } else {
        Alert.alert("No se pudo cargar el gasto", rGasto.error);
      }
      setFotoExistenteUrl(url);
      setCargandoGasto(false);
    })();
    return () => {
      activo = false;
    };
  }, [gastoId]);

  useEffect(() => {
    Promise.all([listarCategoriasGasto(), listarCentrosCosto(), listarProveedores(), listarTrabajos(true)]).then(
      ([cats, cc, prov, trab]) => {
        setCategorias(cats);
        setCentros(cc);
        setProveedores(prov.filter((p) => p.activo));
        setTrabajos(trab.trabajos);
      }
    );
  }, []);

  async function adjuntarFoto() {
    const [elegida] = await elegirFotos({ titulo: "Foto del comprobante" });
    if (elegida) setFoto(elegida);
  }

  // "Crear al vuelo" (20-sep-2026) — pedido explícito: crear Proveedor y
  // Categoría sin salir de Nuevo gasto (Orden de Servicio queda afuera a
  // propósito: es un dato asociado, no algo que se cree desde acá).
  // Categoría está gateada por el backend a requiereModulo("configuracion")
  // (ver services/gastos.ts) — un colaborador normalmente no lo tiene, así
  // que ni se le ofrece el botón (ver más abajo, puedeCrearCategoria).
  async function crearProveedorAlVuelo(nombre: string) {
    if (!nombre) return;
    const r = await crearProveedor(nombre);
    if (!r.ok) return Alert.alert("No se pudo crear el proveedor", r.error);
    setProveedores((p) => [...p, r.proveedor]);
    set("proveedor_id", r.proveedor.id);
  }

  async function crearCategoriaAlVuelo(nombre: string) {
    if (!nombre) return;
    const r = await crearCategoriaGasto(nombre);
    if (!r.ok) return Alert.alert("No se pudo crear la categoría", r.error);
    setCategorias((c) => [...(c ?? []), r.categoria]);
    set("categoria_gasto_id", r.categoria.id);
  }

  async function guardar() {
    if (!b.categoria_gasto_id) return Alert.alert("Falta la categoría", "Elige una categoría de gasto.");
    if (!(Number(b.monto || 0) > 0)) return Alert.alert("Falta el monto", "Ingresa el monto del gasto.");

    const volver = () => navigation.goBack();

    if (gastoId) {
      if (!foto && !fotoExistenteUrl) return Alert.alert("Falta la foto", "Un gasto de rendición siempre necesita comprobante.");
      // Igual que "agregar gasto": sin cola para la edición en sí
      // (necesita conexión). La foto nueva, si la hay, sí va por la
      // cola de siempre.
      if (!enLinea) return Alert.alert("Sin conexión", "Necesitás conexión para guardar los cambios.");
      setGuardando(true);
      const r = await actualizarGasto(gastoId, b);
      if (!r.ok) {
        setGuardando(false);
        return Alert.alert("No se pudo guardar", r.error);
      }
      if (foto) await encolarComprobante(gastoId, foto);
      setGuardando(false);
      return Alert.alert(
        "Cambios guardados",
        foto ? "La foto nueva se está subiendo y se reintenta sola si falla." : "Listo.",
        [{ text: "Listo", onPress: volver }]
      );
    }

    if (rendicionId) {
      if (!foto) return Alert.alert("Falta la foto", "Un gasto de rendición siempre necesita comprobante.");
      // Sin cola offline para la creación en sí (mismo criterio que
      // "crear al vuelo" de categoría/proveedor): necesita conexión. La
      // foto sí va por la cola de siempre (agregarGastoRendicion la
      // encola aparte) — eso nunca se pierde aunque falte señal después.
      if (!enLinea) return Alert.alert("Sin conexión", "Necesitás conexión para agregar un gasto a la rendición.");
      setGuardando(true);
      const r = await agregarGastoRendicion(rendicionId, b, foto);
      setGuardando(false);
      if (!r.ok) return Alert.alert("No se pudo agregar", r.error);
      return Alert.alert("Gasto agregado", "El comprobante se está subiendo y se reintenta solo si falla.", [{ text: "Listo", onPress: volver }]);
    }

    setGuardando(true);

    if (enLinea) {
      const r = await crearGasto(b, foto ?? undefined);
      if (r.ok) {
        setGuardando(false);
        return Alert.alert(
          "Gasto registrado",
          r.comprobantePendiente ? "El comprobante se está subiendo y se reintenta solo si falla." : "Listo.",
          [{ text: "Listo", onPress: volver }]
        );
      }
      if (!r.reintentable) {
        setGuardando(false);
        return Alert.alert("No se pudo registrar", r.error);
      }
      await encolarGasto(b, foto ?? undefined);
      setGuardando(false);
      return Alert.alert(
        "Se reintentará solo",
        "No se pudo enviar ahora (conexión o servidor). Lo guardamos y se reenvía cuando haya señal.",
        [{ text: "Listo", onPress: volver }]
      );
    }

    await encolarGasto(b, foto ?? undefined);
    setGuardando(false);
    Alert.alert("Guardado sin conexión", "Se enviará cuando vuelvas a tener señal.", [{ text: "Listo", onPress: volver }]);
  }

  if (categorias === null || cargandoGasto) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.color.bg, padding: tokens.space["4"] }}>
        <LoadingState />
      </View>
    );
  }

  const fotoVisor = foto?.uri ?? fotoExistenteUrl;

  if (soloLectura) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
        <ScrollView contentContainerStyle={{ padding: tokens.space["4"], gap: tokens.space["4"], paddingBottom: tokens.space["8"] + insets.bottom }}>
          <CampoLectura etiqueta="Categoría" valor={categorias.find((c) => c.id === b.categoria_gasto_id)?.nombre ?? "—"} />
          <CampoLectura etiqueta="Monto" valor={`$${Number(b.monto || 0).toLocaleString("es-CL")}`} />
          {b.descripcion ? <CampoLectura etiqueta="Descripción" valor={b.descripcion} /> : null}
          <CampoLectura etiqueta="Fecha" valor={b.fecha} />
          <View style={{ gap: tokens.space["1"] * 1.5 }}>
            <Texto tamano={tokens.size.small} peso="medium" color={tokens.color.textSecondary}>
              Foto del comprobante
            </Texto>
            {fotoExistenteUrl ? (
              <Pressable accessibilityRole="imagebutton" accessibilityLabel="Ver foto en grande" onPress={() => setVerFotoGrande(true)}>
                <Image
                  source={{ uri: fotoExistenteUrl }}
                  style={{ width: "100%", height: 220, borderRadius: tokens.radius.md, backgroundColor: tokens.color.surface }}
                  resizeMode="cover"
                />
              </Pressable>
            ) : (
              <Texto tamano={tokens.size.small} color={tokens.color.textSecondary}>
                Todavía se está subiendo — volvé a entrar en un rato.
              </Texto>
            )}
          </View>
        </ScrollView>
        <VisorFotoGrande visible={verFotoGrande} url={fotoVisor} onCerrar={() => setVerFotoGrande(false)} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ padding: tokens.space["4"], gap: tokens.space["4"], paddingBottom: tokens.space["8"] + insets.bottom }}
          keyboardShouldPersistTaps="handled"
        >
          <Input
            etiqueta="Descripción (opcional)"
            placeholder="Ej. Bencina camión 3"
            valor={b.descripcion}
            onCambio={(v) => set("descripcion", v)}
          />

          <InputMonto valor={b.monto} onChangeText={(v) => set("monto", v)} />

          <PickerBuscable
            etiqueta="Categoría"
            placeholder="Elegir categoría"
            valor={b.categoria_gasto_id}
            opciones={categorias.map((c) => ({ id: c.id, label: c.nombre }))}
            onElegir={(id) => set("categoria_gasto_id", id)}
            // El backend exige el módulo "configuracion" para crear
            // categorías (no delegable a colaborador) — si el usuario
            // logueado no lo tiene, no le ofrecemos un botón que le va a
            // devolver 403.
            {...(auth.fase === "listo" && auth.modulosVisibles.includes("configuracion")
              ? { alCrear: crearCategoriaAlVuelo, etiquetaCrear: "Crear categoría" }
              : {})}
          />
          {/* Tarea 144: una empresa nueva parte sin categorías (se crean desde las
              sugerencias de su rubro). Sin permiso para crearlas, se avisa. */}
          {categorias.length === 0 && !(auth.fase === "listo" && auth.modulosVisibles.includes("configuracion")) ? (
            <Texto tamano={tokens.size.caption} color={tokens.color.textSecondary}>
              Tu empresa todavía no tiene categorías de gasto. Pídele a la oficina que las cree en Configuración → Categorías de gastos.
            </Texto>
          ) : null}

          {centros.length > 0 ? (
            <PickerBuscable
              etiqueta="Centro de costo (opcional)"
              placeholder="Sin centro de costo"
              opcionVacia="Sin centro de costo"
              valor={b.centro_costo_id}
              opciones={centros.map((c) => ({ id: c.id, label: c.nombre }))}
              onElegir={(id) => set("centro_costo_id", id)}
            />
          ) : null}

          <PickerBuscable
            etiqueta="Proveedor (opcional)"
            placeholder="Sin proveedor"
            opcionVacia="Sin proveedor"
            valor={b.proveedor_id}
            opciones={proveedores.map((p) => ({ id: p.id, label: p.nombre }))}
            onElegir={(id) => set("proveedor_id", id)}
            alCrear={crearProveedorAlVuelo}
            etiquetaCrear="Crear proveedor"
          />

          {trabajos.length > 0 ? (
            <PickerBuscable
              etiqueta="Orden de Servicio (opcional)"
              placeholder="Sin vincular"
              opcionVacia="Sin vincular"
              valor={b.trabajo_id}
              opciones={trabajos.map((tr) => ({
                id: tr.id,
                // Antes solo mostraba el nombre del cliente — con varias OS
                // del mismo cliente era imposible distinguir cuál era cuál
                // (20-sep-2026). El folio ya lo devuelve /api/trabajos
                // (orden.folio, ver TrabajoLista) — solo faltaba usarlo acá.
                label: tr.orden?.folio != null ? `${formatearFolio("OS", tr.orden.folio)} · ${tr.cliente}` : tr.cliente,
                sublabel: tr.fecha,
              }))}
              onElegir={(id) => set("trabajo_id", id)}
            />
          ) : null}

          <View style={{ gap: tokens.space["1"] * 1.5 }}>
            <Texto tamano={tokens.size.small} peso="medium" color={tokens.color.textSecondary}>
              Fecha
            </Texto>
            <SelectorDias valor={b.fecha} onElegir={(k) => set("fecha", k)} />
          </View>

          <View style={{ gap: tokens.space["1"] * 1.5 }}>
            <Texto tamano={tokens.size.small} peso="medium" color={tokens.color.textSecondary}>
              Estado
            </Texto>
            <View style={{ flexDirection: "row", gap: tokens.space["2"] }}>
              {ESTADOS.map((e) => {
                const activo = e.valor === b.estado;
                return (
                  <EstadoChip key={e.valor} activo={activo} label={e.label} onPress={() => set("estado", e.valor)} />
                );
              })}
            </View>
          </View>

          {b.estado === "pagado" ? (
            <View style={{ gap: tokens.space["1"] * 1.5 }}>
              <Texto tamano={tokens.size.small} peso="medium" color={tokens.color.textSecondary}>
                Fecha de pago
              </Texto>
              <SelectorDias valor={b.fecha_pago} onElegir={(k) => set("fecha_pago", k)} />
            </View>
          ) : null}

          {/* Foto de la boleta — al final (20-sep-2026, pedido explícito:
              la descripción va antes, la foto queda como lo último antes
              de guardar). */}
          {foto ? (
            <View style={{ gap: tokens.space["2"] }}>
              <Pressable accessibilityRole="imagebutton" accessibilityLabel="Ver foto en grande" onPress={() => setVerFotoGrande(true)}>
                <Image source={{ uri: foto.uri }} style={{ width: "100%", height: 220, borderRadius: tokens.radius.md, backgroundColor: tokens.color.surface }} resizeMode="cover" />
              </Pressable>
              <View style={{ flexDirection: "row", gap: tokens.space["2"] }}>
                <View style={{ flex: 1 }}>
                  <Button variante="secundario" bloque onPress={adjuntarFoto}>
                    Cambiar
                  </Button>
                </View>
                {/* "Quitar" solo tiene sentido si no hay una foto ya
                    subida atrás — si la hay, sacar la nueva simplemente
                    vuelve a mostrar esa (gastoId, edición). */}
                {!gastoId ? (
                  <View style={{ flex: 1 }}>
                    <Button variante="peligro" bloque onPress={() => setFoto(null)}>
                      Quitar
                    </Button>
                  </View>
                ) : null}
              </View>
            </View>
          ) : gastoId && fotoExistenteUrl ? (
            <View style={{ gap: tokens.space["2"] }}>
              <Pressable accessibilityRole="imagebutton" accessibilityLabel="Ver foto en grande" onPress={() => setVerFotoGrande(true)}>
                <Image
                  source={{ uri: fotoExistenteUrl }}
                  style={{ width: "100%", height: 220, borderRadius: tokens.radius.md, backgroundColor: tokens.color.surface }}
                  resizeMode="cover"
                />
              </Pressable>
              <Button variante="secundario" bloque onPress={adjuntarFoto}>
                Cambiar foto
              </Button>
            </View>
          ) : gastoId ? (
            <Texto tamano={tokens.size.small} color={tokens.color.textSecondary}>
              La foto todavía se está subiendo — volvé a entrar en un rato para verla o cambiarla.
            </Texto>
          ) : (
            <Pressable
              onPress={adjuntarFoto}
              style={{
                height: 160,
                borderRadius: tokens.radius.md,
                borderWidth: 1.5,
                borderStyle: "dashed",
                borderColor: tokens.color.divider,
                alignItems: "center",
                justifyContent: "center",
                gap: tokens.space["2"],
              }}
            >
              <Camera size={28} strokeWidth={2} color={tokens.color.textSecondary} />
              <Texto tamano={tokens.size.small} peso="semibold" color={tokens.color.textSecondary}>
                {rendicionId ? "Foto de la boleta (obligatoria)" : "Foto de la boleta"}
              </Texto>
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <View
        style={{
          padding: tokens.space["4"],
          borderTopWidth: 1,
          borderTopColor: tokens.color.divider,
          backgroundColor: tokens.color.surface,
        }}
      >
        <Button tamano="lg" bloque onPress={guardar} cargando={guardando}>
          {gastoId ? "Guardar cambios" : "Registrar gasto"}
        </Button>
      </View>

      <VisorFotoGrande visible={verFotoGrande} url={fotoVisor} onCerrar={() => setVerFotoGrande(false)} />
    </View>
  );
}

// Detalle de un campo en modo solo-lectura (gasto de una rendición ya
// enviada/aprobada/rechazada, o mirado por alguien que no puede
// editarlo) — mismo estilo de etiqueta que el resto del formulario,
// sin el input.
function CampoLectura({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <View style={{ gap: tokens.space["1"] * 1.5 }}>
      <Texto tamano={tokens.size.small} peso="medium" color={tokens.color.textSecondary}>
        {etiqueta}
      </Texto>
      <Texto tamano={tokens.size.body} color={tokens.color.text}>
        {valor}
      </Texto>
    </View>
  );
}

// Foto a pantalla completa al tocar la miniatura — mismo patrón que
// FotosSection.tsx (trabajos), para no inventar uno nuevo.
function VisorFotoGrande({ visible, url, onCerrar }: { visible: boolean; url: string | null; onCerrar: () => void }) {
  return (
    <Modal visible={visible && Boolean(url)} transparent animationType="fade" onRequestClose={onCerrar}>
      <Pressable accessibilityRole="button" accessibilityLabel="Cerrar foto"
        onPress={onCerrar}
        style={{ flex: 1, backgroundColor: `${tokens.color.neutral["900"]}d9`, alignItems: "center", justifyContent: "center", padding: 16 }}
      >
        {url ? <Image source={{ uri: url }} resizeMode="contain" style={{ width: "100%", height: "80%" }} /> : null}
      </Pressable>
    </Modal>
  );
}

function EstadoChip({ activo, label, onPress }: { activo: boolean; label: string; onPress: () => void }) {
  const marca = useMarca();
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        minHeight: 44,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: tokens.radius.md,
        backgroundColor: activo ? marca.suave : tokens.color.surface,
        borderWidth: 1,
        borderColor: activo ? marca.base : tokens.color.divider,
      }}
    >
      <Texto tamano={tokens.size.caption} peso="semibold" color={activo ? marca.fuerte : tokens.color.textSecondary}>
        {label}
      </Texto>
    </Pressable>
  );
}
