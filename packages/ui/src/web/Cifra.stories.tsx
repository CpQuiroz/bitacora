import type { Meta, StoryObj } from "@storybook/react-vite";
import { Cifra } from "./Cifra";

const meta = {
  title: "Primitivas/Cifra",
  component: Cifra,
  tags: ["autodocs"],
} satisfies Meta<typeof Cifra>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Monto: Story = { args: { children: "$1.250.000" } };
export const Folio: Story = { args: { children: "OS #142" } };

// tabular-nums: las columnas de dígitos alinean aunque cambien de
// ancho ("1" vs "8" ocupan lo mismo) — comparar con texto normal al
// lado.
export const AlineadoEnColumna: Story = {
  args: { children: null },
  render: () => (
    <div className="flex flex-col gap-ds-1 text-ds-body">
      <div className="flex justify-between gap-ds-4">
        <span>Servicio técnico</span>
        <Cifra>$18.500</Cifra>
      </div>
      <div className="flex justify-between gap-ds-4">
        <span>Repuesto</span>
        <Cifra>$134.990</Cifra>
      </div>
      <div className="flex justify-between gap-ds-4 border-t border-ds-divider pt-ds-1 font-semibold">
        <span>Total</span>
        <Cifra>$153.490</Cifra>
      </div>
    </div>
  ),
};
