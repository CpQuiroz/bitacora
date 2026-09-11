import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Image, Pressable, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { Proveedor, RespuestaChecklistMantencion } from "@bitacora/shared";
import { MANTENCION_EXIGE_FOTO_EN_NO } from "@bitacora/shared";
import { useTema } from "../../theme";
import { Button, Input, LoadingScreen, PickerBuscable, Text } from "../../components/ui";
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

export function ChecklistMantencionScreen({ route, navigation }: NativeStackScreenProps<MasStackParamList, "ChecklistMantencion">) {
  const t = useTema();
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
    navigation.setOptions({ title: tipo === "diario" ? "Chequeo diario" : "Programa de mantención" });
  }, [navigation, tipo]);

  useEffect(() => {
    void obtenerPlantillaMantencion().then(setPlantilla);
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

    const volver = () => navigation.navigate("MantencionVehiculo");

    if (enLinea) {
      const r = await crearRegistroMantencion(borrador);
      if (r.ok) {
        setGuardando(false);
        return Alert.alert("Registro guardado", "Quedó en la oficina.", [{ text: "Listo", onPress: volver }]);
      }
      if (!r.reintentable) {
        setGuardando(false);
        return Alert.alert("No se pudo guardar", r.error);
      }
    }

    await encolarRegistroMantencion(borrador);
    setGuardando(false);
    Alert.alert(
      enLinea ? "Se reintentará solo" : "Guardado sin conexión",
      "El chequeo en curso quedó guardado en el teléfono y se envía a la oficina cuando haya señal.",
      [{ text: "Listo", onPress: volver }]
    );
  }

  if (!plantilla) return <LoadingScreen />;

  const progreso = totalItems > 0 ? respondidos / totalItems : 0;
  const chips = [
    { iso: isoMenos(0), label: `Hoy · ${etiquetaFecha(isoMenos(0))}` },
    { iso: isoMenos(1), label: `Ayer · ${etiquetaFecha(isoMenos(1))}` },
    { iso: isoMenos(2), label: etiquetaFecha(isoMenos(2)) },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: t.colores.bg }}>
      {/* Header fijo: contexto + progreso + chips de fecha */}
      <View style={{ backgroundColor: t.colores.surface, borderBottomWidth: 1, borderBottomColor: t.colores.border, paddingHorizontal: t.espacio(4), paddingTop: t.espacio(2), paddingBottom: t.espacio(3), gap: t.espacio(2) }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text variante="caption" tono="muted" numberOfLines={1} style={{ flex: 1 }}>
            {patente ?? "Vehículo asignado"}
          </Text>
          <Text mono variante="caption" tono="muted">
            {respondidos}/{totalItems}
          </Text>
        </View>
        <View style={{ height: 3, borderRadius: 3, backgroundColor: t.colores.border, overflow: "hidden" }}>
          <View style={{ width: `${Math.round(progreso * 100)}%`, height: 3, backgroundColor: t.colores.brand }} />
        </View>
        <View style={{ flexDirection: "row", gap: t.espacio(2) }}>
          {chips.map((c) => {
            const sel = fecha === c.iso;
            return (
              <Pressable
                key={c.iso}
                onPress={() => setFecha(c.iso)}
                style={{ minHeight: 46, flex: 1, borderRadius: t.radio.md, borderWidth: 1, borderColor: sel ? t.colores.brand : t.colores.border, backgroundColor: sel ? t.colores.brandSoft : t.colores.surface, alignItems: "center", justifyContent: "center", paddingHorizontal: t.espacio(1) }}
              >
                <Text variante="caption" weight={sel ? "bold" : "medium"} style={{ color: sel ? t.colores.brand : t.colores.muted }} numberOfLines={1}>
                  {c.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: t.espacio(4), gap: t.espacio(3), paddingBottom: t.espacio(8) }} keyboardShouldPersistTaps="handled">
        {tipo === "programa" && (
          <PickerBuscable
            etiqueta="Taller / lubricentro"
            placeholder="Elegir taller autorizado"
            valor={proveedorId}
            opciones={proveedores.map((p) => ({ id: p.id, label: p.nombre }))}
            onElegir={setProveedorId}
          />
        )}

        <View style={{ flexDirection: "row", gap: t.espacio(3) }}>
          <View style={{ flex: 1 }}>
            <Input etiqueta="Kilometraje" keyboardType="numeric" value={km} onChangeText={(v) => setKm(v.replace(/[^\d]/g, ""))} />
          </View>
          <View style={{ flex: 1 }}>
            <Input etiqueta="Horas motor" keyboardType="numeric" value={horas} onChangeText={(v) => setHoras(v.replace(/[^\d]/g, ""))} />
          </View>
        </View>

        {plantilla.secciones.map((sec, idx) => {
          const open = abierta === idx;
          const enSeccion = sec.preguntas.filter((p) => respuestas[clave(sec.nombre, p.texto)]).length;
          const completa = enSeccion === sec.preguntas.length;
          return (
            <View key={sec.nombre} style={{ borderWidth: 1, borderColor: t.colores.border, borderRadius: t.radio.md, overflow: "hidden", backgroundColor: t.colores.surface }}>
              <Pressable
                onPress={() => setAbierta(open ? -1 : idx)}
                style={{ flexDirection: "row", alignItems: "center", gap: t.espacio(2.5), padding: t.espacio(3), minHeight: 56 }}
              >
                <View style={{ width: 22, height: 22, borderRadius: t.radio.sm, backgroundColor: completa ? t.colores.successSoft : t.colores.brand, alignItems: "center", justifyContent: "center" }}>
                  <Text mono variante="caption" weight="bold" style={{ color: completa ? t.colores.success : "#fff" }}>{idx + 1}</Text>
                </View>
                <Text weight="semibold" style={{ flex: 1 }}>{sec.nombre}</Text>
                <View style={{ paddingHorizontal: t.espacio(2), paddingVertical: 2, borderRadius: 999, backgroundColor: completa ? t.colores.successSoft : t.colores.surfaceAlt }}>
                  <Text variante="caption" weight="bold" style={{ color: completa ? t.colores.success : t.colores.muted }}>
                    {enSeccion}/{sec.preguntas.length}
                  </Text>
                </View>
                <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color={t.colores.faint} />
              </Pressable>

              {open && (
                <View style={{ paddingHorizontal: t.espacio(3), paddingBottom: t.espacio(2) }}>
                  {sec.preguntas.map((p) => {
                    const actual = respuestas[clave(sec.nombre, p.texto)];
                    const nFotos = fotos.filter((f) => f.item === p.texto).length;
                    const necesitaFoto = MANTENCION_EXIGE_FOTO_EN_NO && actual === "no" && nFotos === 0;
                    return (
                      <View key={p.texto} style={{ paddingVertical: t.espacio(2.5), borderTopWidth: 1, borderTopColor: t.colores.border }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: t.espacio(2), marginBottom: t.espacio(2) }}>
                          <Text variante="cuerpo" style={{ flex: 1 }}>{p.texto}</Text>
                          {actual === "no" && (
                            <Pressable
                              onPress={() => tomarFoto(p.texto)}
                              hitSlop={8}
                              style={{ minHeight: 32, paddingHorizontal: t.espacio(2), borderRadius: t.radio.sm, borderWidth: 1, borderColor: necesitaFoto ? t.colores.danger : t.colores.border, alignItems: "center", justifyContent: "center" }}
                            >
                              <Text variante="caption" weight="bold" style={{ color: necesitaFoto ? t.colores.danger : t.colores.brand }}>
                                {nFotos ? `Foto (${nFotos})` : "+ Foto"}
                              </Text>
                            </Pressable>
                          )}
                        </View>
                        <View style={{ flexDirection: "row", gap: t.espacio(2) }}>
                          {OPCIONES.map((op) => {
                            const sel = actual === op.valor;
                            const bg = sel
                              ? op.valor === "si"
                                ? t.colores.success
                                : op.valor === "no"
                                  ? t.colores.danger
                                  : t.colores.brandSoft
                              : t.colores.surface;
                            const fg = sel && op.valor !== "na" ? "#fff" : sel ? t.colores.brand : t.colores.muted;
                            return (
                              <Pressable
                                key={op.valor}
                                onPress={() => responder(sec.nombre, p.texto, op.valor)}
                                accessibilityRole="radio"
                                accessibilityState={{ selected: sel }}
                                style={{ flex: 1, minHeight: 46, borderRadius: t.radio.md, borderWidth: 1, borderColor: sel ? bg : t.colores.borderStrong, backgroundColor: bg, alignItems: "center", justifyContent: "center" }}
                              >
                                <Text weight="bold" style={{ color: fg }}>{op.texto}</Text>
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
          <View style={{ gap: t.espacio(1) }}>
            <Text variante="etiqueta" tono="muted" weight="semibold" style={{ textTransform: "uppercase" }}>
              Firma del responsable
            </Text>
            <LienzoFirma ref={lienzo} />
          </View>
        )}

        <View style={{ gap: t.espacio(2) }}>
          <Button
            titulo={fotos.length ? `Fotos adjuntas (${fotos.length})` : "Adjuntar foto general"}
            variante="secundario"
            icono={<Ionicons name="camera-outline" size={18} color={t.colores.brand} />}
            onPress={() => tomarFoto(null)}
          />
          {fotos.length > 0 && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: t.espacio(2.5) }}>
              {fotos.map((f, i) => (
                <View key={`${f.uri}-${i}`} style={{ width: 84, height: 84 }}>
                  <Image source={{ uri: f.uri }} style={{ width: 84, height: 84, borderRadius: t.radio.md, backgroundColor: t.colores.surfaceAlt }} />
                  <Pressable
                    onPress={() => quitarFoto(i)}
                    hitSlop={8}
                    style={{ position: "absolute", right: -6, top: -6, width: 24, height: 24, borderRadius: 12, backgroundColor: t.colores.danger, alignItems: "center", justifyContent: "center" }}
                  >
                    <Ionicons name="close" size={14} color={t.colores.brandForeground} />
                  </Pressable>
                  {f.item ? (
                    <View style={{ position: "absolute", bottom: 2, left: 2, right: 2, backgroundColor: t.colores.overlay, borderRadius: t.radio.sm, paddingHorizontal: 4, paddingVertical: 1 }}>
                      <Text numberOfLines={1} style={{ fontSize: 10, lineHeight: 13, color: t.colores.brandForeground }}>
                        {f.item}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ))}
            </View>
          )}
        </View>

        <Input etiqueta="Observaciones" value={observaciones} onChangeText={setObservaciones} multiline style={{ minHeight: 72 }} />

        {!enLinea && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: t.espacio(2), backgroundColor: t.colores.accentSoft, borderRadius: t.radio.md, padding: t.espacio(3) }}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: t.colores.accent }} />
            <Text variante="caption" style={{ color: t.colores.warning, flex: 1 }}>
              Sin conexión — el chequeo se guarda en el teléfono y se envía al recuperar señal.
            </Text>
          </View>
        )}
      </ScrollView>

      <View style={{ paddingHorizontal: t.espacio(4), paddingTop: t.espacio(2), paddingBottom: t.espacio(6), borderTopWidth: 1, borderTopColor: t.colores.border, backgroundColor: t.colores.surface, gap: t.espacio(2) }}>
        <Text variante="caption" tono="muted">{ayuda}</Text>
        <Button titulo="Guardar chequeo" tamano="lg" onPress={guardar} cargando={guardando} disabled={bloqueado} />
      </View>
    </View>
  );
}
