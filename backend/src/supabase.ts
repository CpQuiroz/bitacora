import { crearClienteSupabase } from "@bitacora/shared";
import { env } from "./env";

// El backend usa la service role key: bypassa RLS porque el
// aislamiento por empresa lo aplica cada ruta explícitamente
// (empresa_id sacado del usuario autenticado en el request).
export const supabase = crearClienteSupabase(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);
