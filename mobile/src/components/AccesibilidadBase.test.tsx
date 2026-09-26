// Accesibilidad base (tarea 155): las primitivas de @bitacora/ui/native
// traen rol y nombre para el lector de pantalla, y tope de letra grande.
import { render, screen } from "@testing-library/react-native";
import { Package } from "lucide-react-native";
import { ESCALA_FUENTE_MAX, ListRow, QuickAccessCard, Select, Textarea, Texto } from "@bitacora/ui/native";

jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

const nada = () => {};

test("fila y tarjeta de acceso rápido se anuncian como botones", async () => {
  await render(
    <>
      <ListRow icono={null} titulo="Mi vehículo" onPress={nada} />
      <QuickAccessCard titulo="Cobros" Icono={Package} badge={3} onPress={nada} />
    </>
  );
  expect(screen.getByRole("button", { name: "Mi vehículo" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Cobros, 3 pendientes" })).toBeTruthy();
});

test("Select anuncia su etiqueta y el valor elegido; Textarea se ubica por etiqueta", async () => {
  await render(
    <>
      <Select etiqueta="Estado" valor="a" onCambio={nada} opciones={[{ valor: "a", etiqueta: "Activo" }]} />
      <Textarea etiqueta="Observaciones" valor="" onCambio={nada} />
    </>
  );
  const select = screen.getByRole("button", { name: "Estado" });
  expect(select.props.accessibilityValue).toEqual({ text: "Activo" });
  expect(screen.getByLabelText("Observaciones")).toBeTruthy();
});

test("el texto respeta la letra grande del teléfono hasta el tope", async () => {
  await render(<Texto tamano={14} color="black">Hola</Texto>);
  expect(screen.getByText("Hola").props.maxFontSizeMultiplier).toBe(ESCALA_FUENTE_MAX);
});
