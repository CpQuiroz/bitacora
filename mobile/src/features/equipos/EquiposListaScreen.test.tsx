// Tarea 146: lista de equipos. Con Flota: lista con filtro y alerta de
// documentos. Chofer sin Flota: entra directo a la ficha de su vehículo o
// ve "No tienes un vehículo asignado". Servicios simulados.
import { fireEvent, render, screen } from "@testing-library/react-native";
import { EquiposListaScreen } from "./EquiposListaScreen";

let mockModulos: string[] = [];
let mockMiVehiculo: { id: string } | null = null;
jest.mock("../auth/AuthContext", () => ({
  useAuth: () => ({ fase: "listo", usuario: { id: "u1", rol: "colaborador", nombre: "QA" }, modulosVisibles: mockModulos, acciones: [] }),
}));
jest.mock("@react-navigation/native", () => ({
  useFocusEffect: (efecto: () => void) => require("react").useEffect(efecto, [efecto]),
}));
jest.mock("../../services/equipos", () => ({
  esVehiculo: (e: { categoria?: string | null; patente?: string | null }) => e.categoria === "Vehículo" || Boolean(e.patente),
  miVehiculo: jest.fn(async () => mockMiVehiculo),
  listarEquipos: jest.fn(async () => ({
    desdeCache: false,
    equipos: [
      { id: "e1", nombre: "Camión 1", categoria: "Vehículo", patente: "ABCD12", activo: true, asignacion_vigente: { colaborador_id: "u2", colaborador_nombre: "Chofer QA" } },
      { id: "e2", nombre: "Generador", categoria: "Maquinaria", patente: null, activo: true, asignacion_vigente: null },
      { id: "e3", nombre: "Dado de baja", categoria: "Otro", patente: null, activo: false, asignacion_vigente: null },
    ],
  })),
  alertasDocumentos: jest.fn(async () => new Map([["e1", "vencido"]])),
}));

async function abrir() {
  const navigation = { goBack: jest.fn(), navigate: jest.fn(), replace: jest.fn() };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await render(<EquiposListaScreen route={{ key: "k", name: "Equipos" } as any} navigation={navigation as any} />);
  return navigation;
}

describe("lista de equipos (EquiposListaScreen)", () => {
  test("con Flota: lista activos, alerta de documento vencido y filtro", async () => {
    mockModulos = ["flota"];
    await abrir();
    expect(await screen.findByText("Camión 1")).toBeTruthy();
    expect(screen.getByText("Generador")).toBeTruthy();
    expect(screen.queryByText("Dado de baja")).toBeNull();
    expect(screen.getByText("Doc. vencido")).toBeTruthy();
    await fireEvent.press(screen.getByText("Otros equipos"));
    expect(screen.queryByText("Camión 1")).toBeNull();
    expect(screen.getByText("Generador")).toBeTruthy();
  });

  test("chofer sin Flota con vehículo: entra directo a su ficha", async () => {
    mockModulos = [];
    mockMiVehiculo = { id: "e9" };
    const nav = await abrir();
    await screen.findByText("Equipos").catch(() => null);
    expect(nav.replace).toHaveBeenCalledWith("EquipoDetalle", { equipoId: "e9" });
  });

  test("chofer sin vehículo asignado: aviso", async () => {
    mockModulos = [];
    mockMiVehiculo = null;
    await abrir();
    expect(await screen.findByText("No tienes un vehículo asignado")).toBeTruthy();
  });
});
