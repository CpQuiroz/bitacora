import { useEffect, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Usuario } from "@bitacora/shared";
import { useTema } from "../theme";
import { Button, Input, PickerBuscable, Text } from "./ui";
import { invitarUsuario, listarRoles, type RolDisponible } from "../services/usuarios";

// Fallback estático — solo mientras carga listarRoles() o si falla. La
// verdad son las filas de `roles` (ver useRolesDisponibles en la web).
const ROLES_FALLBACK: RolDisponible[] = [
  { slug: "colaborador", nombre: "Colaborador / técnico" },
  { slug: "supervisor", nombre: "Supervisor" },
  { slug: "contador", nombre: "Contador" },
  { slug: "admin", nombre: "Admin" },
];

/**
 * Selector de responsable con búsqueda + "＋ Invitar" al pie — a diferencia
 * de SelectorCliente, invitar NO deja seleccionado al colaborador: crea su
 * cuenta pero no la activa hasta que acepte, así que todavía no se le puede
 * asignar una cita. Mismo criterio que ComboboxResponsable en la web.
 *
 * `permitirInvitar` gatea el botón de invitar según el módulo
 * gestion_control (lo mismo que exige el backend en POST /usuarios/invitar)
 * — sin él el selector queda de solo elegir, como antes.
 */
export function SelectorResponsable({
  etiqueta = "Atiende",
  valor,
  onElegir,
  equipo,
  opcionVacia,
  permitirInvitar,
}: {
  etiqueta?: string;
  valor: string;
  onElegir: (id: string) => void;
  equipo: Usuario[];
  opcionVacia?: string;
  permitirInvitar: boolean;
}) {
  const t = useTema();
  const [abierto, setAbierto] = useState(false);
  const [roles, setRoles] = useState<RolDisponible[]>(ROLES_FALLBACK);
  const [nombre, setNombre] = useState("");
  const [correo, setCorreo] = useState("");
  const [rol, setRol] = useState("colaborador");
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    if (!permitirInvitar) return;
    listarRoles().then((r) => {
      if (r.length > 0) setRoles(r);
    });
  }, [permitirInvitar]);

  function abrirInvitacion(texto: string) {
    setNombre(texto);
    setCorreo("");
    setRol("colaborador");
    setAviso(null);
    setAbierto(true);
  }

  async function invitar() {
    if (!nombre.trim() || !correo.trim()) {
      Alert.alert("Faltan datos", "Necesito el nombre y el correo del colaborador.");
      return;
    }
    setEnviando(true);
    const r = await invitarUsuario({ nombre, correo, rol });
    setEnviando(false);
    if (!r.ok) {
      Alert.alert("No se pudo invitar", r.error);
      return;
    }
    // A propósito: no se llama onElegir ni se agrega a "equipo" — no tiene
    // cuenta activa todavía.
    setAbierto(false);
    setAviso(`Invitación enviada a ${correo.trim()}. Podrás asignarlo cuando acepte.`);
  }

  return (
    <View style={{ gap: t.espacio(1.5) }}>
      <PickerBuscable
        etiqueta={etiqueta}
        placeholder="Elegir responsable"
        valor={valor}
        opcionVacia={opcionVacia}
        opciones={equipo.map((u) => ({ id: u.id, label: u.nombre }))}
        onElegir={onElegir}
        alCrear={permitirInvitar ? abrirInvitacion : undefined}
        etiquetaCrear="Invitar colaborador"
      />
      {aviso ? (
        <Text variante="caption" tono="success">
          {aviso}
        </Text>
      ) : null}

      <Modal visible={abierto} animationType="slide" onRequestClose={() => setAbierto(false)}>
        <View style={{ flex: 1, backgroundColor: t.colores.bg }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: t.espacio(3),
              paddingHorizontal: t.espacio(4),
              paddingTop: t.espacio(12),
              paddingBottom: t.espacio(3),
              borderBottomWidth: 1,
              borderBottomColor: t.colores.border,
            }}
          >
            <Pressable onPress={() => setAbierto(false)} hitSlop={12}>
              <Ionicons name="close" size={24} color={t.colores.foreground} />
            </Pressable>
            <Text variante="subtitulo" style={{ flex: 1 }}>
              Invitar colaborador
            </Text>
          </View>
          <ScrollView contentContainerStyle={{ padding: t.espacio(5), gap: t.espacio(4) }} keyboardShouldPersistTaps="handled">
            <Input etiqueta="Nombre" value={nombre} onChangeText={setNombre} autoFocus />
            <Input
              etiqueta="Correo"
              placeholder="correo@empresa.cl"
              keyboardType="email-address"
              autoCapitalize="none"
              value={correo}
              onChangeText={setCorreo}
            />
            <View style={{ gap: t.espacio(1.5) }}>
              <Text variante="etiqueta" tono="muted">
                Rol
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: t.espacio(2) }}>
                {roles.map((r) => {
                  const activo = r.slug === rol;
                  return (
                    <Pressable
                      key={r.slug}
                      onPress={() => setRol(r.slug)}
                      style={{
                        minHeight: 40,
                        justifyContent: "center",
                        paddingHorizontal: t.espacio(3),
                        borderRadius: t.radio.md,
                        backgroundColor: activo ? t.colores.brand : t.colores.surface,
                        borderWidth: 1,
                        borderColor: activo ? t.colores.brand : t.colores.border,
                      }}
                    >
                      <Text variante="caption" weight="semibold" tono={activo ? "inverso" : "muted"}>
                        {r.nombre}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <Text variante="caption" tono="muted">
              Le llega un correo para crear su contraseña. Vas a poder asignarle citas apenas acepte.
            </Text>
            <Button titulo="Invitar" tamano="lg" onPress={invitar} cargando={enviando} />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
