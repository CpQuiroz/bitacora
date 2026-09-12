import { Inbox } from "lucide-react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { EmptyState } from "./EmptyState";
import { Button } from "./Button";

const meta = {
  title: "Primitivas/EmptyState",
  component: EmptyState,
  tags: ["autodocs"],
  args: {
    titulo: "Todavía no hay clientes",
    icono: <Inbox size={28} strokeWidth={2.75} aria-hidden="true" />,
  },
} satisfies Meta<typeof EmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SoloTitulo: Story = {};

export const ConMensaje: Story = {
  args: { mensaje: "Creá el primero para empezar a agendar visitas." },
};

export const ConAccion: Story = {
  args: {
    mensaje: "Creá el primero para empezar a agendar visitas.",
    accion: <Button onPress={() => {}}>Nuevo cliente</Button>,
  },
};
