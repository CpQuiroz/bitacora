import type { Meta, StoryObj } from "@storybook/react-vite";
import { LoadingState } from "./LoadingState";
import { Skeleton } from "./Skeleton";

const meta = {
  title: "Primitivas/LoadingState",
  component: LoadingState,
  tags: ["autodocs"],
  decorators: [(Story) => <div className="max-w-sm">{Story()}</div>],
} satisfies Meta<typeof LoadingState>;

export default meta;
type Story = StoryObj<typeof meta>;

// Sin children: 3 líneas genéricas — el default para cuando no vale la
// pena calcar la forma exacta del contenido real.
export const Generico: Story = {};

// Con children: esqueletos a medida del contenido real (nunca un
// spinner centrado en pantalla completa, ver el comentario del
// componente).
export const FormaDeTabla: Story = {
  args: {
    children: (
      <>
        <Skeleton alto={44} radio={12} />
        <Skeleton alto={44} radio={12} />
        <Skeleton alto={44} radio={12} />
        <Skeleton alto={44} radio={12} />
      </>
    ),
  },
};
