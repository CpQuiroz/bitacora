import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

const focusRing =
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const base =
  "inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none";

const variants = {
  primary: "bg-brand text-brand-foreground hover:opacity-90",
  outline: "border border-border bg-surface text-foreground hover:bg-brand-soft",
  ghost: "text-foreground hover:bg-brand-soft",
  danger: "bg-danger text-white hover:opacity-90",
};

// Exportado para poder darle el mismo look a un <Link> (no se puede
// anidar un <Link> dentro de un <button>).
export function buttonClass(
  variant: keyof typeof variants = "primary",
  className = ""
) {
  return `${base} ${variants[variant]} ${focusRing} px-4 py-2.5 ${className}`;
}

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
}) {
  return <button className={buttonClass(variant, className)} {...props} />;
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted ${focusRing} ${props.className ?? ""}`}
    />
  );
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted ${focusRing} ${props.className ?? ""}`}
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
        className={`w-full cursor-pointer appearance-none rounded-lg border border-border bg-surface px-3.5 py-2.5 pr-9 text-sm text-foreground ${focusRing}`}
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
    <label className={`mb-1.5 block text-sm font-medium text-foreground ${className}`}>
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
    <div
      className={`rounded-2xl border border-border bg-surface p-6 shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
      {children}
    </p>
  );
}

export function SuccessText({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg bg-success-soft px-3 py-2 text-sm text-success">
      {children}
    </p>
  );
}

export function WarningText({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning">
      {children}
    </p>
  );
}

const badgeStyles: Record<string, string> = {
  // trabajos
  completado: "bg-success-soft text-success",
  en_curso: "bg-brand-soft text-brand",
  cancelado: "bg-danger-soft text-danger",
  // facturas
  pagada: "bg-success-soft text-success",
  pendiente: "bg-warning-soft text-warning",
  vencida: "bg-danger-soft text-danger",
  // usuarios
  admin: "bg-brand-soft text-brand",
  supervisor: "bg-border text-foreground",
  contador: "bg-warning-soft text-warning",
  colaborador: "bg-success-soft text-success",
  // prioridad de tareas
  alta: "bg-danger-soft text-danger",
  media: "bg-warning-soft text-warning",
  baja: "bg-success-soft text-success",
  // estado de la orden de servicio
  enviada: "bg-brand-soft text-brand",
  en_proceso: "bg-warning-soft text-warning",
  completada: "bg-success-soft text-success",
  firmada: "bg-success-soft text-success",
  // gastos
  pagado: "bg-success-soft text-success",
  vencido: "bg-danger-soft text-danger",
  // documentos (flota)
  vigente: "bg-success-soft text-success",
  por_vencer: "bg-warning-soft text-warning",
  // cotizaciones (presupuestos)
  borrador: "bg-border text-muted",
  enviado: "bg-brand-soft text-brand",
  aprobado: "bg-success-soft text-success",
  rechazado: "bg-danger-soft text-danger",
  expirado: "bg-warning-soft text-warning",
  // viajes
  confirmado: "bg-success-soft text-success",
  facturado: "bg-brand-soft text-brand",
  // agenda (estado derivado, no es una columna propia)
  agendado: "bg-brand-soft text-brand",
  en_progreso: "bg-warning-soft text-warning",
  // activo/inactivo (checklists, tipos de OS, etc.)
  activo: "bg-success-soft text-success",
  inactivo: "bg-border text-muted",
  // estado de empresa (Panel de Super-Admin)
  activa: "bg-success-soft text-success",
  suspendida: "bg-warning-soft text-warning",
  dada_de_baja: "bg-danger-soft text-danger",
  // inventario: estado de stock
  en_stock: "bg-success-soft text-success",
  stock_bajo: "bg-warning-soft text-warning",
  sin_stock: "bg-danger-soft text-danger",
  // inventario: tipo de movimiento
  entrada: "bg-success-soft text-success",
  salida: "bg-danger-soft text-danger",
  ajuste: "bg-warning-soft text-warning",
  // notificaciones al cliente: éxito/fallo de un envío
  exito: "bg-success-soft text-success",
  fallido: "bg-danger-soft text-danger",
  // paquetes de sesiones (Agenda Pro): saldo restante
  disponible: "bg-success-soft text-success",
  agotado: "bg-danger-soft text-danger",
  // paquetes de sesiones (Agenda Pro): asistencia de una cita con paquete
  no_asistio: "bg-danger-soft text-danger",
  cancelada_anticipada: "bg-border text-muted",
  // notificaciones al cliente: canal de envío
  correo: "bg-brand-soft text-brand",
  whatsapp: "bg-success-soft text-success",
  // suscripción B2B (Flow) — estado de facturación
  trial: "bg-brand-soft text-brand",
  pago_pendiente: "bg-warning-soft text-warning",
  suspendida_por_pago: "bg-danger-soft text-danger",
  exitoso: "bg-success-soft text-success",
};

export function Badge({ value }: { value: string }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium capitalize ${
        badgeStyles[value] ?? "bg-brand-soft text-brand"
      }`}
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
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

// Estado mostrado cuando el backend responde 403 — por ejemplo alguien
// entra a una URL directamente a una sección que su rol no puede ver.
// Un solo componente reutilizable en vez de una pantalla en blanco por página.
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
