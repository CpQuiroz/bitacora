// Tarea 156: feedback unificado en el detalle del viaje. Rechazar pide
// confirmación en la hoja inferior (no Alert nativo) y eliminar una foto
// usa "Deshacer": se oculta al instante y la API se llama recién al
// terminar la espera. Proveedores reales de toast y confirmación.
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { ConfirmarProvider, ToastProvider } from "@bitacora/ui/native";
import { ViajeDetalleScreen } from "./ViajeDetalleScreen";

jest.mock("../auth/AuthContext", () => ({
  useAuth: () => ({ fase: "listo", usuario: { id: "u1", rol: "admin", nombre: "QA" }, acciones: [], modulos: [] }),
}));
jest.mock("../../services/sync/NetworkProvider", () => ({
  useRed: () => ({ enLinea: true, pendientes: [], fallidas: [] }),
}));
jest.mock("@react-navigation/native", () => ({
  useFocusEffect: (efecto: () => void) => require("react").useEffect(efecto, [efecto]),
}));
jest.mock("../../lib/imagen", () => ({ elegirFotos: jest.fn(async () => []) }));

const mockEliminarFoto = jest.fn();
const mockRechazar = jest.fn();
jest.mock("../../services/viajes", () => ({
  obtenerViaje: jest.fn(async () => ({
    viaje: {
      id: "v1",
      folio: 12,
      fecha: "2026-09-20",
      numero_guia: "G-100",
      cliente: "Cliente de Prueba SpA",
      cliente_info: null,
      origen: "Santiago",
      destino: "Rancagua",
      estado: "borrador",
      km_inicial: null,
      km_final: null,
      subtotal: 150000,
      total: 178500,
      aplica_iva: true,
      chofer: { id: "u2", nombre: "Chofer QA" },
      foto_guia_url_firmada: null,
      fotos: [{ id: "f1", url: "https://fotos.invalid/f1.jpg", creado_en: "2026-09-20T10:00:00Z" }],
    },
    desdeCache: false,
  })),
  eliminarFotoViaje: (...a: unknown[]) => mockEliminarFoto(...a),
  rechazarViaje: (...a: unknown[]) => mockRechazar(...a),
  aprobarViaje: jest.fn(),
  encolarFotoViaje: jest.fn(),
}));

async function abrir() {
  const navigation = { goBack: jest.fn(), navigate: jest.fn() };
  await render(
    <ToastProvider>
      <ConfirmarProvider>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <ViajeDetalleScreen route={{ key: "k", name: "ViajeDetalle", params: { viajeId: "v1" } } as any} navigation={navigation as any} />
      </ConfirmarProvider>
    </ToastProvider>
  );
  return navigation;
}

describe("detalle del viaje: confirmación y Deshacer (tarea 156)", () => {
  beforeEach(() => {
    mockEliminarFoto.mockReset();
    mockRechazar.mockReset();
  });
  afterEach(() => jest.useRealTimers());

  test("rechazar pide confirmación; cancelar no llama a la API", async () => {
    await abrir();
    // Sin await: el handler queda esperando la respuesta del diálogo.
    void fireEvent.press(await screen.findByText("Rechazar viaje"));
    expect(await screen.findByText("¿Rechazar el viaje?")).toBeTruthy();
    await fireEvent.press(screen.getByText("No"));
    expect(mockRechazar).not.toHaveBeenCalled();
  });

  test("rechazar confirmado llama a la API y vuelve", async () => {
    mockRechazar.mockResolvedValue({ ok: true });
    const nav = await abrir();
    // Sin await: el handler queda esperando la respuesta del diálogo.
    void fireEvent.press(await screen.findByText("Rechazar viaje"));
    await fireEvent.press(await screen.findByText("Sí, rechazar"));
    expect(mockRechazar).toHaveBeenCalledWith("v1");
    expect(nav.goBack).toHaveBeenCalled();
  });

  test("eliminar foto: se oculta al instante, Deshacer la devuelve y nunca llama a la API", async () => {
    await abrir();
    expect(await screen.findByText("1 subida")).toBeTruthy();
    jest.useFakeTimers();
    await fireEvent.press(screen.getByLabelText("Eliminar foto"));
    expect(screen.getByText("Foto eliminada")).toBeTruthy();
    expect(screen.getByText("Sin fotos todavía.")).toBeTruthy();
    await fireEvent.press(screen.getByText("Deshacer"));
    expect(screen.getByText("1 subida")).toBeTruthy();
    await act(async () => {
      jest.advanceTimersByTime(6000);
    });
    expect(mockEliminarFoto).not.toHaveBeenCalled();
  });

  test("eliminar foto sin deshacer: la API se llama al terminar la espera", async () => {
    mockEliminarFoto.mockResolvedValue({ ok: true });
    await abrir();
    await screen.findByText("1 subida");
    jest.useFakeTimers();
    await fireEvent.press(screen.getByLabelText("Eliminar foto"));
    expect(mockEliminarFoto).not.toHaveBeenCalled();
    await act(async () => {
      jest.advanceTimersByTime(5000);
    });
    expect(mockEliminarFoto).toHaveBeenCalledWith("v1", "f1");
  });

  test("si la API falla, la foto vuelve y se avisa el error", async () => {
    mockEliminarFoto.mockResolvedValue({ ok: false, error: "Error 500" });
    await abrir();
    await screen.findByText("1 subida");
    jest.useFakeTimers();
    await fireEvent.press(screen.getByLabelText("Eliminar foto"));
    await act(async () => {
      jest.advanceTimersByTime(5000);
    });
    expect(screen.getByText("No se pudo eliminar: Error 500")).toBeTruthy();
    expect(screen.getByText("1 subida")).toBeTruthy();
  });
});
