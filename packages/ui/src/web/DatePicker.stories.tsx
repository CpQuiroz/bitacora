import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { DatePicker } from "./DatePicker";

function Controlado(props: React.ComponentProps<typeof DatePicker>) {
  const [valor, setValor] = useState(props.valor);
  return <DatePicker {...props} valor={valor} onCambio={setValor} />;
}

const meta = {
  title: "Primitivas/DatePicker",
  component: DatePicker,
  tags: ["autodocs"],
  render: (args) => <Controlado {...args} />,
  args: {
    etiqueta: "Fecha del servicio",
    valor: null,
    onCambio: () => {},
  },
} satisfies Meta<typeof DatePicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Basico: Story = {};
export const ConValor: Story = { args: { valor: new Date(2026, 8, 12) } };
export const ConRango: Story = {
  args: { valor: null, minimo: new Date(2026, 8, 1), maximo: new Date(2026, 8, 30) },
};
export const ConError: Story = { args: { valor: null, error: "Elegí una fecha." } };
