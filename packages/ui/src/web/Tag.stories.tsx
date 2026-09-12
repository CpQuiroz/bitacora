import type { Meta, StoryObj } from "@storybook/react-vite";
import { Tag } from "./Tag";

const meta = {
  title: "Primitivas/Tag",
  component: Tag,
  tags: ["autodocs"],
  argTypes: {
    tono: { control: "select", options: ["accent", "accent2", "neutral", "outline"] },
  },
  args: { children: "Prioridad alta" },
} satisfies Meta<typeof Tag>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Neutral: Story = { args: { tono: "neutral" } };
export const Accent: Story = { args: { tono: "accent" } };
export const Accent2: Story = { args: { tono: "accent2" } };
export const Outline: Story = { args: { tono: "outline" } };

export const Todos: Story = {
  render: () => (
    <div className="flex gap-ds-2">
      <Tag tono="accent">Rol: admin</Tag>
      <Tag tono="accent2">Canal: WhatsApp</Tag>
      <Tag tono="neutral">Prioridad: media</Tag>
      <Tag tono="outline">Sin asignar</Tag>
    </div>
  ),
};
