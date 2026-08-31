"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { AuthLayout } from "@/components/AuthLayout";
import { ErrorText } from "@/components/ui";
import { IconStar } from "@/components/icons";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

function EncuestaContenido() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();

  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [valorAutomatico] = useState(() => {
    const v = Number(searchParams.get("valor"));
    return v >= 1 && v <= 5 ? v : null;
  });

  async function calificar(valor: number) {
    setError(null);
    setEnviando(true);
    const res = await fetch(`${API_URL}/api/encuesta/${params.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ valor }),
    });
    setEnviando(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "No se pudo enviar tu calificación");
      return;
    }
    setEnviado(true);
  }

  useEffect(() => {
    if (valorAutomatico) calificar(valorAutomatico);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valorAutomatico]);

  if (enviado) {
    return (
      <AuthLayout title="¡Gracias por tu respuesta!" subtitle="Tu calificación quedó registrada.">
        <div />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="¿Cómo fue tu servicio?" subtitle="Califica del 1 (malo) al 5 (excelente)">
      <div className="flex justify-center gap-2">
        {[1, 2, 3, 4, 5].map((v) => (
          <button
            key={v}
            type="button"
            disabled={enviando}
            onClick={() => calificar(v)}
            className="flex h-12 w-12 items-center justify-center rounded-full border border-border text-muted transition-colors hover:border-brand hover:bg-brand-soft hover:text-brand disabled:opacity-50"
            aria-label={`Calificar ${v} de 5`}
          >
            <IconStar className="h-5 w-5" />
          </button>
        ))}
      </div>
      {error && (
        <div className="mt-4">
          <ErrorText>{error}</ErrorText>
        </div>
      )}
    </AuthLayout>
  );
}

// useSearchParams() necesita un boundary de Suspense para el build de
// producción (si no, Next aborta con "missing-suspense-with-csr-bailout").
export default function EncuestaPage() {
  return (
    <Suspense fallback={null}>
      <EncuestaContenido />
    </Suspense>
  );
}
