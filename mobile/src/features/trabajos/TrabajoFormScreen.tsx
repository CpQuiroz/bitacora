import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { Cliente, EstadoTrabajo, Usuario } from "@bitacora/shared";
import { useTema } from "../../theme";
import { Button, Input, LoadingScreen, PickerBuscable, Text } from "../../components/ui";
import { SelectorCliente } from "../../components/SelectorCliente";
import { useRed } from "../../services/sync/NetworkProvider";
import {
  type BorradorTrabajo,
  catalogoParaTrabajo,
  crearTrabajo,
  editarTrabajo,
  obtenerDetalle,
} from "../../services/trabajos";
import type { TrabajosStackParamList } from "../../shell/navigation/types";

const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function clave(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const ESTADOS: { valor: EstadoTrabajo; label: string }[] = [
  { valor: "completado", label: "Completado" },
  { valor: "en_curso", label: "En curso" },
  { valor: "cancelado", label: "Cancelado" },
];

const VACIO: BorradorTrabajo = {
  cliente_id: "",
  cliente: "",
  responsable_id: "",
  fecha: clave(new Date()),
  monto: "",
  ubicacion: "",
  codigo: "",
  estado: "completado",
};

export function TrabajoFormScreen({ navigation, route }: NativeStackScreenProps<TrabajosStackParamList, "TrabajoForm">) {
  const t = useTema();
  const { enLinea } = useRed();
  const editandoId = route.params?.trabajoId ?? null;
  const [clientes, setClientes] = useState<Cliente[] | null>(null);
  const [equipo, setEquipo] = useState<Usuario[]>([]);
  const [b, setB] = useState<BorradorTrabajo>(VACIO);
  const [guardando, setGuardando] = useState(false);
  const [cargando, setCargando] = useState(Boolean(editandoId));

  const set = <K extends keyof BorradorTrabajo>(k: K, v: BorradorTrabajo[K]) => setB((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    navigation.setOptions({ title: editandoId ? "Editar trabajo" : "Nuevo trabajo" });
  }, [navigation, editandoId]);

  useEffect(() => {
    catalogoParaTrabajo().then(({ clientes, equipo }) => {
      setClientes(clientes.filter((c) => c.activo));
      setEquipo(equipo);
    });
  }, []);

  useEffect(() => {
    if (!editandoId) return;
    obtenerDetalle(editandoId)
      .then(({ trabajo }) => {
        setB({
          cliente_id: trabajo.cliente_id ?? "",
          cliente: trabajo.cliente,
          responsable_id: trabajo.responsable_id ?? "",
          fecha: trabajo.fecha,
          monto: trabajo.monto != null ? String(Math.round(trabajo.monto)) : "",
          ubicacion: trabajo.ubicacion ?? "",
          codigo: trabajo.codigo ?? "",
          estado: trabajo.estado,
        });
      })
      .catch((e) => Alert.alert("No se pudo cargar el trabajo", e instanceof Error ? e.message : "Intenta de nuevo"))
      .finally(() => setCargando(false));
  }, [editandoId]);

  const dias = useMemo(() => {
    const hoy = new Date();
    const base = b.fecha < clave(hoy) ? new Date(b.fecha + "T00:00:00") : new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 7);
    return Array.from({ length: 60 }, (_, i) => new Date(base.getFullYear(), base.getMonth(), base.getDate() + i));
  }, [b.fecha]);

  function elegirClienteGuardado(id: string) {
    set("cliente_id", id);
    const c = clientes?.find((x) => x.id === id);
    if (c) {
      setB((p) => ({ ...p, cliente_id: id, cliente: c.nombre, ubicacion: c.direccion || p.ubicacion }));
    }
  }

  async function guardar() {
    if (!b.cliente.trim()) return Alert.alert("Falta el cliente", "Escribe el nombre del cliente.");
    if (!b.fecha) return Alert.alert("Falta la fecha", "Elige una fecha.");
    if (!enLinea) return Alert.alert("Sin conexión", "Necesitas conexión para guardar el trabajo.");

    setGuardando(true);
    const r = editandoId ? await editarTrabajo(editandoId, b) : await crearTrabajo(b);
    setGuardando(false);
    if (!r.ok) return Alert.alert("No se pudo guardar", r.error);
    Alert.alert(editandoId ? "Trabajo actualizado" : "Trabajo creado", "Listo.", [
      { text: "Listo", onPress: () => navigation.goBack() },
    ]);
  }

  if (clientes === null || cargando) return <LoadingScreen />;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.colores.bg }}
      contentContainerStyle={{ padding: t.espacio(5), gap: t.espacio(4), paddingBottom: t.espacio(12) }}
      keyboardShouldPersistTaps="handled"
    >
      <SelectorCliente
        etiqueta="Cliente guardado (opcional)"
        valor={b.cliente_id}
        onElegir={elegirClienteGuardado}
        clientes={clientes}
        onClienteCreado={(c) => {
          setClientes((prev) => [...(prev ?? []), c]);
          setB((p) => ({ ...p, cliente_id: c.id, cliente: c.nombre, ubicacion: c.direccion || p.ubicacion }));
        }}
      />

      <Input etiqueta="Cliente (nombre a mostrar / facturar)" value={b.cliente} onChangeText={(v) => set("cliente", v)} />

      {equipo.length > 0 ? (
        <PickerBuscable
          etiqueta="Responsable"
          placeholder="Elegir responsable"
          valor={b.responsable_id}
          opciones={equipo.map((u) => ({ id: u.id, label: u.nombre }))}
          onElegir={(id) => set("responsable_id", id)}
        />
      ) : null}

      <View style={{ gap: t.espacio(1.5) }}>
        <Text variante="etiqueta" tono="muted">
          Fecha
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: t.espacio(2) }}>
          {dias.map((d) => {
            const k = clave(d);
            const activo = k === b.fecha;
            return (
              <Pressable
                key={k}
                onPress={() => set("fecha", k)}
                style={{
                  minWidth: 56,
                  minHeight: 60,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: t.radio.md,
                  paddingHorizontal: t.espacio(2),
                  backgroundColor: activo ? t.colores.brand : t.colores.surface,
                  borderWidth: 1,
                  borderColor: activo ? t.colores.brand : t.colores.border,
                }}
              >
                <Text variante="caption" tono={activo ? "inverso" : "muted"}>
                  {DIAS[d.getDay()]}
                </Text>
                <Text variante="subtitulo" tono={activo ? "inverso" : "normal"}>
                  {d.getDate()}
                </Text>
                <Text variante="caption" tono={activo ? "inverso" : "muted"}>
                  {MESES[d.getMonth()]}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <Input etiqueta="Monto" keyboardType="numeric" value={b.monto} onChangeText={(v) => set("monto", v)} />
      <Input etiqueta="Código / n° guía" value={b.codigo} onChangeText={(v) => set("codigo", v)} />
      <Input etiqueta="Ubicación" value={b.ubicacion} onChangeText={(v) => set("ubicacion", v)} />

      <View style={{ gap: t.espacio(1.5) }}>
        <Text variante="etiqueta" tono="muted">
          Estado
        </Text>
        <View style={{ flexDirection: "row", gap: t.espacio(2) }}>
          {ESTADOS.map((e) => {
            const activo = e.valor === b.estado;
            return (
              <Pressable
                key={e.valor}
                onPress={() => set("estado", e.valor)}
                style={{
                  flex: 1,
                  minHeight: 44,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: t.radio.md,
                  backgroundColor: activo ? t.colores.brand : t.colores.surface,
                  borderWidth: 1,
                  borderColor: activo ? t.colores.brand : t.colores.border,
                }}
              >
                <Text variante="caption" weight="semibold" tono={activo ? "inverso" : "muted"}>
                  {e.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Button
        titulo={editandoId ? "Guardar cambios" : "Crear trabajo"}
        tamano="lg"
        onPress={guardar}
        cargando={guardando}
        style={{ marginTop: t.espacio(2) }}
      />
    </ScrollView>
  );
}
