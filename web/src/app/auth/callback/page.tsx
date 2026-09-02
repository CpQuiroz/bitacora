"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { resolverDestinoPostLogin } from "@/lib/accesoPostLogin";
import { AuthLayout } from "@/components/AuthLayout";
import { ErrorText } from "@/components/ui";

// Destino de redirectTo del signInWithOAuth de Google
// (web/src/app/login/page.tsx). supabase-js procesa el código/hash de
// la URL solo. Una vez que hay sesión, sigue el mismo camino que el
// login por contraseña: resolverDestinoPostLogin() consulta /api/me,
// que aprovisiona al usuario si su correo/dominio está autorizado
// (migración 72), o niega el acceso si no lo está.
export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;

    async function continuar() {
      const { data } = await supabase.auth.getSession();
      if (cancelado) return;
      if (!data.session) {
        setError("No se pudo completar el inicio de sesión con Google. Intenta de nuevo.");
        return;
      }
      const r = await resolverDestinoPostLogin();
      if (cancelado) return;
      if ("error" in r) {
        setError(r.error);
        return;
      }
      router.replace(r.destino);
    }

    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") continuar();
    });

    // Si la sesión ya estaba lista al montar (la URL ya se procesó
    // antes de que este efecto corriera), no dependemos solo del evento.
    continuar();

    return () => {
      cancelado = true;
      listener.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AuthLayout title="Iniciando sesión…" subtitle={error ? undefined : "Un momento, estamos confirmando tu cuenta de Google"}>
      {error ? (
        <div className="flex flex-col gap-4">
          <ErrorText>{error}</ErrorText>
          <button type="button" onClick={() => router.replace("/login")} className="text-sm font-medium text-brand hover:underline">
            Volver al inicio de sesión
          </button>
        </div>
      ) : (
        <div className="flex justify-center py-4">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand border-t-transparent" />
        </div>
      )}
    </AuthLayout>
  );
}
