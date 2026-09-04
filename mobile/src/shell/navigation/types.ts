export type RootStackParamList = {
  Login: undefined;
  Verify2fa: { ticket: string; metodo: "totp" | "email" };
};

export type TrabajosStackParamList = {
  TrabajosLista: undefined;
  TrabajoDetalle: { trabajoId: string; titulo?: string };
  TrabajoForm: { trabajoId?: string } | undefined;
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
};

export type ClientesStackParamList = {
  ClientesLista: undefined;
  ClienteForm: { clienteId?: string } | undefined;
  ClienteDetalle: { clienteId: string };
};

export type GestionStackParamList = {
  GestionInicio: undefined;
  CobrosLista: undefined;
  CobroForm: undefined;
  CobroDetalle: { cobroId: string };
  GastoForm: undefined;
  Asistente: undefined;
};

export type TabKey = "Trabajos" | "Agenda" | "Ruta" | "Clientes" | "Viajes" | "Gestion" | "Perfil";
