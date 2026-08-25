import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// ------------------------------------------------------------
// Cliente de Supabase compartido por backend, web y mobile.
// - En backend: pasar la service role key (bypassa RLS).
// - En web/mobile: pasar la anon key (RLS decide qué se ve,
//   según auth.uid() del usuario logueado).
// ------------------------------------------------------------
export function crearClienteSupabase(
  url: string,
  key: string
): SupabaseClient<Database> {
  if (!url || !key) {
    throw new Error(
      "crearClienteSupabase: faltan SUPABASE_URL o la key (anon/service role)"
    );
  }
  return createClient<Database>(url, key);
}

export type { SupabaseClient };
