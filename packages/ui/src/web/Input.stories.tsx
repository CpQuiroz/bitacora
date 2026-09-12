import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Input } from "./Input";

function Controlado(props: React.ComponentProps<typeof Input>) {
  const [valor, setValor] = useState(props.valor);
  return <Input {...props} valor={valor} onCambio={setValor} />;
}

const meta = {
  title: "Primitivas/Input",
  component: Input,
  tags: ["autodocs"],
  render: (args) => <Controlado {...args} />,
  args: {
    etiqueta: "Correo",
    valor: "",
    onCambio: () => {},
    placeholder: "nombre@empresa.cl",
  },
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Basico: Story = {};
export const ConAyuda: Story = { args: { ayuda: "Lo usamos para el acceso al portal del cliente." } };
export const ConError: Story = { args: { valor: "no-es-un-correo", error: "Ingresá un correo válido." } };
export const Deshabilitado: Story = { args: { valor: "prueba@bitacora.app", deshabilitado: true } };

export const TipoCodigo: Story = {
  args: { etiqueta: "Código de verificación", tipo: "codigo", maxLongitud: 6, placeholder: "000000" },
};

export const TipoPassword: Story = { args: { etiqueta: "Contraseña", tipo: "password", valor: "" } };
