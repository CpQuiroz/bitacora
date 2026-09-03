import Link from "next/link";
import { DOCUMENTOS_LEGALES_VERSION } from "@bitacora/shared";

export const metadata = { title: "Política de Privacidad · Bitácora" };

// ⚠️ BORRADOR — estructura + datos fácticos que salen del código.
// El texto legal marcado [PENDIENTE: abogado] debe redactarlo un
// abogado antes del 1-dic-2026 (Ley 21.719). Ver docs/AUDITORIA_LEY21719.md.

function Marca({ children }: { children: React.ReactNode }) {
  return <span className="rounded bg-amber-100 px-1 text-amber-900">[PENDIENTE: abogado] {children}</span>;
}

export default function PrivacidadPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 text-sm leading-relaxed text-foreground">
      <div className="mb-8 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-900">
        <strong>Borrador — pendiente de revisión legal.</strong> Este documento tiene la
        estructura y los datos técnicos correctos, pero el texto legal definitivo lo
        debe redactar un abogado.
      </div>

      <h1 className="mb-1 text-2xl font-bold">Política de Privacidad</h1>
      <p className="mb-8 text-muted">Versión {DOCUMENTOS_LEGALES_VERSION}</p>

      <section className="mb-6">
        <h2 className="mb-2 text-lg font-semibold">1. Quién trata tus datos</h2>
        <p><Marca>Identificación del responsable (razón social, RUT, domicilio, correo de contacto de privacidad).</Marca></p>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-lg font-semibold">2. Qué datos tratamos y con qué finalidad</h2>
        <ul className="ml-5 list-disc space-y-1">
          <li><strong>Usuarios de la plataforma</strong> (personas de la empresa cliente): nombre, RUT, correo, teléfono, foto de perfil, zona, función, historial de accesos (IP y navegador). Finalidad: prestar el servicio, seguridad de la cuenta.</li>
          <li><strong>Datos laborales</strong> (módulo Remuneraciones): sistema de salud (Fonasa/Isapre), remuneración pactada, AFP, cargas familiares, tipo de contrato. <Marca>Base legal y tratamiento reforzado por tratarse de datos sensibles.</Marca></li>
          <li><strong>Clientes de la empresa</strong> (terceros): nombre, RUT, dirección, contacto, fecha de nacimiento (para saludo de cumpleaños). Finalidad: gestión de servicios, agenda, cobros y avisos que configura la empresa.</li>
          <li><strong>Fotos y documentos</strong> subidos en terreno (pueden contener imágenes de personas, vehículos, patentes).</li>
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-lg font-semibold">3. Base de licitud</h2>
        <p><Marca>Contrato (servicio a la empresa), relación laboral, interés legítimo y/o consentimiento según cada tratamiento.</Marca></p>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-lg font-semibold">4. Con quién compartimos datos (encargados de tratamiento)</h2>
        <p className="mb-2">Usamos proveedores que procesan datos por nuestra cuenta:</p>
        <ul className="ml-5 list-disc space-y-1">
          <li><strong>Supabase</strong> — base de datos, autenticación y almacenamiento de archivos.</li>
          <li><strong>Vercel</strong> y <strong>Render</strong> — alojamiento de la aplicación (registros de acceso, direcciones IP).</li>
          <li><strong>Anthropic</strong> — funciones de inteligencia artificial (Informe y Asistente): reciben datos de trabajos y de contacto de clientes incluidos en las consultas.</li>
          <li><strong>Resend</strong> — envío de correos (correo y nombre de los destinatarios).</li>
          <li><strong>Meta Platforms (WhatsApp Business)</strong> — envío de avisos por WhatsApp (número de teléfono y contenido del mensaje).</li>
          <li><strong>Flow</strong> — procesamiento de pagos, si la empresa lo activa.</li>
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-lg font-semibold">5. Transferencia internacional</h2>
        <p>
          Nuestra infraestructura y varios de los proveedores anteriores están ubicados
          <strong> fuera de Chile</strong> (principalmente Estados Unidos). Esto implica
          que tus datos se transfieren y procesan en el extranjero.{" "}
          <Marca>Mecanismo de resguardo de la transferencia (cláusulas contractuales, país con nivel adecuado, o consentimiento informado).</Marca>
        </p>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-lg font-semibold">6. Cuánto tiempo conservamos los datos</h2>
        <p>
          Los registros de acceso se conservan hasta 12 meses; los códigos y enlaces
          temporales, hasta 30 días. El resto de los datos se conserva mientras exista la
          relación con la empresa cliente.{" "}
          <Marca>Plazos legales mínimos que compiten (obligaciones laborales y tributarias) y política de eliminación tras la baja de una empresa.</Marca>
        </p>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-lg font-semibold">7. Tus derechos</h2>
        <p className="mb-2">
          Puedes ejercer los derechos de acceso, rectificación, cancelación (supresión) y
          oposición:
        </p>
        <ul className="ml-5 list-disc space-y-1">
          <li><strong>Acceso / portabilidad:</strong> descarga todos tus datos desde Configuración → Cuenta (usuarios) o desde el Portal de Cliente (clientes).</li>
          <li><strong>Rectificación:</strong> edita tu perfil directamente; para datos laborales o de un cliente, solicítalo a la empresa.</li>
          <li><strong>Cancelación:</strong> escribe a <Marca>correo de privacidad</Marca>. Anonimizamos tus datos manteniendo solo lo que exige la ley.</li>
          <li><strong>Oposición a avisos:</strong> usa el enlace &ldquo;darse de baja&rdquo; al pie de cada correo.</li>
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-lg font-semibold">8. Reclamos</h2>
        <p><Marca>Referencia a la Agencia de Protección de Datos Personales (APDP) como vía de reclamo.</Marca></p>
      </section>

      <p className="mt-10 text-muted">
        <Link href="/terminos" className="text-brand hover:underline">Términos de Servicio</Link>
        {" · "}
        <Link href="/" className="text-brand hover:underline">Inicio</Link>
      </p>
    </main>
  );
}
