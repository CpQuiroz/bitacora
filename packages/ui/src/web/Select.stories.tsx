import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Select } from "./Select";

const OPCIONES = [
  { valor: "transporte", etiqueta: "Transporte" },
  { valor: "servicio_tecnico", etiqueta: "Servicio técnico" },
  { valor: "cosmetologia", etiqueta: "Cosmetología" },
  { valor: "otro", etiqueta: "Otro" },
];

function Controlado(props: React.ComponentProps<typeof Select>) {
  const [valor, setValor] = useState(props.valor);
  return <Select {...props} valor={valor} onCambio={setValor} />;
}

const meta = {
  title: "Primitivas/Select",
  component: Select,
  tags: ["autodocs"],
  render: (args) => <Controlado {...args} />,
  args: {
    etiqueta: "Rubro",
    valor: null,
    onCambio: () => {},
    opciones: OPCIONES,
    placeholder: "Elegí un rubro",
  },
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Basico: Story = {};
export const ConValorElegido: Story = { args: { valor: "transporte" } };
export const ConError: Story = { args: { valor: null, error: "Elegí un rubro para continuar." } };
export const Deshabilitado: Story = { args: { valor: "cosmetologia", deshabilitado: true } };
