// Tarea 146: ficha del equipo en la app. Chofer con su vehículo asignado:
// ve y sube documentos, pero no edita el equipo ni lo reasigna. Admin con
// Flota: edita, sube documentos, agrega plan y reasigna. Servicios simulados.
import { fireEvent, render, screen } from "@testing-library/react-native";
import { EquipoDetalleScreen } from "./EquipoDetalleScreen";

let mockModulos: string[] = [];
let mockAsignadoA = "u1";
let mockRol = "colaborador";
jest.mock("../auth/AuthContext", () => ({
  useAuth: () => ({ fase: "listo", usuario: { id: "u1", rol: mockRol, nombre: "QA" }, modulosVisibles: mockModulos, acciones: [] }),
}));
jest.mock("@react-navigation/native", () => ({
  useFocusEffect: (efecto: () => void) => require("react").useEffect(efecto, [efecto]),
}));
jest.mock("expo-web-browser", () => ({ openBrowserAsync: jest.fn() }));
jest.mock("../../services/mantencion", () => ({
  obtenerHistorialEquipo: jest.fn(async () => ({ registros: [], error: null })),
  obtenerMantencionInicio: jest.fn(async () => ({ datos: { vehiculo: null, registros: [] }, desdeCache: false })),
}));
jest.mock("../../services/equipos", () => ({
  esVehiculo: (e: { categoria?: string | null; patente?: string | null }) => e.categoria === "Vehículo" || Boolean(e.patente),
  obtenerEquipo: jest.fn(async () => ({
    id: "e1",
    nombre: "Camión 1",
    categoria: "Vehículo",
    patente: "ABCD12",
    marca: "Volvo",
    modelo: "FH",
    anio: 2020,
    activo: true,
    asignacion_vigente: { colaborador_id: mockAsignadoA, colaborador_nombre: "Chofer QA" },
    historico_mantenciones: [],
  })),
  listarDocumentosVehiculo: jest.fn(async () => [
    { id: "d1", tipo_documento_id: "t1", numero: "123", fecha_vencimiento: "2020-01-01", archivo_key: "k", tipo: { nombre: "SOAP" }, estado: "vencido" },
  ]),
  planesDeEquipo: jest.fn(async () => []),
  colaboradoresAsignables: jest.fn(async () => [{ id: "u2", nombre: "Otro chofer" }]),
  asignarVehiculo: jest.fn(),
  desasignarVehiculo: jest.fn(),
  borrarDocumento: jest.fn(),
  borrarPlan: jest.fn(),
  cambiarEstadoPlan: jest.fn(),
  urlArchivoDocumento: jest.fn(),
  listarViajesDeEquipo: jest.fn(async () => [
    { id: "v1", fecha: "2026-09-20", numero_guia: "G-1", origen: "Santiago", destino: "Rancagua", estado: "confirmado", total: 150000, chofer: { id: "u2", nombre: "Chofer QA" }, cliente_info: null },
  ]),
}));

async function abrir() {
  const navigation = { goBack: jest.fn(), navigate: jest.fn() };
  await render(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <EquipoDetalleScreen route={{ key: "k", name: "EquipoDetalle", params: { equipoId: "e1" } } as any} navigation={navigation as any} />
  );
  return navigation;
}

describe("ficha del equipo (EquipoDetalleScreen)", () => {
  test("chofer con su vehículo asignado: ve y sube documentos, no edita ni reasigna", async () => {
    mockModulos = [];
    mockAsignadoA = "u1";
    await abrir();
    expect(await screen.findByText("1 vencido")).toBeTruthy();
    expect(screen.queryByText("Editar")).toBeNull();
    expect(screen.queryByText("Cambiar chofer")).toBeNull();
    await fireEvent.press(screen.getAllByText("Documentos")[0]!);
    expect(await screen.findByText("SOAP · N° 123")).toBeTruthy();
    expect(screen.getByText("Vencido")).toBeTruthy();
    expect(screen.getByText("Subir")).toBeTruthy();
    await fireEvent.press(screen.getByText("Mantención"));
    expect(screen.queryByText("Agregar")).toBeNull();
    expect(screen.getByText("Registrar mantención")).toBeTruthy();
  });

  test("admin con Flota: edita, sube documentos, agrega plan y reasigna", async () => {
    mockModulos = ["flota", "equipos"];
    mockAsignadoA = "u9";
    await abrir();
    expect(await screen.findByText("Editar")).toBeTruthy();
    expect(screen.getByText("Cambiar chofer")).toBeTruthy();
    expect(screen.getByText("Quitar asignación")).toBeTruthy();
    await fireEvent.press(screen.getAllByText("Documentos")[0]!);
    expect(await screen.findByText("SOAP · N° 123")).toBeTruthy();
    expect(screen.getByText("Subir")).toBeTruthy();
    await fireEvent.press(screen.getByText("Mantención"));
    expect(screen.getByText("Agregar")).toBeTruthy();
  });

  test("sin Flota y con un vehículo que no es suyo: no ve documentos", async () => {
    mockModulos = ["equipos"];
    mockAsignadoA = "u9";
    await abrir();
    expect(await screen.findByText("Camión 1")).toBeTruthy();
    expect(screen.queryByText("Documentos")).toBeNull();
    expect(screen.queryByText("Editar")).toBeNull();
    expect(screen.getByText("Eventos")).toBeTruthy();
  });

  test("Viajes: el admin ve la ruta y el monto; el chofer no ve el monto", async () => {
    mockModulos = ["flota", "viajes"];
    mockAsignadoA = "u9";
    mockRol = "admin";
    await abrir();
    await fireEvent.press(await screen.findByText("Viajes"));
    expect(await screen.findByText("Santiago → Rancagua")).toBeTruthy();
    expect(screen.getByText("$150.000")).toBeTruthy();

    mockModulos = ["viajes"];
    mockAsignadoA = "u1";
    mockRol = "colaborador";
    await abrir();
    await fireEvent.press((await screen.findAllByText("Viajes"))[0]!);
    expect(await screen.findByText("Santiago → Rancagua")).toBeTruthy();
    expect(screen.queryByText("$150.000")).toBeNull();
    mockRol = "colaborador";
  });
});
