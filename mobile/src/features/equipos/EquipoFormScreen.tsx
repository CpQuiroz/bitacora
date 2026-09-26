import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { X } from "lucide-react-native";
import { tokens } from "@bitacora/design-tokens";
import { Button, DatePicker, ErrorState, Input, LoadingState, ScreenHeader, Select, Textarea, useToast } from "@bitacora/ui/native";
import type { MasStackParamList } from "../../shell/navigation/types";
import { actualizarEquipo, obtenerEquipo, type EquipoDetalle } from "../../services/equipos";
import { aFecha, aIso } from "./fechas";

// Mismas categorías que la web (registros/equipos/page.tsx).
const CATEGORIAS = ["Vehículo", "Maquinaria", "Herramienta", "Otro"];

type Borrador = {
  nombre: string;
  categoria: string;
  marca: string;
  modelo: string;
  numero_serie: string;
  patente: string;
  tipo_vehiculo: string;
  capacidad_carga: string;
  anio: string;
  garantia_vencimiento: string | null;
  notas: string;
};

// Tarea 146: editar un equipo desde mobile (crear sigue en la web). El
// backend valida permisos (vehículo → Flota; otro equipo → Equipos).
export function EquipoFormScreen({ navigation, route }: NativeStackScreenProps<MasStackParamList, "EquipoForm">) {
  const { equipoId } = route.params;
  const toast = useToast();
  const [original, setOriginal] = useState<EquipoDetalle | null>(null);
  const [b, setB] = useState<Borrador | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    obtenerEquipo(equipoId).then(
      (e) => {
        setOriginal(e);
        setB({
          nombre: e.nombre,
          categoria: e.categoria ?? "",
          marca: e.marca ?? "",
          modelo: e.modelo ?? "",
          numero_serie: e.numero_serie ?? "",
          patente: e.patente ?? "",
          tipo_vehiculo: e.tipo_vehiculo ?? "",
          capacidad_carga: e.capacidad_carga ?? "",
          anio: e.anio != null ? String(e.anio) : "",
          garantia_vencimiento: e.garantia_vencimiento,
          notas: e.notas ?? "",
        });
      },
      (x: Error) => setError(x.message)
    );
  }, [equipoId]);

  const cerrar = { icono: <X size={20} strokeWidth={2.5} color={tokens.color.text} />, onPress: () => navigation.goBack(), etiquetaAccesible: "Cerrar" };

  if (!b || !original) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
        <ScreenHeader titulo="Editar equipo" accion={cerrar} />
        {error ? <ErrorState mensaje={error} /> : <LoadingState />}
      </View>
    );
  }

  const set = <K extends keyof Borrador>(k: K, v: Borrador[K]) => setB((prev) => (prev ? { ...prev, [k]: v } : prev));
  const esVehiculo = b.categoria === "Vehículo" || Boolean(b.patente.trim());

  async function guardar() {
    if (!b) return;
    if (!b.nombre.trim()) return toast("Falta el nombre: el equipo necesita un nombre.", { tono: "error" });
    const anio = b.anio.trim();
    if (anio && (!/^\d{4}$/.test(anio) || Number(anio) < 1950 || Number(anio) > new Date().getFullYear() + 1)) {
      return toast("Año inválido: escribe el año con 4 dígitos.", { tono: "error" });
    }
    setGuardando(true);
    const r = await actualizarEquipo(equipoId, {
      nombre: b.nombre.trim(),
      categoria: b.categoria || null,
      marca: b.marca.trim() || null,
      modelo: b.modelo.trim() || null,
      numero_serie: b.numero_serie.trim() || null,
      patente: b.patente.trim() || null,
      tipo_vehiculo: b.tipo_vehiculo.trim() || null,
      capacidad_carga: b.capacidad_carga.trim() || null,
      anio: anio ? Number(anio) : null,
      garantia_vencimiento: b.garantia_vencimiento,
      notas: b.notas.trim() || null,
    });
    setGuardando(false);
    if (!r.ok) return toast(`No se pudo guardar: ${r.error}`, { tono: "error" });
    navigation.goBack();
  }

  const categorias = CATEGORIAS.includes(b.categoria) || !b.categoria ? CATEGORIAS : [...CATEGORIAS, b.categoria];

  return (
    <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
      <ScreenHeader titulo="Editar equipo" accion={cerrar} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: tokens.space["4"], gap: tokens.space["3"], paddingBottom: tokens.space["8"] }} keyboardShouldPersistTaps="handled">
          <Input etiqueta="Nombre del equipo" valor={b.nombre} onCambio={(v) => set("nombre", v)} />
          <Select etiqueta="Categoría" valor={b.categoria} onCambio={(v) => set("categoria", v)} placeholder="Sin categoría" opciones={categorias.map((c) => ({ valor: c, etiqueta: c }))} />
          <Input etiqueta="Marca" valor={b.marca} onCambio={(v) => set("marca", v)} />
          <Input etiqueta="Modelo" valor={b.modelo} onCambio={(v) => set("modelo", v)} />
          <Input etiqueta="Año" tipo="numero" valor={b.anio} onCambio={(v) => set("anio", v.replace(/\D/g, "").slice(0, 4))} />
          {esVehiculo ? (
            <>
              <Input etiqueta="Patente" valor={b.patente} onCambio={(v) => set("patente", v.toUpperCase())} />
              <Input etiqueta="Tipo" placeholder="Ej: Camión 3/4, tolva" valor={b.tipo_vehiculo} onCambio={(v) => set("tipo_vehiculo", v)} />
              <Input etiqueta="Capacidad de carga" placeholder="Ej: 10 t" valor={b.capacidad_carga} onCambio={(v) => set("capacidad_carga", v)} />
            </>
          ) : null}
          <Input etiqueta="N° de serie" valor={b.numero_serie} onCambio={(v) => set("numero_serie", v)} />
          <DatePicker
            etiqueta="Vencimiento de garantía (opcional)"
            valor={aFecha(b.garantia_vencimiento)}
            onCambio={(f) => set("garantia_vencimiento", aIso(f))}
            placeholder="Sin garantía"
          />
          {b.garantia_vencimiento ? (
            <Button variante="ghost" onPress={() => set("garantia_vencimiento", null)}>
              Quitar fecha de garantía
            </Button>
          ) : null}
          <Textarea etiqueta="Notas" valor={b.notas} onCambio={(v) => set("notas", v)} filas={3} />
          <Button bloque cargando={guardando} onPress={() => void guardar()}>
            Guardar cambios
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
