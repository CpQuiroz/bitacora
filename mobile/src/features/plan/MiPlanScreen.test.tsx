// Tarea 151: "Mi plan" solo lectura — precio en UF y CLP al valor del día,
// módulos activos respecto del tope, límites y consumo, y el aviso de que el
// cambio de plan se hace en la web (texto, sin botones de pago).
import { render, screen } from "@testing-library/react-native";
import { MiPlanScreen } from "./MiPlanScreen";

let mockInfo: unknown;
jest.mock("@react-navigation/native", () => ({
  useFocusEffect: (efecto: () => void) => require("react").useEffect(efecto, [efecto]),
}));
jest.mock("../../services/plan", () => ({ obtenerMiPlan: jest.fn(async () => mockInfo) }));

const base = {
  planActual: "basico",
  pruebaTerminaEn: null,
  trialVencido: false,
  historial: [],
  suscripcion: null,
  cobros: [],
  modulosActivos: ["ordenes_servicio", "registros", "viajes"],
  modulosMax: 6,
  consumo: {
    usuarios: { usados: 3, tope: 5 },
    osMes: { usados: 12, tope: 100 },
    almacenamiento: { usadoGB: 0.4, topeGB: 10 },
    informesIA: { usados: 1, tope: 5, periodo: "mes" },
  },
  precio: { uf: 1.5, clp: 59228, valorUf: 39485.65, fechaUf: "2026-09-26", ufDelDia: true },
};

async function abrir() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await render(<MiPlanScreen route={{ key: "k", name: "MiPlan" } as any} navigation={{ goBack: jest.fn() } as any} />);
}

describe("Mi plan (MiPlanScreen)", () => {
  test("muestra precio en UF y CLP, módulos, consumo y el aviso de la web", async () => {
    mockInfo = base;
    await abrir();
    expect(await screen.findByText("1,5 UF + IVA al mes · $59.228 + IVA")).toBeTruthy();
    expect(screen.getByText(/UF de hoy/)).toBeTruthy();
    expect(screen.getByText("3 de 6 que permite tu plan")).toBeTruthy();
    expect(screen.getByText("Órdenes de servicio · Clientes · Viajes")).toBeTruthy();
    expect(screen.getByText("3 de 5")).toBeTruthy();
    expect(screen.getByText("12 de 100")).toBeTruthy();
    expect(screen.getByText(/se gestionan en Bitácora web/)).toBeTruthy();
    expect(screen.queryByText(/Pagar|Cambiar plan|Contratar/)).toBeNull();
  });

  test("sin UF del día usa el último valor y lo dice", async () => {
    mockInfo = { ...base, precio: { ...base.precio, ufDelDia: false, fechaUf: "2026-09-25" } };
    await abrir();
    expect(await screen.findByText(/último valor disponible/)).toBeTruthy();
  });

  test("en prueba no muestra precio", async () => {
    mockInfo = { ...base, planActual: "trial", pruebaTerminaEn: "2099-01-01", precio: null, modulosMax: null };
    await abrir();
    expect(await screen.findByText(/Quedan/)).toBeTruthy();
    expect(screen.queryByText(/UF/)).toBeNull();
    expect(screen.getByText("3 activos (tu plan no tiene tope)")).toBeTruthy();
  });
});
