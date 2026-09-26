// Prueba de regresión (tarea 127): crear una OS desde la app.
// Servicios simulados (sin red ni base): se comprueba que el formulario
// cargue, valide y mande el borrador correcto.
import { fireEvent, render, screen } from "@testing-library/react-native";
import { TrabajoFormScreen } from "./TrabajoFormScreen";

const mockToast = jest.fn();
jest.mock("@bitacora/ui/native", () => ({ ...jest.requireActual("@bitacora/ui/native"), useToast: () => mockToast }));

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
    mockToast.mockReset();
  });

  test("sin cliente no envía y avisa", async () => {
    await abrir();
    await fireEvent.press(await screen.findByText("Crear trabajo"));
    expect(mockToast).toHaveBeenCalledWith(expect.stringMatching(/^Falta el cliente/), { tono: "error" });
    expect(mockCrear).not.toHaveBeenCalled();
  });

  test("con cliente crea la OS, avisa con toast y vuelve", async () => {
    mockCrear.mockResolvedValue({ ok: true });
    const nav = await abrir();
    await fireEvent.changeText(await screen.findByLabelText("Cliente (nombre a mostrar / facturar)"), "Cliente Nuevo Ltda");
    await fireEvent.press(screen.getByText("Crear trabajo"));
    await screen.findByText("Crear trabajo");
    expect(mockCrear).toHaveBeenCalledWith(expect.objectContaining({ cliente: "Cliente Nuevo Ltda" }));
    expect(mockToast).toHaveBeenCalledWith("Trabajo creado", { tono: "exito" });
    expect(nav.goBack).toHaveBeenCalled();
  });

  test("si el servidor falla por conexión, lo guarda para reintentar", async () => {
    mockCrear.mockResolvedValue({ ok: false, reintentable: true, error: "timeout" });
    await abrir();
    await fireEvent.changeText(await screen.findByLabelText("Cliente (nombre a mostrar / facturar)"), "Cliente Nuevo Ltda");
    await fireEvent.press(screen.getByText("Crear trabajo"));
    await screen.findByText("Crear trabajo");
    expect(mockEncolar).toHaveBeenCalledWith(expect.objectContaining({ cliente: "Cliente Nuevo Ltda" }));
    expect(mockToast).toHaveBeenCalledWith(expect.stringContaining("se reenvía cuando haya señal"), { tono: "info" });
  });
});
