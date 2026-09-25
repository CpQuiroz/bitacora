import type { NavigatorScreenParams } from "@react-navigation/native";

// Tarea 144: lo único navegable con la prueba vencida.
export type PruebaVencidaStackParamList = {
  PruebaVencida: undefined;
  MiPlan: undefined;
  Perfil: undefined;
};

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
  // Levantamientos con fecha_visita asignada (migración 111,
  // 20-sep-2026) — mismo criterio que HoyStackParamList/MasStackParamList:
  // no es un sub-stack propio, es solo el detalle, plano.
  LevantamientoDetalle: { id: string };
  // OS en el calendario (23-sep-2026): detalle vía el stack de Trabajos
  // anidado — mismo patrón que HoyStackParamList.
  Trabajos: NavigatorScreenParams<TrabajosStackParamList> | undefined;
  // Viajes asignados en el calendario (tarea 133), mismo patrón.
  Viajes: NavigatorScreenParams<ViajesStackParamList> | undefined;
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
  // Eventos semanales de flota (migración 128, 23-sep-2026).
  EventosFlota: { equipoId: string; patente: string | null };
  // Equipos (tarea 146): lista, ficha y formularios (editar, documento, plan).
  Equipos: undefined;
  EquipoDetalle: { equipoId: string };
  EquipoForm: { equipoId: string };
  DocumentoForm: { equipoId: string; documentoId?: string };
  PlanMantencionForm: { equipoId: string; planId?: string };
  Levantamientos: undefined;
  LevantamientoDetalle: { id: string };
  // Fase 5.3 — historial de levantamientos/OS terminados del colaborador.
  MisTrabajos: undefined;
  // "Mi plan" (23-sep-2026) — solo lectura, solo Admin (gestionar_plan).
  MiPlan: undefined;
  CobrosLista: undefined;
  CobroForm: undefined;
  CobroDetalle: { cobroId: string };
  // GastoForm con rendicionId: mismo formulario, foto obligatoria y el
  // gasto queda asociado a esa rendición (Más → Rendiciones). Con
  // gastoId en vez de crear edita uno ya existente (tocando una fila en
  // RendicionDetalleScreen) — soloLectura lo abre en modo ver-nomás
  // cuando la rendición ya no está en borrador o el usuario no puede
  // editarla (22-sep-2026).
  GastoForm: { rendicionId?: string; gastoId?: string; soloLectura?: boolean } | undefined;
  RendicionesLista: undefined;
  RendicionForm: undefined;
  RendicionDetalle: { id: string };
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
