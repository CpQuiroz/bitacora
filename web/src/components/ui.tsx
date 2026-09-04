import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

/* ─────────────────────────────────────────────────────────────
   ui.tsx — dirección "Faena" (refresco 1a)
   Mismos exports y firmas que la versión anterior (nada se rompe
   en las ~30 páginas que lo usan). Cambios:
   · foco: anillo de 3px del color de marca, sin offset (esquina corta)
   · botones: alto fijo por tamaño, hover con color propio en vez de opacity
   · Badge: 60+ estados mapeados a 5 tonos, no a 5 pares de clases repetidos
   · nuevos: Cifra, Stat, SectionTitle
   ───────────────────────────────────────────────────────────── */

const focusRing =
  "focus:outline-none focus-visible:ring-[3px] focus-visible:ring-brand/25 focus-visible:border-brand";

const base =
  "inline-flex items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-45 disabled:pointer-events-none";

const variants = {
  primary: "bg-brand text-brand-foreground hover:bg-brand/90",
  outline: "border border-border bg-surface text-foreground hover:bg-surface-sunken hover:border-muted-soft",
  ghost: "text-muted hover:bg-brand-soft hover:text-brand",
  danger: "bg-danger text-white hover:bg-danger/90",
  // Acción de terreno (iniciar/continuar trabajo): naranja señal.
  accent: "bg-accent text-white hover:bg-accent/90",
};

const sizes = {
  sm: "h-8 px-3 text-[13px]",
  md: "h-10 px-4",
  lg: "h-12 px-5 text-[15px]",
};

// Exportado para poder darle el mismo look a un <Link> (no se puede
// anidar un <Link> dentro de un <button>).
export function buttonClass(
  variant: keyof typeof variants = "primary",
  className = "",
  size: keyof typeof sizes = "md"
) {
  return `${base} ${variants[variant]} ${sizes[size]} ${focusRing} ${className}`;
}

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
}) {
  return <button className={buttonClass(variant, className, size)} {...props} />;
}

const field =
  "w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-muted-soft transition-colors hover:border-muted-soft";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`${field} ${focusRing} ${props.className ?? ""}`}
    />
  );
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`${field} ${focusRing} ${props.className ?? ""}`}
    />
  );
}

// El chevron nativo del <select> varía por navegador/SO — se oculta con
// appearance-none y se dibuja el mismo IconChevronDown que usa Combobox,
// así todos los selectores de la app se ven igual (ver Combobox.tsx).
export function Select({ className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className={`relative ${className}`}>
      <select
        {...props}
        className={`${field} cursor-pointer appearance-none pr-9 ${focusRing}`}
      />
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
        aria-hidden="true"
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </div>
  );
}

export function Label({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <label className={`mb-1.5 block text-[13px] font-semibold text-foreground ${className}`}>
      {children}
    </label>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-border bg-surface p-5 ${className}`}>
      {children}
    </div>
  );
}

// Encabezado de sección dentro de una Card o de un formulario: mono en
// mayúsculas, el mismo recurso que usan los grupos del sidebar.
export function SectionTitle({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <p className={`font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted ${className}`}>
      {children}
    </p>
  );
}

// Cifras, montos, folios, RUT y fechas — mono con números tabulares para
// que las columnas de las tablas queden alineadas.
export function Cifra({ children, className = "", ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span data-cifra className={`font-mono ${className}`} {...props}>
      {children}
    </span>
  );
}

// Tarjeta de métrica del Dashboard. `destacada` la pinta en azul marca
// (una sola por fila, para el dato de "ahora": hoy en terreno).
export function Stat({
  etiqueta,
  valor,
  nota,
  tono = "neutro",
  destacada = false,
}: {
  etiqueta: string;
  valor: ReactNode;
  nota?: ReactNode;
  tono?: "neutro" | "exito" | "alerta" | "riesgo";
  destacada?: boolean;
}) {
  const notaClase = destacada
    ? "text-accent"
    : { neutro: "text-muted", exito: "text-success", alerta: "text-warning", riesgo: "text-danger" }[tono];
  return (
    <div
      className={`rounded-2xl border p-4 ${
        destacada ? "border-brand bg-brand text-brand-foreground" : "border-border bg-surface"
      }`}
    >
      <p className={`font-mono text-[10px] font-semibold uppercase tracking-[0.1em] ${destacada ? "text-brand-foreground/70" : "text-muted"}`}>
        {etiqueta}
      </p>
      <p className={`mt-2 font-mono text-[28px] font-semibold tracking-tight ${destacada ? "" : "text-foreground"}`}>
        {valor}
      </p>
      {nota && <p className={`mt-1.5 text-xs font-semibold ${notaClase}`}>{nota}</p>}
    </div>
  );
}

function Aviso({ tono, children }: { tono: "danger" | "success" | "warning"; children: ReactNode }) {
  const clase = {
    danger: "bg-danger-soft text-danger",
    success: "bg-success-soft text-success",
    warning: "bg-warning-soft text-warning",
  }[tono];
  return (
    <p className={`rounded-lg border-l-[3px] border-current px-3 py-2 text-sm font-medium ${clase}`}>
      {children}
    </p>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  return <Aviso tono="danger">{children}</Aviso>;
}

export function SuccessText({ children }: { children: ReactNode }) {
  return <Aviso tono="success">{children}</Aviso>;
}

export function WarningText({ children }: { children: ReactNode }) {
  return <Aviso tono="warning">{children}</Aviso>;
}

/* Badge — antes cada estado repetía su par de clases. Ahora cada estado
   declara solo su TONO, y el tono define el color. Agregar un estado
   nuevo es una línea, y ningún estado puede quedar con un color que no
   pertenece al sistema. */
type Tono = "brand" | "exito" | "alerta" | "riesgo" | "neutro";

const TONO_CLASS: Record<Tono, string> = {
  brand: "bg-brand-soft text-brand",
  exito: "bg-success-soft text-success",
  alerta: "bg-warning-soft text-warning",
  riesgo: "bg-danger-soft text-danger",
  neutro: "bg-surface-sunken text-muted",
};

const TONO_DE_ESTADO: Record<string, Tono> = {
  // trabajos
  completado: "exito", en_curso: "brand", cancelado: "riesgo",
  // facturas
  pagada: "exito", pendiente: "alerta", vencida: "riesgo",
  // usuarios
  admin: "brand", supervisor: "neutro", contador: "alerta", colaborador: "exito",
  // prioridad de tareas
  alta: "riesgo", media: "alerta", baja: "exito",
  // estado de la orden de servicio
  enviada: "brand", en_proceso: "alerta", completada: "exito", firmada: "exito",
  // gastos
  pagado: "exito", vencido: "riesgo",
  // documentos (flota)
  vigente: "exito", por_vencer: "alerta",
  // cotizaciones (presupuestos)
  borrador: "neutro", enviado: "brand", aprobado: "exito", rechazado: "riesgo", expirado: "alerta",
  // viajes
  confirmado: "exito", facturado: "brand",
  // agenda (estado derivado, no es una columna propia)
  agendado: "brand", en_progreso: "alerta",
  // activo/inactivo (checklists, tipos de OS, etc.)
  activo: "exito", inactivo: "neutro",
  // estado de empresa (Panel de Super-Admin)
  activa: "exito", suspendida: "alerta", dada_de_baja: "riesgo",
  // inventario: estado de stock
  en_stock: "exito", stock_bajo: "alerta", sin_stock: "riesgo",
  // inventario: tipo de movimiento
  entrada: "exito", salida: "riesgo", ajuste: "alerta",
  // notificaciones al cliente: éxito/fallo de un envío
  exito: "exito", fallido: "riesgo",
  // paquetes de sesiones (Agenda Pro)
  disponible: "exito", agotado: "riesgo",
  no_asistio: "riesgo", cancelada_anticipada: "neutro",
  // notificaciones al cliente: canal de envío
  correo: "brand", whatsapp: "exito",
  // suscripción B2B (Flow) — estado de facturación
  trial: "brand", pago_pendiente: "alerta", suspendida_por_pago: "riesgo", exitoso: "exito",
};

export function Badge({ value }: { value: string }) {
  const tono = TONO_DE_ESTADO[value] ?? "brand";
  return (
    <span
      className={`inline-block rounded-sm px-2 py-0.5 text-[11px] font-semibold capitalize ${TONO_CLASS[tono]}`}
    >
      {value.replaceAll("_", " ")}
    </span>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        {subtitle && <p className="mt-1 text-[13px] text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

// Estado mostrado cuando el backend responde 403 — por ejemplo alguien
// entra a una URL directamente a una sección que su rol no puede ver.
export function SinAutorizacion({ mensaje }: { mensaje?: string }) {
  return (
    <Card className="mx-auto max-w-md text-center">
      <h2 className="text-lg font-semibold text-foreground">Sin autorización</h2>
      <p className="mt-2 text-sm text-muted">
        {mensaje ?? "No tienes permiso para acceder a esta sección. Si crees que es un error, contacta a un administrador."}
      </p>
    </Card>
  );
}
