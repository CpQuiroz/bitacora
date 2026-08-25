import { crearClienteSupabase } from "@bitacora/shared";

// Cliente del navegador: usa la anon key, RLS decide qué ve
// cada usuario según su sesión.
export const supabase = crearClienteSupabase(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
