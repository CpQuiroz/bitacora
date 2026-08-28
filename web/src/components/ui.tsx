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

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground ${focusRing} ${props.className ?? ""}`}
    />
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
  contador: "bg-warning-soft text-warning",
  chofer: "bg-success-soft text-success",
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
  // cotizaciones (presupuestos)
  borrador: "bg-border text-muted",
  enviado: "bg-brand-soft text-brand",
  aprobado: "bg-success-soft text-success",
  rechazado: "bg-danger-soft text-danger",
  expirado: "bg-warning-soft text-warning",
  // agenda (estado derivado, no es una columna propia)
  agendado: "bg-brand-soft text-brand",
  en_progreso: "bg-warning-soft text-warning",
  // activo/inactivo (checklists, tipos de OS, etc.)
  activo: "bg-success-soft text-success",
  inactivo: "bg-border text-muted",
  // inventario: estado de stock
  en_stock: "bg-success-soft text-success",
  stock_bajo: "bg-warning-soft text-warning",
  sin_stock: "bg-danger-soft text-danger",
  // inventario: tipo de movimiento
  entrada: "bg-success-soft text-success",
  salida: "bg-danger-soft text-danger",
  ajuste: "bg-warning-soft text-warning",
};

export function Badge({ value }: { value: string }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium capitalize ${
        badgeStyles[value] ?? "bg-brand-soft text-brand"
      }`}
    >
      {value.replace("_", " ")}
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
