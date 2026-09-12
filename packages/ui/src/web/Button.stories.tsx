import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "./Button";

const meta = {
  title: "Primitivas/Button",
  component: Button,
  tags: ["autodocs"],
  argTypes: {
    variante: { control: "select", options: ["primario", "secundario", "ghost", "peligro"] },
    tamano: { control: "select", options: ["sm", "md", "lg"] },
  },
  args: {
    children: "Guardar",
    onPress: () => {},
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primario: Story = { args: { variante: "primario" } };
export const Secundario: Story = { args: { variante: "secundario" } };
export const Ghost: Story = { args: { variante: "ghost" } };
export const Peligro: Story = { args: { variante: "peligro", children: "Eliminar" } };

export const Tamanos: Story = {
  render: (args) => (
    <div className="flex items-center gap-ds-3">
      <Button {...args} tamano="sm">
        Chico
      </Button>
      <Button {...args} tamano="md">
        Mediano
      </Button>
      <Button {...args} tamano="lg">
        Grande
      </Button>
    </div>
  ),
};

export const Cargando: Story = { args: { cargando: true } };
export const Deshabilitado: Story = { args: { deshabilitado: true } };

export const Bloque: Story = {
  args: { bloque: true },
  decorators: [(Story) => <div className="max-w-sm">{Story()}</div>],
};
