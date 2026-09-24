// Prueba de regresión (tarea 127): la Agenda abre y muestra los viajes
// del chofer (tarea 133). Solo prueba, no cambia la pantalla (congelada).
// Servicios simulados (sin red ni base).
import { render, screen } from "@testing-library/react-native";
import { AgendaScreen } from "./AgendaScreen";

const hoy = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
})();

let mockViajesApagado = false;
const mockListarViajes = jest.fn();
jest.mock("../auth/AuthContext", () => ({
  useAuth: () => ({
    fase: "listo",
    usuario: { id: "u1", rol: "colaborador", nombre: "Chofer QA", funcion: "chofer" },
    acciones: [],
    modulosVisibles: ["agenda", "viajes"],
    modulosDeshabilitados: mockViajesApagado ? ["viajes"] : [],
  }),
}));
jest.mock("@react-navigation/native", () => {
  const react = jest.requireActual<typeof import("react")>("react");
  return { useFocusEffect: (efecto: () => void) => react.useEffect(efecto, [efecto]) };
});
jest.mock("../../services/agenda", () => ({
  listarTareasRango: jest.fn(async () => ({ tareas: [], desdeCache: false })),
  listarOSRango: jest.fn(async () => []),
}));
jest.mock("../../services/levantamientos", () => ({ listarMisLevantamientos: jest.fn(async () => []) }));
jest.mock("../../services/viajes", () => ({ listarViajesRango: (...a: unknown[]) => mockListarViajes(...a) }));

async function abrir() {
  const navigation = { navigate: jest.fn(), setOptions: jest.fn(), goBack: jest.fn() };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await render(<AgendaScreen route={{ key: "k", name: "Agenda", params: undefined } as any} navigation={navigation as any} />);
}

describe("Agenda (AgendaScreen)", () => {
  beforeEach(() => {
    mockListarViajes.mockReset();
    mockListarViajes.mockResolvedValue([
      { id: "v1", fecha: hoy, hora: "08:30:00", numero_guia: "G-100", origen: "Santiago", destino: "Rancagua", estado: "confirmado", chofer_id: "u1", cliente: "Cliente de Prueba SpA" },
    ]);
  });

  test("abre y muestra el viaje del chofer de hoy", async () => {
    mockViajesApagado = false;
    await abrir();
    expect(await screen.findByText("Santiago → Rancagua")).toBeTruthy();
    expect(mockListarViajes).toHaveBeenCalled();
  });

  test("con el módulo Viajes apagado no pide viajes y no se cae", async () => {
    mockViajesApagado = true;
    await abrir();
    expect(await screen.findAllByText(/./)).not.toHaveLength(0);
    expect(mockListarViajes).not.toHaveBeenCalled();
  });
});
