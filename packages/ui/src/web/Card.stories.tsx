import type { Meta, StoryObj } from "@storybook/react-vite";
import { Card } from "./Card";

const meta = {
  title: "Primitivas/Card",
  component: Card,
  tags: ["autodocs"],
  args: {
    children: (
      <div className="flex flex-col gap-ds-1">
        <p className="ds-heading text-ds-h5 text-ds-text">Tracto Camión International 9200</p>
        <p className="text-ds-small text-ds-text/70">Patente CFHGJ · Itineris Spa</p>
      </div>
    ),
  },
  decorators: [(Story) => <div className="max-w-sm">{Story()}</div>],
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SinElevacion: Story = {};
export const ElevacionSm: Story = { args: { elevacion: "sm" } };
export const ElevacionMd: Story = { args: { elevacion: "md" } };
export const ElevacionLg: Story = { args: { elevacion: "lg" } };
export const SinRelleno: Story = {
  args: {
    sinRelleno: true,
    elevacion: "sm",
    children: (
      <table className="w-full text-left text-ds-body">
        <tbody>
          <tr className="border-b border-ds-divider">
            <td className="px-ds-4 py-ds-3">Ejemplo de tabla dentro de una Card sinRelleno</td>
          </tr>
        </tbody>
      </table>
    ),
  },
};
export const Clickeable: Story = { args: { elevacion: "sm", onPress: () => console.log("Card: onPress") } };
