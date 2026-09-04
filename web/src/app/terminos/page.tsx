import Link from "next/link";
import { DOCUMENTOS_LEGALES_VERSION } from "@bitacora/shared";

export const metadata = { title: "Términos de Servicio · Bitácora" };

// ⚠️ BORRADOR — estructura. El texto legal lo debe redactar un abogado
// antes del 1-dic-2026. Ver docs/AUDITORIA_LEY21719.md.

function Marca({ children }: { children: React.ReactNode }) {
  return <span className="rounded bg-warning-soft px-1 text-warning">[PENDIENTE: abogado] {children}</span>;
}

export default function TerminosPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 text-sm leading-relaxed text-foreground">
      <div className="mb-8 rounded-lg border border-warning/40 bg-warning-soft p-4 text-warning">
        <strong>Borrador — pendiente de revisión legal.</strong>
      </div>

      <h1 className="mb-1 text-2xl font-bold">Términos de Servicio</h1>
      <p className="mb-8 text-muted">Versión {DOCUMENTOS_LEGALES_VERSION}</p>

      {[
        ["1. Objeto del servicio", "Descripción de qué es Bitácora y qué se contrata."],
        ["2. Cuenta y responsabilidades del cliente", "Uso adecuado, credenciales, actividad de los usuarios que la empresa invita."],
        ["3. Planes, prueba y pago", "Período de prueba, planes, facturación, mora, suspensión."],
        ["4. Datos del cliente y de sus clientes finales", "La empresa es responsable de los datos que carga; Bitácora actúa como encargado. Referencia a la Política de Privacidad."],
        ["5. Disponibilidad y soporte", "Sin garantía de disponibilidad ininterrumpida; canales de soporte."],
        ["6. Propiedad intelectual", "La plataforma es de Bitácora; los datos cargados son del cliente."],
        ["7. Limitación de responsabilidad", "Alcance y límites."],
        ["8. Término del servicio", "Causales, efectos, plazo de conservación y eliminación de datos tras la baja."],
        ["9. Modificaciones", "Cómo se notifican los cambios a estos Términos y a la Política de Privacidad."],
        ["10. Ley aplicable y jurisdicción", "Chile."],
      ].map(([titulo, desc]) => (
        <section key={titulo} className="mb-6">
          <h2 className="mb-2 text-lg font-semibold">{titulo}</h2>
          <p><Marca>{desc}</Marca></p>
        </section>
      ))}

      <p className="mt-10 text-muted">
        <Link href="/privacidad" className="text-brand hover:underline">Política de Privacidad</Link>
        {" · "}
        <Link href="/" className="text-brand hover:underline">Inicio</Link>
      </p>
    </main>
  );
}
