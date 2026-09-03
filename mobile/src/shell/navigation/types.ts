export type RootStackParamList = {
  Login: undefined;
  Verify2fa: { ticket: string; metodo: "totp" | "email" };
};

export type TrabajosStackParamList = {
  TrabajosLista: undefined;
  TrabajoDetalle: { trabajoId: string; titulo?: string };
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

export type GestionStackParamList = {
  GestionInicio: undefined;
  ClientesLista: undefined;
  ClienteForm: { clienteId?: string } | undefined;
  ClienteDetalle: { clienteId: string };
  CobrosLista: undefined;
  CobroForm: undefined;
  CobroDetalle: { cobroId: string };
};

export type TabKey = "Trabajos" | "Agenda" | "Ruta" | "Viajes" | "Gestion" | "Perfil";
