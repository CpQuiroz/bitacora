import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Dialog } from "./Dialog";
import { Button } from "./Button";

function Demo() {
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      <Button onPress={() => setAbierto(true)}>Abrir diálogo</Button>
      <Dialog abierto={abierto} onCerrar={() => setAbierto(false)} titulo="Eliminar cliente">
        <p className="text-ds-body text-ds-text">
          Esta acción no se puede deshacer. ¿Confirmás que querés eliminar a &ldquo;Transportes Itineris&rdquo;?
        </p>
        <div className="mt-ds-4 flex justify-end gap-ds-2">
          <Button variante="secundario" onPress={() => setAbierto(false)}>
            Cancelar
          </Button>
          <Button variante="peligro" onPress={() => setAbierto(false)}>
            Eliminar
          </Button>
        </div>
      </Dialog>
    </>
  );
}

const meta = {
  title: "Primitivas/Dialog",
  component: Dialog,
  tags: ["autodocs"],
  // Web: modal centrado. Mobile: SIEMPRE bottom sheet (mismo contrato,
  // sin variante "centrada" — ver comentario en tipos.ts). Esta
  // historia solo cubre la implementación web.
  args: { abierto: false, onCerrar: () => {}, titulo: "", children: null },
} satisfies Meta<typeof Dialog>;

export default meta;
type Story = StoryObj<typeof meta>;

// Única historia: un Dialog con abierto=true de forma fija rompería el
// layout de la página de autodocs (todas las historias se componen en
// una sola página; un overlay fixed inset-0 taparía las de más abajo).
export const Interactivo: Story = { render: () => <Demo /> };
