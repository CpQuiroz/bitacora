import type { Meta, StoryObj } from "@storybook/react-vite";
import { StatusBadge } from "./StatusBadge";

const meta = {
  title: "Primitivas/StatusBadge",
  component: StatusBadge,
  tags: ["autodocs"],
  args: { estado: "en_curso" },
} satisfies Meta<typeof StatusBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

// Los 4 tonos vienen del ESTADO real, no de una prop — MAPA_ESTADO_TONO
// (../tipos.ts) es la fuente única. Estos son valores de dominio reales
// del proyecto (OS, viajes, ventas…), no inventados para la historia.
export const EnProgreso: Story = { args: { estado: "en_curso" } };
export const Completado: Story = { args: { estado: "firmada" } };
export const Cerrado: Story = { args: { estado: "dada_de_baja" } };
export const Cancelado: Story = { args: { estado: "rechazado" } };

export const EstadoNoMapeado: Story = {
  args: { estado: "pendiente" },
  // Sin tonoForzado, "pendiente" no está en el mapa (a propósito —
  // ambiguo, ver el comentario en tipos.ts) y cae en el fallback "cerrado".
};

export const ConTonoForzado: Story = {
  args: { estado: "pendiente", tonoForzado: "en_progreso" },
};

export const ConEtiquetaPropia: Story = {
  args: { estado: "en_curso", etiqueta: "En camino" },
};
