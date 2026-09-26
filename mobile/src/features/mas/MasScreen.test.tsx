// Tarea 152: el menú Más muestra solo lo que la empresa y el rol tienen, sin
// quitarle a técnicos y choferes su trabajo asignado.
import { render, screen } from "@testing-library/react-native";
import { MasScreen } from "./MasScreen";

let mockAuth: Record<string, unknown> = {};
jest.mock("../auth/AuthContext", () => ({ useAuth: () => mockAuth }));
jest.mock("../../services/sync/NetworkProvider", () => ({ useRed: () => ({ pendientes: [] }) }));
jest.mock("../../services/cobros", () => ({ listarCobros: jest.fn(async () => ({ cobros: [] })), estaVencido: () => false }));
jest.mock("@react-navigation/native", () => ({
  useFocusEffect: (efecto: () => void) => require("react").useEffect(efecto, [efecto]),
}));

const COLABORADOR = ["agenda", "agenda_pro", "asistente", "catalogo", "equipos", "inventario", "proveedores", "registros"];

function sesion(funcion: string, deshabilitados: string[] = []) {
  mockAuth = {
    fase: "listo",
    usuario: { id: "u1", rol: "colaborador", funcion, nombre: "QA" },
    modulosVisibles: COLABORADOR.filter((m) => !deshabilitados.includes(m)),
    modulosDeshabilitados: deshabilitados,
    acciones: [],
  };
}

async function abrir() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await render(<MasScreen route={{ key: "k", name: "MasInicio" } as any} navigation={{ navigate: jest.fn() } as any} />);
}

describe("menú Más según módulos (MasScreen)", () => {
  test("técnico: ve sus OS y levantamientos; no viajes ni mantención", async () => {
    sesion("tecnico");
    await abrir();
    expect(await screen.findByText("Órdenes de servicio")).toBeTruthy();
    expect(screen.getByText("Levantamientos")).toBeTruthy();
    expect(screen.queryByText("Viajes")).toBeNull();
    expect(screen.queryByText("Mantención")).toBeNull();
  });

  test("chofer: ve viajes, mantención y su vehículo", async () => {
    sesion("chofer");
    await abrir();
    expect(await screen.findByText("Viajes")).toBeTruthy();
    expect(screen.getByText("Mantención")).toBeTruthy();
    expect(screen.getByText("Equipos")).toBeTruthy();
  });

  test("con los módulos apagados en la empresa no aparecen", async () => {
    sesion("chofer", ["ordenes_servicio", "viajes", "flota", "levantamientos", "equipos"]);
    await abrir();
    expect(await screen.findByText("Mis trabajos")).toBeTruthy();
    for (const t of ["Órdenes de servicio", "Viajes", "Mantención", "Levantamientos", "Mi vehículo"]) expect(screen.queryByText(t)).toBeNull();
  });
});
