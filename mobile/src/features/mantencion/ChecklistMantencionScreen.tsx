import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Image, Pressable, ScrollView, View } from "react-native";
import { ArrowLeft, Camera, ChevronDown, ChevronUp, X } from "lucide-react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { Proveedor, RespuestaChecklistMantencion } from "@bitacora/shared";
import { MANTENCION_EXIGE_FOTO_EN_NO } from "@bitacora/shared";
import { tokens } from "@bitacora/design-tokens";
import { Button, Input, LoadingState, ScreenHeader, Textarea, Texto, useMarca } from "@bitacora/ui/native";
import { PickerBuscable } from "../../components/ui";
import { LienzoFirma, type LienzoFirmaHandle } from "../../components/LienzoFirma";
import { useRed } from "../../services/sync/NetworkProvider";
import { elegirFotos } from "../../lib/imagen";
import { listarProveedores } from "../../services/gastos";
import type { MasStackParamList } from "../../shell/navigation/types";
import {
  crearRegistroMantencion,
  encolarRegistroMantencion,
  obtenerPlantillaMantencion,
  type BorradorMantencion,
  type PlantillaMantencion,
} from "../../services/mantencion";

const OPCIONES: { valor: RespuestaChecklistMantencion; texto: string }[] = [
  { valor: "si", texto: "Sí" },
  { valor: "no", texto: "No" },
  { valor: "na", texto: "N/A" },
];
const MAX_FOTOS = 8;
const clave = (s: string, i: string) => `${s}||${i}`;

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
function isoMenos(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return d.toISOString().slice(0, 10);
}
function etiquetaFecha(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${MESES[m - 1]}`;
}

type FotoLocal = { uri: string; item: string | null };

// Sistema visual móvil v2 (14-sep-2026) — migración del sistema viejo
// (useTema/Ionicons/components-ui) al nuevo: ScreenHeader propio con
// `accion`=volver (antes el título nativo del stack, vía
// navigation.setOptions) + tokens/Texto/Button/Input/Textarea de
// @bitacora/ui/native. `PickerBuscable` (taller) y `LienzoFirma`
// (firma) se mantienen tal cual — sin equivalente v2, mismo criterio
// que NuevoGastoScreen/NuevaCitaScreen. La barra fija de progreso+fecha
// y la barra fija inferior de guardar no tienen equivalente de
// primitivo v2 (son específicas de este formulario) — quedan como
// View+tokens planos, mismo criterio que las banners de cola de
// ViajesScreen.
export function ChecklistMantencionScreen({ route, navigation }: NativeStackScreenProps<MasStackParamList, "ChecklistMantencion">) {
  const marca = useMarca();
  const { enLinea } = useRed();
  const { equipoId, tipo, patente } = route.params;

  const [plantilla, setPlantilla] = useState<PlantillaMantencion | null>(null);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [respuestas, setRespuestas] = useState<Record<string, RespuestaChecklistMantencion>>({});
  const [fecha, setFecha] = useState(isoMenos(0));
  const [km, setKm] = useState("");
  const [horas, setHoras] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [proveedorId, setProveedorId] = useState("");
  const [fotos, setFotos] = useState<FotoLocal[]>([]);
  const [abierta, setAbierta] = useState(0);
  const [guardando, setGuardando] = useState(false);
  const lienzo = useRef<LienzoFirmaHandle>(null);

  useEffect(() => {
    void obtenerPlantillaMantencion(tipo).then(setPlantilla);
    if (tipo === "programa") void listarProveedores().then((p) => setProveedores(p.filter((x) => x.activo)));
  }, [tipo]);

  const totalItems = useMemo(
    () => (plantilla ? plantilla.secciones.reduce((n, s) => n + s.preguntas.length, 0) : 0),
    [plantilla]
  );
  const respondidos = Object.keys(respuestas).length;

  const responder = (s: string, i: string, v: RespuestaChecklistMantencion) =>
    setRespuestas((r) => ({ ...r, [clave(s, i)]: v }));

  // Ítems en NO sin foto asociada (regla MANTENCION_EXIGE_FOTO_EN_NO).
  const itemsNoSinFoto = useMemo(() => {
    if (!plantilla || !MANTENCION_EXIGE_FOTO_EN_NO) return [];
    const conFoto = new Set(fotos.map((f) => f.item).filter((x): x is string => Boolean(x)));
    return plantilla.secciones
      .flatMap((s) => s.preguntas.map((p) => ({ item: p.texto, k: clave(s.nombre, p.texto) })))
      .filter(({ item, k }) => respuestas[k] === "no" && !conFoto.has(item))
      .map(({ item }) => item);
  }, [plantilla, respuestas, fotos]);

  async function tomarFoto(item: string | null) {
    if (fotos.length >= MAX_FOTOS) return Alert.alert("Máximo de fotos", `Puedes adjuntar hasta ${MAX_FOTOS}.`);
    const elegidas = await elegirFotos({ multiple: !item });
    if (!elegidas.length) return;
    const cupo = MAX_FOTOS - fotos.length;
    setFotos((prev) => [...prev, ...elegidas.slice(0, cupo).map((f) => ({ uri: f.uri, item }))]);
  }

  function quitarFoto(i: number) {
    setFotos((prev) => prev.filter((_, j) => j !== i));
  }

  const sinResponder = respondidos === 0;
  const faltaProveedor = tipo === "programa" && !proveedorId;
  const bloqueado = sinResponder || faltaProveedor || itemsNoSinFoto.length > 0;
  const ayuda = faltaProveedor
    ? "Elige el taller o lubricentro para guardar."
    : sinResponder
      ? "Responde al menos la primera sección para guardar."
      : itemsNoSinFoto.length > 0
        ? `Falta una foto en: ${itemsNoSinFoto.join(", ")}.`
        : totalItems - respondidos > 0
          ? `${totalItems - respondidos} ítems sin responder quedarán como N/A.`
          : "Listo para guardar.";

  async function guardar() {
    if (!plantilla || bloqueado) return;
    const checklist = plantilla.secciones.flatMap((sec) =>
      sec.preguntas.flatMap((p) => {
        const resp = respuestas[clave(sec.nombre, p.texto)];
        return resp ? [{ seccion: sec.nombre, item: p.texto, respuesta: resp }] : [];
      })
    );

    setGuardando(true);

    let firma_base64: string | null = null;
    if (tipo === "programa" && lienzo.current && !lienzo.current.vacio()) {
      firma_base64 = await lienzo.current.capturar();
    }

    // Las fotos van como archivos (uri), NO en base64 dentro del JSON —
    // eso rompía express.json (100 kb) con un 413.
    const borrador: BorradorMantencion = {
      equipoId,
      tipo,
      fecha,
      checklist,
      kilometraje: km,
      horas_motor: horas,
      observaciones,
      proveedor_id: tipo === "programa" ? proveedorId : undefined,
      firma_base64,
      fotos: fotos.map((f, i) => ({ item: f.item, uri: f.uri, name: `mantencion-${i}.jpg`, type: "image/jpeg" })),
    };

    const volverALista = () => navigation.navigate("MantencionVehiculo");

    // Con fotos, NUNCA se intenta inline — va directo a la cola. Bug real
    // (14-sep-2026): el intento inline (multipart, texto+fotos juntos) se
    // hacía primero y, si fallaba, se encolaba TODO como respaldo — pero
    // un multipart que "timeoutea" en el celular no se puede cancelar de
    // verdad en RN (TIMEOUT_MULTIPART_MS en api.ts), así que el intento
    // original seguía viajando mientras la cola mandaba una segunda copia
    // de las MISMAS fotos: dos subidas del mismo archivo compitiendo por
    // la misma conexión real de celular, y en señal mala ninguna termina
    // nunca (cero rastro en los logs del backend). Sin fotos, el envío es
    // JSON puro con AbortController real (sí cancela de verdad) — ahí
    // sigue siendo seguro intentar inline primero.
    if (enLinea && (borrador.fotos ?? []).length === 0) {
      const r = await crearRegistroMantencion(borrador);
      if (r.ok) {
        setGuardando(false);
        return Alert.alert("Registro guardado", "Quedó en la oficina.", [{ text: "Listo", onPress: volverALista }]);
      }
      if (!r.reintentable) {
        setGuardando(false);
        return Alert.alert("No se pudo guardar", r.error);
      }
    }

    await encolarRegistroMantencion(borrador);
    setGuardando(false);
    // Con fotos y buena señal el registro se manda solo, sin que haya
    // habido ningún fallo — no es un "reintento". Mismo texto que usa
    // Viaje para la foto de la guía, que va por el mismo camino.
    const conFotos = (borrador.fotos ?? []).length > 0;
    Alert.alert(
      !enLinea ? "Guardado sin conexión" : conFotos ? "Registro guardado" : "Se reintentará solo",
      !enLinea || !conFotos
        ? "El chequeo en curso quedó guardado en el teléfono y se envía a la oficina cuando haya señal."
        : "Quedó en la oficina. Las fotos se están subiendo y se reintentan solas si falla.",
      [{ text: "Listo", onPress: volverALista }]
    );
  }

  const volver = { icono: <ArrowLeft size={20} strokeWidth={2.5} color={tokens.color.text} />, onPress: () => navigation.goBack(), etiquetaAccesible: "Volver" };
  const tituloPantalla = tipo === "diario" ? "Checklist diario" : "Mantención Flota";

  if (!plantilla) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
        <ScreenHeader titulo={tituloPantalla} accion={volver} />
        <View style={{ padding: tokens.space["4"] }}>
          <LoadingState />
        </View>
      </View>
    );
  }

  const progreso = totalItems > 0 ? respondidos / totalItems : 0;
  const chips = [
    { iso: isoMenos(0), label: `Hoy · ${etiquetaFecha(isoMenos(0))}` },
    { iso: isoMenos(1), label: `Ayer · ${etiquetaFecha(isoMenos(1))}` },
    { iso: isoMenos(2), label: etiquetaFecha(isoMenos(2)) },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
      <ScreenHeader titulo={tituloPantalla} accion={volver} />

      {/* Barra fija: contexto + progreso + chips de fecha */}
      <View
        style={{
          backgroundColor: tokens.color.surface,
          borderBottomWidth: 1,
          borderBottomColor: tokens.color.divider,
          paddingHorizontal: tokens.space["4"],
          paddingTop: tokens.space["2"],
          paddingBottom: tokens.space["3"],
          gap: tokens.space["2"],
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Texto tamano={tokens.size.caption} color={`${tokens.color.text}99`} numberOfLines={1} style={{ flex: 1 }}>
            {patente ?? "Vehículo asignado"}
          </Texto>
          <Texto tamano={tokens.size.caption} color={`${tokens.color.text}99`} style={{ fontVariant: ["tabular-nums"] }}>
            {respondidos}/{totalItems}
          </Texto>
        </View>
        <View style={{ height: 3, borderRadius: 3, backgroundColor: tokens.color.divider, overflow: "hidden" }}>
          <View style={{ width: `${Math.round(progreso * 100)}%`, height: 3, backgroundColor: marca.base }} />
        </View>
        <View style={{ flexDirection: "row", gap: tokens.space["2"] }}>
          {chips.map((c) => {
            const sel = fecha === c.iso;
            return (
              <Pressable
                key={c.iso}
                onPress={() => setFecha(c.iso)}
                style={{
                  minHeight: 46,
                  flex: 1,
                  borderRadius: tokens.radius.md,
                  borderWidth: 1,
                  borderColor: sel ? marca.base : tokens.color.divider,
                  backgroundColor: sel ? `${marca.base}1f` : tokens.color.surface,
                  alignItems: "center",
                  justifyContent: "center",
                  paddingHorizontal: tokens.space["1"],
                }}
              >
                <Texto tamano={tokens.size.caption} color={sel ? marca.base : `${tokens.color.text}99`} peso={sel ? "semibold" : "medium"} numberOfLines={1}>
                  {c.label}
                </Texto>
              </Pressable>
            );
          })}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: tokens.space["4"], gap: tokens.space["3"], paddingBottom: tokens.space["8"] }} keyboardShouldPersistTaps="handled">
        {tipo === "programa" && (
          <PickerBuscable
            etiqueta="Taller / lubricentro"
            placeholder="Elegir taller autorizado"
            valor={proveedorId}
            opciones={proveedores.map((p) => ({ id: p.id, label: p.nombre }))}
            onElegir={setProveedorId}
          />
        )}

        <View style={{ flexDirection: "row", gap: tokens.space["3"] }}>
          <View style={{ flex: 1 }}>
            <Input etiqueta="Kilometraje" tipo="numero" valor={km} onCambio={(v) => setKm(v.replace(/[^\d]/g, ""))} />
          </View>
          <View style={{ flex: 1 }}>
            <Input etiqueta="Horas motor" tipo="numero" valor={horas} onCambio={(v) => setHoras(v.replace(/[^\d]/g, ""))} />
          </View>
        </View>

        {plantilla.secciones.map((sec, idx) => {
          const open = abierta === idx;
          const enSeccion = sec.preguntas.filter((p) => respuestas[clave(sec.nombre, p.texto)]).length;
          const completa = enSeccion === sec.preguntas.length;
          return (
            <View key={sec.nombre} style={{ borderWidth: 1, borderColor: tokens.color.divider, borderRadius: tokens.radius.md, overflow: "hidden", backgroundColor: tokens.color.surface }}>
              <Pressable
                onPress={() => setAbierta(open ? -1 : idx)}
                style={{ flexDirection: "row", alignItems: "center", gap: tokens.space["3"], padding: tokens.space["3"], minHeight: 56 }}
              >
                <View style={{ width: 22, height: 22, borderRadius: tokens.radius.sm, backgroundColor: completa ? tokens.color.accent2Ramp["200"] : marca.suave, alignItems: "center", justifyContent: "center" }}>
                  <Texto tamano={tokens.size.caption} peso="semibold" color={completa ? tokens.color.accent2Ramp["800"] : marca.fuerte} style={{ fontVariant: ["tabular-nums"] }}>
                    {idx + 1}
                  </Texto>
                </View>
                <Texto tamano={tokens.size.body} color={tokens.color.text} peso="semibold" style={{ flex: 1 }}>
                  {sec.nombre}
                </Texto>
                <View style={{ paddingHorizontal: tokens.space["2"], paddingVertical: 2, borderRadius: 999, backgroundColor: completa ? tokens.color.accent2Ramp["200"] : tokens.color.neutral["200"] }}>
                  <Texto tamano={tokens.size.caption} peso="semibold" color={completa ? tokens.color.accent2Ramp["800"] : `${tokens.color.text}99`} style={{ fontVariant: ["tabular-nums"] }}>
                    {enSeccion}/{sec.preguntas.length}
                  </Texto>
                </View>
                {open ? (
                  <ChevronUp size={18} strokeWidth={2.5} color={`${tokens.color.text}66`} />
                ) : (
                  <ChevronDown size={18} strokeWidth={2.5} color={`${tokens.color.text}66`} />
                )}
              </Pressable>

              {open && (
                <View style={{ paddingHorizontal: tokens.space["3"], paddingBottom: tokens.space["2"] }}>
                  {sec.preguntas.map((p) => {
                    const actual = respuestas[clave(sec.nombre, p.texto)];
                    const nFotos = fotos.filter((f) => f.item === p.texto).length;
                    const necesitaFoto = MANTENCION_EXIGE_FOTO_EN_NO && actual === "no" && nFotos === 0;
                    return (
                      <View key={p.texto} style={{ paddingVertical: tokens.space["3"], borderTopWidth: 1, borderTopColor: tokens.color.divider }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: tokens.space["2"], marginBottom: tokens.space["2"] }}>
                          <Texto tamano={tokens.size.body} color={tokens.color.text} style={{ flex: 1 }}>
                            {p.texto}
                          </Texto>
                          {actual === "no" && (
                            <Pressable
                              onPress={() => tomarFoto(p.texto)}
                              hitSlop={8}
                              style={{
                                minHeight: 32,
                                paddingHorizontal: tokens.space["2"],
                                borderRadius: tokens.radius.sm,
                                borderWidth: 1,
                                borderColor: necesitaFoto ? tokens.color.accentRamp["700"] : tokens.color.divider,
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <Texto tamano={tokens.size.caption} peso="semibold" color={necesitaFoto ? tokens.color.accentRamp["700"] : marca.base}>
                                {nFotos ? `Foto (${nFotos})` : "+ Foto"}
                              </Texto>
                            </Pressable>
                          )}
                        </View>
                        <View style={{ flexDirection: "row", gap: tokens.space["2"] }}>
                          {OPCIONES.map((op) => {
                            const sel = actual === op.valor;
                            const bg = sel
                              ? op.valor === "si"
                                ? tokens.color.accent2Ramp["700"]
                                : op.valor === "no"
                                  ? tokens.color.accentRamp["700"]
                                  : marca.base
                              : tokens.color.surface;
                            const fg = sel ? (op.valor === "na" ? marca.foreground : tokens.color.neutral["100"]) : `${tokens.color.text}99`;
                            return (
                              <Pressable
                                key={op.valor}
                                onPress={() => responder(sec.nombre, p.texto, op.valor)}
                                accessibilityRole="radio"
                                accessibilityState={{ selected: sel }}
                                style={{
                                  flex: 1,
                                  minHeight: 46,
                                  borderRadius: tokens.radius.md,
                                  borderWidth: 1,
                                  borderColor: sel ? bg : tokens.color.divider,
                                  backgroundColor: bg,
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                              >
                                <Texto tamano={tokens.size.body} peso="semibold" color={fg}>
                                  {op.texto}
                                </Texto>
                              </Pressable>
                            );
                          })}
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })}

        {tipo === "programa" && (
          <View style={{ gap: tokens.space["1"] }}>
            <Texto tamano={tokens.size.micro} color={`${tokens.color.text}99`} peso="semibold" style={{ textTransform: "uppercase" }}>
              Firma del responsable
            </Texto>
            <LienzoFirma ref={lienzo} />
          </View>
        )}

        <View style={{ gap: tokens.space["2"] }}>
          <Button
            variante="secundario"
            iconoIzq={<Camera size={18} strokeWidth={2.5} color={tokens.color.text} />}
            onPress={() => tomarFoto(null)}
          >
            {fotos.length ? `Fotos adjuntas (${fotos.length})` : "Adjuntar foto general"}
          </Button>
          {fotos.length > 0 && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: tokens.space["2"] }}>
              {fotos.map((f, i) => (
                <View key={`${f.uri}-${i}`} style={{ width: 84, height: 84 }}>
                  <Image source={{ uri: f.uri }} style={{ width: 84, height: 84, borderRadius: tokens.radius.md, backgroundColor: tokens.color.neutral["200"] }} />
                  <Pressable
                    onPress={() => quitarFoto(i)}
                    hitSlop={8}
                    style={{ position: "absolute", right: -6, top: -6, width: 24, height: 24, borderRadius: 12, backgroundColor: tokens.color.accentRamp["700"], alignItems: "center", justifyContent: "center" }}
                  >
                    <X size={14} strokeWidth={2.5} color={tokens.color.neutral["100"]} />
                  </Pressable>
                  {f.item ? (
                    <View style={{ position: "absolute", bottom: 2, left: 2, right: 2, backgroundColor: `${tokens.color.neutral["900"]}b3`, borderRadius: tokens.radius.sm, paddingHorizontal: 4, paddingVertical: 1 }}>
                      <Texto tamano={10} color={tokens.color.neutral["100"]} numberOfLines={1} style={{ lineHeight: 13 }}>
                        {f.item}
                      </Texto>
                    </View>
                  ) : null}
                </View>
              ))}
            </View>
          )}
        </View>

        <Textarea etiqueta="Observaciones" valor={observaciones} onCambio={setObservaciones} filas={3} />

        {!enLinea && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: tokens.space["2"], backgroundColor: tokens.color.accentRamp["200"], borderRadius: tokens.radius.md, padding: tokens.space["3"] }}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: tokens.color.accentRamp["700"] }} />
            <Texto tamano={tokens.size.caption} color={tokens.color.accentRamp["800"]} style={{ flex: 1 }}>
              Sin conexión — el chequeo se guarda en el teléfono y se envía al recuperar señal.
            </Texto>
          </View>
        )}
      </ScrollView>

      <View style={{ paddingHorizontal: tokens.space["4"], paddingTop: tokens.space["2"], paddingBottom: tokens.space["6"], borderTopWidth: 1, borderTopColor: tokens.color.divider, backgroundColor: tokens.color.surface, gap: tokens.space["2"] }}>
        <Texto tamano={tokens.size.caption} color={`${tokens.color.text}99`}>
          {ayuda}
        </Texto>
        <Button tamano="lg" bloque onPress={guardar} cargando={guardando} deshabilitado={bloqueado}>
          Guardar chequeo
        </Button>
      </View>
    </View>
  );
}
