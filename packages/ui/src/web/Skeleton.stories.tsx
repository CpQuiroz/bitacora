import type { Meta, StoryObj } from "@storybook/react-vite";
import { Skeleton } from "./Skeleton";

const meta = {
  title: "Primitivas/Skeleton",
  component: Skeleton,
  tags: ["autodocs"],
} satisfies Meta<typeof Skeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Linea: Story = { args: {} };
export const Circular: Story = { args: { ancho: 48, alto: 48, radio: 999 } };

export const FormaDeCard: Story = {
  render: () => (
    <div className="flex max-w-sm flex-col gap-ds-2">
      <Skeleton alto={56} radio={16} />
      <Skeleton ancho="60%" alto={14} />
      <Skeleton ancho="40%" alto={14} />
    </div>
  ),
};
