// Prueba de regresión (tarea 127): formulario de viaje en la app.
// Chofer: ve su viaje, el monto en solo lectura y su viático.
// Gestión: puede crear el viaje. Servicios simulados (sin red ni base).
import { render, screen } from "@testing-library/react-native";
import { ViajeFormScreen } from "./ViajeFormScreen";

let mockRol = "colaborador";
jest.mock("../auth/AuthContext", () => ({
  useAuth: () => ({ fase: "listo", usuario: { id: "u1", rol: mockRol, nombre: "QA" }, acciones: [], modulos: [] }),
}));
jest.mock("../../lib/imagen", () => ({ elegirFotos: jest.fn(async () => []) }));
jest.mock("../../services/viajes", () => ({
  catalogoParaViaje: jest.fn(async () => ({
    clientes: [{ id: "c1", nombre: "Cliente de Prueba SpA", activo: true }],
    equipos: [],
  })),
  listarChoferes: jest.fn(async () => [{ id: "u2", nombre: "Chofer QA" }]),
  crearViaje: jest.fn(),
  editarViaje: jest.fn(),
  encolarViaje: jest.fn(),
  obtenerViaje: jest.fn(async () => ({
    viaje: {
      id: "v1",
      cliente_id: "c1",
      numero_guia: "G-100",
      origen: "Santiago",
      destino: "Rancagua",
      equipo_id: null,
      km_inicial: null,
      km_final: null,
      subtotal: 150000,
      aplica_iva: true,
      viatico_tipo: "interregional",
      viatico_monto: 25000,
    },
    desdeCache: false,
  })),
}));

async function abrir(viajeId?: string) {
  const navigation = { goBack: jest.fn(), setOptions: jest.fn() };
  await render(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <ViajeFormScreen route={{ key: "k", name: "ViajeForm", params: viajeId ? { viajeId } : undefined } as any} navigation={navigation as any} />
  );
}

describe("formulario de viaje (ViajeFormScreen)", () => {
  test("chofer editando: monto en solo lectura y su viático visible", async () => {
    mockRol = "colaborador";
    await abrir("v1");
    expect(await screen.findByText(/El monto lo cambia la oficina/)).toBeTruthy();
    expect(screen.getByText("$150.000 + IVA")).toBeTruthy();
    expect(screen.getByText("Viático interregional")).toBeTruthy();
    expect(screen.getByText("$25.000")).toBeTruthy();
  });

  test("gestión creando: puede ingresar el monto (no aparece el aviso de oficina)", async () => {
    mockRol = "supervisor";
    await abrir();
    expect(await screen.findByLabelText("Número de guía")).toBeTruthy();
    expect(screen.queryByText(/El monto lo cambia la oficina/)).toBeNull();
  });
});
