import { useState } from "react";
import { Alert, ScrollView, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { Rubro } from "@bitacora/shared";
import { tokens } from "@bitacora/design-tokens";
import { Button, Input, Select, Texto } from "@bitacora/ui/native";
import { crearEmpresaSuperAdmin, type BorradorEmpresa } from "../../services/superadmin";
import type { SuperAdminStackParamList } from "./types";

const RUBROS: { valor: Rubro; etiqueta: string }[] = [
  { valor: "transporte", etiqueta: "Transporte" },
  { valor: "servicio_tecnico", etiqueta: "Servicio técnico / mantención" },
  { valor: "cosmetologia", etiqueta: "Cosmetología / belleza" },
  { valor: "otro", etiqueta: "Otro" },
];

const VACIO: BorradorEmpresa = {
  nombre: "",
  rubro: "transporte",
  rut: "",
  giro: "",
  telefono_empresa: "",
  direccion_calle: "",
  admin_nombre: "",
  admin_correo: "",
};

// Fase 1 del panel de Super-Admin en mobile — crear una empresa nueva
// (pedido 22-sep-2026), mismos campos y mismo endpoint que "Nueva
// empresa" en la web (POST /api/superadmin/empresas): manda la
// invitación por correo al admin inicial, no crea ninguna contraseña
// acá.
export function SuperAdminNuevaEmpresaScreen({ navigation }: NativeStackScreenProps<SuperAdminStackParamList, "NuevaEmpresa">) {
  const [b, setB] = useState<BorradorEmpresa>(VACIO);
  const set = <K extends keyof BorradorEmpresa>(k: K, v: BorradorEmpresa[K]) => setB((p) => ({ ...p, [k]: v }));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    setError(null);
    if (!b.nombre.trim()) return setError("Falta el nombre de la empresa");
    if (!b.admin_nombre.trim()) return setError("Falta el nombre del administrador inicial");
    if (!b.admin_correo.includes("@")) return setError("Correo del administrador inicial inválido");

    setGuardando(true);
    const r = await crearEmpresaSuperAdmin(b);
    setGuardando(false);
    if (!r.ok) return setError(r.error);
    Alert.alert("Empresa creada", `Se le mandó una invitación a ${b.admin_correo.trim()}.`, [
      { text: "Ok", onPress: () => navigation.replace("EmpresaDetalle", { id: r.id }) },
    ]);
  }

  return (
    <ScrollView contentContainerStyle={{ padding: tokens.space["4"], gap: tokens.space["4"], paddingBottom: tokens.space["8"] }}>
      <Texto tamano={tokens.size.h4} color={tokens.color.text}>
        Nueva empresa
      </Texto>

      <Input etiqueta="Nombre de la empresa" valor={b.nombre} onCambio={(v) => set("nombre", v)} autoFoco />
      <Select
        etiqueta="Rubro"
        valor={b.rubro}
        onCambio={(v) => set("rubro", v as Rubro)}
        opciones={RUBROS.map((r) => ({ valor: r.valor, etiqueta: r.etiqueta }))}
      />
      <Input etiqueta="RUT (opcional)" valor={b.rut} onCambio={(v) => set("rut", v)} />
      <Input etiqueta="Giro (opcional)" valor={b.giro} onCambio={(v) => set("giro", v)} />
      <Input etiqueta="Teléfono (opcional)" tipo="tel" valor={b.telefono_empresa} onCambio={(v) => set("telefono_empresa", v)} />
      <Input etiqueta="Dirección (opcional)" valor={b.direccion_calle} onCambio={(v) => set("direccion_calle", v)} />

      <View style={{ height: 1, backgroundColor: tokens.color.divider, marginVertical: tokens.space["1"] }} />

      <Texto tamano={tokens.size.small} peso="semibold" color={`${tokens.color.text}99`}>
        Administrador inicial — recibe la invitación por correo
      </Texto>
      <Input etiqueta="Nombre" valor={b.admin_nombre} onCambio={(v) => set("admin_nombre", v)} />
      <Input etiqueta="Correo" tipo="email" autoCapitalizar={false} valor={b.admin_correo} onCambio={(v) => set("admin_correo", v)} />

      {error ? (
        <Texto tamano={tokens.size.small} color={tokens.color.accentRamp["700"]}>
          {error}
        </Texto>
      ) : null}

      <Button tamano="lg" bloque onPress={guardar} cargando={guardando}>
        Crear empresa
      </Button>
    </ScrollView>
  );
}
