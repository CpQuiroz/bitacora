// Prueba de regresión (tarea 127): crear una OS desde la app.
// Servicios simulados (sin red ni base): se comprueba que el formulario
// cargue, valide y mande el borrador correcto.
import { Alert } from "react-native";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { TrabajoFormScreen } from "./TrabajoFormScreen";

const mockCrear = jest.fn();
const mockEncolar = jest.fn();
jest.mock("../../services/trabajos", () => ({
  catalogoParaTrabajo: jest.fn(async () => ({
    clientes: [{ id: "c1", nombre: "Cliente de Prueba SpA", direccion: "Alameda 100", activo: true }],
    equipo: [{ id: "u1", nombre: "Técnico QA", activo: true }],
  })),
  crearTrabajo: (b: unknown) => mockCrear(b),
  editarTrabajo: jest.fn(),
  encolarTrabajo: (b: unknown) => mockEncolar(b),
  obtenerDetalle: jest.fn(),
}));

async function abrir() {
  const navigation = { goBack: jest.fn(), setOptions: jest.fn() };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await render(<TrabajoFormScreen route={{ key: "k", name: "TrabajoForm", params: undefined } as any} navigation={navigation as any} />);
  return navigation;
}

describe("crear una OS (TrabajoFormScreen)", () => {
  beforeEach(() => {
    mockCrear.mockReset();
    mockEncolar.mockReset();
    jest.spyOn(Alert, "alert").mockImplementation(() => {});
  });

  test("sin cliente no envía y avisa", async () => {
    await abrir();
    await fireEvent.press(await screen.findByText("Crear trabajo"));
    expect(Alert.alert).toHaveBeenCalledWith("Falta el cliente", expect.any(String));
    expect(mockCrear).not.toHaveBeenCalled();
  });

  test("con cliente crea la OS y confirma", async () => {
    mockCrear.mockResolvedValue({ ok: true });
    await abrir();
    await fireEvent.changeText(await screen.findByLabelText("Cliente (nombre a mostrar / facturar)"), "Cliente Nuevo Ltda");
    await fireEvent.press(screen.getByText("Crear trabajo"));
    await screen.findByText("Crear trabajo");
    expect(mockCrear).toHaveBeenCalledWith(expect.objectContaining({ cliente: "Cliente Nuevo Ltda" }));
    expect(Alert.alert).toHaveBeenCalledWith("Trabajo creado", "Listo.", expect.any(Array));
  });

  test("si el servidor falla por conexión, lo guarda para reintentar", async () => {
    mockCrear.mockResolvedValue({ ok: false, reintentable: true, error: "timeout" });
    await abrir();
    await fireEvent.changeText(await screen.findByLabelText("Cliente (nombre a mostrar / facturar)"), "Cliente Nuevo Ltda");
    await fireEvent.press(screen.getByText("Crear trabajo"));
    await screen.findByText("Crear trabajo");
    expect(mockEncolar).toHaveBeenCalledWith(expect.objectContaining({ cliente: "Cliente Nuevo Ltda" }));
  });
});
