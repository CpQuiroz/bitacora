import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { Cliente, EstadoTrabajo, Usuario } from "@bitacora/shared";
import { tokens } from "@bitacora/design-tokens";
import { Button, Input, LoadingState, SelectorDias, Skeleton, Texto, useMarca, useToast } from "@bitacora/ui/native";
import { PickerBuscable } from "../../components/ui";
import { SelectorCliente } from "../../components/SelectorCliente";
import { InputMonto } from "../../components/InputMonto";
import { useRed } from "../../services/sync/NetworkProvider";
import {
  type BorradorTrabajo,
  catalogoParaTrabajo,
  crearTrabajo,
  editarTrabajo,
  encolarTrabajo,
  obtenerDetalle,
} from "../../services/trabajos";
import type { TrabajosStackParamList } from "../../shell/navigation/types";

function clave(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// El form escribe trabajos.estado; el backend sincroniza estado_os. Las
// etiquetas usan el vocabulario visible (EstadoOS).
const ESTADOS: { valor: EstadoTrabajo; label: string }[] = [
  { valor: "completado", label: "Completada" },
  { valor: "en_curso", label: "En proceso" },
  { valor: "cancelado", label: "Cancelada" },
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

// Sistema visual móvil v2 (14-sep-2026) — pantalla MODAL (`presentation:
// "modal"` en TrabajosStack.tsx): sin ScreenHeader propio, solo se
// recolorea el contenido (mismo criterio que CobroFormScreen.tsx). Se
// mantiene el header nativo con título dinámico vía `setOptions`, y
// SelectorCliente/PickerBuscable/InputMonto tal cual (sin equivalente v2).
export function TrabajoFormScreen({ navigation, route }: NativeStackScreenProps<TrabajosStackParamList, "TrabajoForm">) {
  const marca = useMarca();
  const toast = useToast();
  // Pantalla modal (presentation: "modal" en TrabajosStack.tsx) — no
  // vive dentro del pager de AppTabs.tsx, así que no hereda el fix de
  // paddingBottom de la tab bar (ver ese archivo, 20-sep-2026). Necesita
  // su propio insets.bottom para no quedar detrás de la barra de
  // gestos/navegación de Android.
  const insets = useSafeAreaInsets();
  const { enLinea } = useRed();
  const editandoId = route.params?.trabajoId ?? null;
  const [clientes, setClientes] = useState<Cliente[] | null>(null);
  const [equipo, setEquipo] = useState<Usuario[]>([]);
  const [b, setB] = useState<BorradorTrabajo>(VACIO);
  const [guardando, setGuardando] = useState(false);
  const [cargando, setCargando] = useState(Boolean(editandoId));

  const set = <K extends keyof BorradorTrabajo>(k: K, v: BorradorTrabajo[K]) => setB((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    navigation.setOptions({ title: editandoId ? "Editar orden de servicio" : "Nueva orden de servicio" });
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
      .catch((e) => toast(`No se pudo cargar el trabajo: ${e instanceof Error ? e.message : "intenta de nuevo"}`, { tono: "error" }))
      .finally(() => setCargando(false));
  }, [editandoId]);

  function elegirClienteGuardado(id: string) {
    set("cliente_id", id);
    const c = clientes?.find((x) => x.id === id);
    if (c) {
      setB((p) => ({ ...p, cliente_id: id, cliente: c.nombre, ubicacion: c.direccion || p.ubicacion }));
    }
  }

  async function guardar() {
    if (!b.cliente.trim()) return toast("Falta el cliente: escribe el nombre del cliente.", { tono: "error" });
    if (!b.fecha) return toast("Falta la fecha: elige una fecha.", { tono: "error" });

    const volver = () => navigation.goBack();
    setGuardando(true);

    if (editandoId) {
      if (!enLinea) {
        setGuardando(false);
        return toast("Sin conexión: necesitas conexión para editar un trabajo.", { tono: "error" });
      }
      const r = await editarTrabajo(editandoId, b);
      setGuardando(false);
      if (!r.ok) return toast(`No se pudo guardar: ${r.error}`, { tono: "error" });
      toast("Trabajo actualizado", { tono: "exito" });
      return volver();
    }

    if (enLinea) {
      const r = await crearTrabajo(b);
      if (r.ok) {
        setGuardando(false);
        toast("Trabajo creado", { tono: "exito" });
        return volver();
      }
      if (!r.reintentable) {
        setGuardando(false);
        return toast(`No se pudo crear: ${r.error}`, { tono: "error" });
      }
      await encolarTrabajo(b);
      setGuardando(false);
      toast("No se pudo enviar ahora (conexión o servidor). Lo guardamos y se reenvía cuando haya señal.", { tono: "info" });
      return volver();
    }

    await encolarTrabajo(b);
    setGuardando(false);
    toast("Guardado sin conexión. Se enviará cuando vuelvas a tener señal.", { tono: "info" });
    volver();
  }

  if (clientes === null || cargando) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.color.bg, padding: tokens.space["4"], gap: tokens.space["3"] }}>
        <LoadingState>
          <Skeleton alto={44} radio={999} />
          <Skeleton alto={44} radio={999} />
          <Skeleton alto={120} radio={16} />
        </LoadingState>
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

          <Input etiqueta="Cliente (nombre a mostrar / facturar)" valor={b.cliente} onCambio={(v) => set("cliente", v)} />

          {equipo.length > 0 ? (
            <PickerBuscable
              etiqueta="Responsable"
              placeholder="Elegir responsable"
              valor={b.responsable_id}
              opciones={equipo.map((u) => ({ id: u.id, label: u.nombre }))}
              onElegir={(id) => set("responsable_id", id)}
            />
          ) : null}

          <View style={{ gap: tokens.space["2"] }}>
            <Texto tamano={tokens.size.caption} color={tokens.color.textSecondary}>
              Fecha
            </Texto>
            <SelectorDias valor={b.fecha} onElegir={(k) => set("fecha", k)} cantidadDias={60} />
          </View>

          <InputMonto valor={b.monto} onChangeText={(v) => set("monto", v)} />
          <Input etiqueta="Código / n° guía" valor={b.codigo} onCambio={(v) => set("codigo", v)} />
          <Input etiqueta="Ubicación" valor={b.ubicacion} onCambio={(v) => set("ubicacion", v)} />

          <View style={{ gap: tokens.space["2"] }}>
            <Texto tamano={tokens.size.caption} color={tokens.color.textSecondary}>
              Estado
            </Texto>
            <View style={{ flexDirection: "row", gap: tokens.space["2"] }}>
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
                      borderRadius: tokens.radius.md,
                      backgroundColor: activo ? marca.suave : tokens.color.surface,
                      borderWidth: 1,
                      borderColor: activo ? marca.base : tokens.color.divider,
                    }}
                  >
                    <Texto tamano={tokens.size.caption} peso="semibold" color={activo ? marca.fuerte : tokens.color.textSecondary}>
                      {e.label}
                    </Texto>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <View
        style={{
          padding: tokens.space["4"],
          paddingBottom: tokens.space["6"],
          borderTopWidth: 1,
          borderTopColor: tokens.color.divider,
          backgroundColor: tokens.color.surface,
        }}
      >
        <Button tamano="lg" bloque onPress={guardar} cargando={guardando}>
          {editandoId ? "Guardar cambios" : "Crear trabajo"}
        </Button>
      </View>
    </View>
  );
}
