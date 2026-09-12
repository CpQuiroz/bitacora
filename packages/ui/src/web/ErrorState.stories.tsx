import { WifiOff, ShieldAlert } from "lucide-react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { ErrorState } from "./ErrorState";

const meta = {
  title: "Primitivas/ErrorState",
  component: ErrorState,
  tags: ["autodocs"],
} satisfies Meta<typeof ErrorState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

// El texto lo decide quien llama (ver comentario de PropsErrorState en
// tipos.ts) — acá 2 ejemplos reales: red vs. permiso.
export const ErrorDeRed: Story = {
  args: {
    mensaje: "No hay conexión. Reintentá cuando tengas señal.",
    icono: <WifiOff size={28} strokeWidth={2.75} aria-hidden="true" />,
    onReintentar: () => {},
  },
};

export const ErrorDePermiso: Story = {
  args: {
    titulo: "Sin acceso",
    mensaje: "No tenés permiso para ver esta sección.",
    icono: <ShieldAlert size={28} strokeWidth={2.75} aria-hidden="true" />,
  },
};

export const SinBotonDeReintentar: Story = {
  args: { mensaje: "Este dato no se puede volver a pedir." },
};
