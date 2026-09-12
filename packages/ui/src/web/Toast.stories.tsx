import type { Meta, StoryObj } from "@storybook/react-vite";
import { useToast } from "./Toast";
import { Button } from "./Button";

// ToastProvider ya envuelve TODAS las historias (ver
// .storybook/preview.tsx) — así que useToast() funciona acá sin volver
// a poner el provider. Es el mismo criterio que sigue cualquier
// pantalla real de la app (el provider vive arriba, una sola vez).
function Demo() {
  const mostrar = useToast();
  return (
    <div className="flex gap-ds-2">
      <Button onPress={() => mostrar("Cambios guardados")}>Guardar</Button>
      <Button variante="secundario" onPress={() => mostrar("No se pudo conectar — reintentá")}>
        Simular error
      </Button>
    </div>
  );
}

const meta = {
  title: "Primitivas/Toast",
  tags: ["autodocs"],
  render: () => <Demo />,
} satisfies Meta<typeof Demo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Interactivo: Story = {};
