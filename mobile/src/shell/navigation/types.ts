import type { NavigatorScreenParams } from "@react-navigation/native";

export type RootStackParamList = {
  Login: undefined;
  Verify2fa: { ticket: string; metodo: "totp" | "email" };
};

// Una venta nace de una cita o de una OS (hereda cliente y servicio).
export type RegistrarVentaParams = {
  origenTipo: "cita" | "os";
  origenId: string;
  clienteId: string;
  clienteNombre: string;
  clienteRut?: string | null;
  folio?: number | null;
  heredado?: { referencia_id: string; nombre: string; precio: number } | null;
};

export type TrabajosStackParamList = {
  TrabajosLista: undefined;
  TrabajoDetalle: { trabajoId: string; titulo?: string };
  TrabajoForm: { trabajoId?: string } | undefined;
  RegistrarVenta: RegistrarVentaParams;
};

export type ViajesStackParamList = {
  ViajesLista: undefined;
  ViajeForm: { viajeId?: string } | undefined;
  ViajeDetalle: { viajeId: string };
};

export type AgendaStackParamList = {
  AgendaLista: undefined;
  TareaDetalle: { tareaId: string; titulo?: string };
  NuevaCita: { tareaId?: string; fecha?: string } | undefined;
  Asistente: undefined;
};

export type ClientesStackParamList = {
  ClientesLista: undefined;
  ClienteForm: { clienteId?: string } | undefined;
  ClienteDetalle: { clienteId: string };
  RegistrarVenta: RegistrarVentaParams;
  Asistente: undefined;
};

// "Más" absorbe la vieja pestaña Gestión (Cobros, Gasto, Informes,
// Asistente) + Perfil + las listas completas de Trabajos y Viajes. Las
// listas del día viven en "Hoy"; acá se entra al histórico.
export type MasStackParamList = {
  MasInicio: undefined;
  Catalogo: undefined;
  MantencionVehiculo: undefined;
  ChecklistMantencion: { equipoId: string; tipo: "diario" | "programa"; patente: string | null };
  MantencionHistorial: { equipoId: string; patente: string | null };
  MantencionDetalle: { equipoId: string; registroId: string };
  Levantamientos: undefined;
  LevantamientoDetalle: { id: string };
  CobrosLista: undefined;
  CobroForm: undefined;
  CobroDetalle: { cobroId: string };
  GastoForm: undefined;
  Informes: undefined;
  Asistente: undefined;
  Perfil: undefined;
  Trabajos: NavigatorScreenParams<TrabajosStackParamList> | undefined;
  Viajes: NavigatorScreenParams<ViajesStackParamList> | undefined;
};

// "Hoy": pantalla nueva con la lista cronológica del día (trabajos +
// citas + viajes) y un interruptor lista/mapa. Desde acá se entra al
// detalle de cada ítem a través de los stacks anidados.
export type HoyStackParamList = {
  HoyInicio: undefined;
  Asistente: undefined;
  Trabajos: NavigatorScreenParams<TrabajosStackParamList> | undefined;
  Agenda: NavigatorScreenParams<AgendaStackParamList> | undefined;
  Viajes: NavigatorScreenParams<ViajesStackParamList> | undefined;
  // Levantamientos (18-sep-2026): a diferencia de Trabajos/Agenda/Viajes
  // no es un sub-stack propio (en "Más" tampoco lo es, ver MasStack) —
  // es solo el detalle, plano, igual que ahí.
  LevantamientoDetalle: { id: string };
};

export type TabKey = "Hoy" | "Agenda" | "Clientes" | "Mas";
