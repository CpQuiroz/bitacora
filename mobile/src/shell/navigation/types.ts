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

export type TabKey = "Trabajos" | "Ruta" | "Viajes" | "Perfil";
