// Prueba de regresión (tarea 127): abrir una OS no puede tumbar la app.
// En 1.10.16 un hook declarado después de un `return` anticipado hacía
// que el primer render (cargando) y el siguiente (con datos) tuvieran
// distinta cantidad de hooks → "Rendered more hooks…" y cierre. Esta
// prueba recorre justo esa transición (cargando → con datos) en los 3
// pasos de la OS, con los servicios simulados (sin red ni base).
import { render, screen, waitFor } from "@testing-library/react-native";
import type { DetalleTrabajo } from "../../services/trabajos";
import { TrabajoDetalleScreen } from "./TrabajoDetalleScreen";

const mockObtenerDetalle = jest.fn<Promise<DetalleTrabajo>, [string]>();

jest.mock("../../services/trabajos", () => ({
  obtenerDetalle: (id: string) => mockObtenerDetalle(id),
  eliminarFoto: jest.fn(),
  encolarCheckin: jest.fn(),
  encolarClienteNoDisponible: jest.fn(),
  encolarDatos: jest.fn(),
  encolarDescripcionFoto: jest.fn(),
  encolarFinalizar: jest.fn(),
  encolarFirma: jest.fn(),
  encolarFoto: jest.fn(),
  encolarObservaciones: jest.fn(),
}));
jest.mock("../auth/AuthContext", () => ({
  useAuth: () => ({ fase: "listo", usuario: { id: "u1", rol: "colaborador", nombre: "Técnico QA" }, acciones: [], modulos: [] }),
}));
jest.mock("../../lib/geo", () => ({ ubicacionActual: jest.fn(async () => null) }));
jest.mock("@react-navigation/native", () => {
  const react = jest.requireActual<typeof import("react")>("react");
  return { useFocusEffect: (efecto: () => void) => react.useEffect(efecto, [efecto]) };
});

function detalle(orden: Partial<NonNullable<DetalleTrabajo["orden"]>> | null): DetalleTrabajo {
  return {
    trabajo: {
      id: "t1",
      empresa_id: "e1",
      cliente: "Cliente de Prueba SpA",
      cliente_id: "c1",
      cliente_info: { nombre: "Cliente de Prueba SpA", direccion: "Alameda 100, Santiago", telefono: "+56911112222", lat: null, lng: null },
      descripcion: "Mantención preventiva",
      estado: "en_proceso",
      fecha: "2026-09-24",
      hora_programada: "09:30:00",
      ubicacion: null,
      datos: {},
      notas_internas: null,
      equipo_id: null,
      tipo: { id: "tp1", nombre: "Mantención", campos: [] },
    },
    orden:
      orden === null
        ? null
        : {
            id: "o1",
            folio: 42,
            estado_os: "en_proceso",
            checklist: [],
            check_in_at: null,
            finalizada_en: null,
            observaciones_cierre: null,
            firma_url_firmada: null,
            firma_tecnico_url_firmada: null,
            ...orden,
          },
    fotos: [],
    desdeCache: false,
  } as unknown as DetalleTrabajo;
}

async function abrir() {
  const navigation = { goBack: jest.fn(), navigate: jest.fn(), setOptions: jest.fn() };
  return await render(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <TrabajoDetalleScreen route={{ key: "k", name: "TrabajoDetalle", params: { trabajoId: "t1", titulo: "OS-0042" } } as any} navigation={navigation as any} />
  );
}

describe("abrir una OS (TrabajoDetalleScreen)", () => {
  beforeEach(() => mockObtenerDetalle.mockReset());

  test.each([
    ["paso 1: sin llegada marcada", detalle({})],
    ["paso 2: con llegada marcada", detalle({ check_in_at: "2026-09-24T12:40:00Z", checklist: [{ item: "Check-in", hecho: true, hora: "2026-09-24T12:40:00Z" }] })],
    ["finalizada", detalle({ estado_os: "firmada", finalizada_en: "2026-09-24T14:00:00Z", check_in_at: "2026-09-24T12:40:00Z" })],
    ["sin orden todavía", detalle(null)],
  ])("%s: pasa de cargando a mostrar la OS sin caerse", async (_nombre, datos) => {
    mockObtenerDetalle.mockResolvedValue(datos);
    await abrir();
    expect(await screen.findAllByText(/Cliente de Prueba SpA/)).not.toHaveLength(0);
    expect(mockObtenerDetalle).toHaveBeenCalledWith("t1");
  });

  test("si falla la carga muestra el error, no se cae", async () => {
    mockObtenerDetalle.mockRejectedValue(new Error("Sin conexión con el servidor"));
    await abrir();
    await waitFor(() => expect(screen.getByText(/Sin conexión con el servidor/)).toBeTruthy());
  });
});
