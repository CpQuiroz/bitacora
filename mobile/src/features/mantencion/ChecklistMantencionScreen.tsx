import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Pressable, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { File } from "expo-file-system";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { Proveedor, RespuestaChecklistMantencion } from "@bitacora/shared";
import { useTema } from "../../theme";
import { Button, Card, Input, LoadingScreen, PickerBuscable, Text } from "../../components/ui";
import { LienzoFirma, type LienzoFirmaHandle } from "../../components/LienzoFirma";
import { useRed } from "../../services/sync/NetworkProvider";
import { comprimirImagen } from "../../lib/imagen";
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
const MAX_FOTOS = 3;
const clave = (s: string, i: string) => `${s}||${i}`;

export function ChecklistMantencionScreen({ route, navigation }: NativeStackScreenProps<MasStackParamList, "ChecklistMantencion">) {
  const t = useTema();
  const { enLinea } = useRed();
  const { equipoId, tipo, patente } = route.params;

  const [plantilla, setPlantilla] = useState<PlantillaMantencion | null>(null);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [respuestas, setRespuestas] = useState<Record<string, RespuestaChecklistMantencion>>({});
  const [km, setKm] = useState("");
  const [horas, setHoras] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [proveedorId, setProveedorId] = useState("");
  const [fotos, setFotos] = useState<string[]>([]); // uris comprimidas
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

  async function agregarFoto() {
    if (fotos.length >= MAX_FOTOS) return Alert.alert("Máximo de fotos", `Puedes adjuntar hasta ${MAX_FOTOS}.`);
    const permiso = await ImagePicker.requestCameraPermissionsAsync();
    if (!permiso.granted) return Alert.alert("Permiso necesario", "Necesitamos la cámara para la foto.");
    const r = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (r.canceled) return;
    const a = r.assets[0];
    const uri = await comprimirImagen(a.uri, a.width);
    setFotos((prev) => [...prev, uri]);
  }

  async function guardar() {
    if (!plantilla) return;
    const checklist = plantilla.secciones.flatMap((sec) =>
      sec.preguntas
        .map((p) => {
          const resp = respuestas[clave(sec.nombre, p.texto)];
          return resp ? { seccion: sec.nombre, item: p.texto, respuesta: resp } : null;
        })
        .filter((x): x is { seccion: string; item: string; respuesta: RespuestaChecklistMantencion } => x !== null)
    );
    if (checklist.length === 0) return Alert.alert("Falta el checklist", "Responde al menos un ítem.");
    if (tipo === "programa" && !proveedorId) return Alert.alert("Falta el taller", "Elige el taller o lubricentro.");

    setGuardando(true);

    let firma_base64: string | null = null;
    if (tipo === "programa" && lienzo.current && !lienzo.current.vacio()) {
      firma_base64 = await lienzo.current.capturar();
    }

    let fotos_base64: string[] = [];
    try {
      fotos_base64 = await Promise.all(fotos.map((uri) => new File(uri).base64()));
    } catch {
      fotos_base64 = [];
    }

    const borrador: BorradorMantencion = {
      equipoId,
      tipo,
      checklist,
      kilometraje: km,
      horas_motor: horas,
      observaciones,
      proveedor_id: tipo === "programa" ? proveedorId : undefined,
      firma_base64,
      fotos_base64,
    };

    const volver = () =>
      navigation.navigate("MantencionVehiculo");

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
      "El registro quedó en la cola y se envía a la oficina cuando haya señal.",
      [{ text: "Listo", onPress: volver }]
    );
  }

  if (!plantilla) return <LoadingScreen />;

  return (
    <View style={{ flex: 1, backgroundColor: t.colores.bg }}>
      <ScrollView contentContainerStyle={{ padding: t.espacio(4), gap: t.espacio(3), paddingBottom: t.espacio(8) }} keyboardShouldPersistTaps="handled">
        <Card plano>
          <Text variante="caption" tono="muted">
            {tipo === "diario" ? "Chequeo diario" : "Programa de mantención"} · {patente ?? "vehículo asignado"}
          </Text>
        </Card>

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

        <Text variante="etiqueta" tono="muted" weight="semibold" style={{ textTransform: "uppercase" }}>
          Checklist · {respondidos}/{totalItems}
        </Text>

        {plantilla.secciones.map((sec, idx) => {
          const open = abierta === idx;
          const enSeccion = sec.preguntas.filter((p) => respuestas[clave(sec.nombre, p.texto)]).length;
          const conNov = sec.preguntas.some((p) => respuestas[clave(sec.nombre, p.texto)] === "no");
          return (
            <View key={sec.nombre} style={{ borderWidth: 1, borderColor: t.colores.border, borderRadius: t.radio.md, overflow: "hidden", backgroundColor: t.colores.surface }}>
              <Pressable
                onPress={() => setAbierta(open ? -1 : idx)}
                style={{ flexDirection: "row", alignItems: "center", gap: t.espacio(2.5), padding: t.espacio(3), minHeight: 48 }}
              >
                <View style={{ width: 22, height: 22, borderRadius: t.radio.sm, backgroundColor: t.colores.brand, alignItems: "center", justifyContent: "center" }}>
                  <Text mono variante="caption" weight="bold" tono="inverso">{idx + 1}</Text>
                </View>
                <Text weight="semibold" style={{ flex: 1 }}>{sec.nombre}</Text>
                <View style={{ paddingHorizontal: t.espacio(2), paddingVertical: 2, borderRadius: 999, backgroundColor: conNov ? t.colores.dangerSoft : enSeccion === sec.preguntas.length ? t.colores.successSoft : t.colores.surfaceAlt }}>
                  <Text variante="caption" weight="bold" style={{ color: conNov ? t.colores.danger : enSeccion === sec.preguntas.length ? t.colores.success : t.colores.muted }}>
                    {enSeccion}/{sec.preguntas.length}
                  </Text>
                </View>
                <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color={t.colores.faint} />
              </Pressable>

              {open && (
                <View style={{ paddingHorizontal: t.espacio(3), paddingBottom: t.espacio(2) }}>
                  {sec.preguntas.map((p) => {
                    const actual = respuestas[clave(sec.nombre, p.texto)];
                    return (
                      <View key={p.texto} style={{ paddingVertical: t.espacio(2.5), borderTopWidth: 1, borderTopColor: t.colores.border }}>
                        <Text variante="cuerpo" style={{ marginBottom: t.espacio(2) }}>{p.texto}</Text>
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
            titulo={fotos.length ? `Foto agregada (${fotos.length}/${MAX_FOTOS})` : "Adjuntar foto"}
            variante="secundario"
            icono={<Ionicons name="camera-outline" size={18} color={t.colores.brand} />}
            onPress={agregarFoto}
          />
          {fotos.length > 0 && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: t.espacio(2) }}>
              {fotos.map((uri, i) => (
                <Pressable
                  key={uri}
                  onPress={() => setFotos((prev) => prev.filter((_, j) => j !== i))}
                  style={{ paddingHorizontal: t.espacio(2), paddingVertical: t.espacio(1), borderRadius: t.radio.sm, backgroundColor: t.colores.surfaceAlt, flexDirection: "row", alignItems: "center", gap: 4 }}
                >
                  <Text variante="caption" tono="muted">Foto {i + 1}</Text>
                  <Ionicons name="close" size={14} color={t.colores.muted} />
                </Pressable>
              ))}
            </View>
          )}
        </View>

        <Input etiqueta="Observaciones" value={observaciones} onChangeText={setObservaciones} multiline style={{ minHeight: 72 }} />

        {!enLinea && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: t.espacio(2), backgroundColor: t.colores.accentSoft, borderRadius: t.radio.md, padding: t.espacio(3) }}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: t.colores.accent }} />
            <Text variante="caption" style={{ color: t.colores.warning, flex: 1 }}>
              Sin conexión — se guarda en la cola y se envía al recuperar señal.
            </Text>
          </View>
        )}
      </ScrollView>

      <View style={{ padding: t.espacio(4), paddingBottom: t.espacio(6), borderTopWidth: 1, borderTopColor: t.colores.border, backgroundColor: t.colores.surface }}>
        <Button titulo="Guardar registro" tamano="lg" onPress={guardar} cargando={guardando} />
      </View>
    </View>
  );
}
