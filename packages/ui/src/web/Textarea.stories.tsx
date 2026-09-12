import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Textarea } from "./Textarea";

function Controlado(props: React.ComponentProps<typeof Textarea>) {
  const [valor, setValor] = useState(props.valor);
  return <Textarea {...props} valor={valor} onCambio={setValor} />;
}

const meta = {
  title: "Primitivas/Textarea",
  component: Textarea,
  tags: ["autodocs"],
  render: (args) => <Controlado {...args} />,
  args: {
    etiqueta: "Comentario",
    valor: "",
    onCambio: () => {},
    placeholder: "Detalle del incidente…",
  },
} satisfies Meta<typeof Textarea>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Basico: Story = {};
export const MasFilas: Story = { args: { filas: 8 } };
export const ConError: Story = { args: { valor: "", error: "Este campo es obligatorio." } };
export const Deshabilitado: Story = { args: { valor: "Registro cerrado, sin novedades.", deshabilitado: true } };
