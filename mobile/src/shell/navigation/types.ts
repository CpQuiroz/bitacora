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
  ViajeForm: undefined;
};

export type AgendaStackParamList = {
  AgendaLista: undefined;
  TareaDetalle: { tareaId: string; titulo?: string };
};

export type TabKey = "Trabajos" | "Agenda" | "Ruta" | "Viajes" | "Perfil";
