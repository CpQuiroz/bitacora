// Tarea 146: subir/editar documento de un vehículo. Alta, edición con los
// datos precargados y aviso cuando no hay tipos. Servicios simulados.
import { fireEvent, render, screen } from "@testing-library/react-native";
import { DocumentoFormScreen } from "./DocumentoFormScreen";

let mockTipos: { id: string; nombre: string; aplica_a: string; activo: boolean }[] = [];
const mockGuardar = jest.fn(async () => ({ ok: true }));
jest.mock("expo-document-picker", () => ({ getDocumentAsync: jest.fn() }));
jest.mock("expo-file-system", () => ({ File: class {}, Paths: { cache: "" } }));
jest.mock("../../lib/imagen", () => ({ elegirFotos: jest.fn(async () => []) }));
jest.mock("../../services/equipos", () => ({
  tiposDocumentoVehiculo: jest.fn(async () => mockTipos),
  listarDocumentosVehiculo: jest.fn(async () => [
    { id: "d1", tipo_documento_id: "t1", numero: "N-55", fecha_emision: null, fecha_vencimiento: "2027-03-31", archivo_key: "k", tipo: { nombre: "SOAP" } },
  ]),
  guardarDocumento: (...a: unknown[]) => mockGuardar(...(a as [])),
}));

async function abrir(documentoId?: string) {
  const navigation = { goBack: jest.fn(), navigate: jest.fn() };
  await render(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <DocumentoFormScreen route={{ key: "k", name: "DocumentoForm", params: { equipoId: "e1", documentoId } } as any} navigation={navigation as any} />
  );
  return navigation;
}

describe("documento de vehículo (DocumentoFormScreen)", () => {
  test("sin tipos de documento para vehículos: explica dónde se crean", async () => {
    mockTipos = [];
    await abrir();
    expect(await screen.findByText("No hay tipos de documento para vehículos")).toBeTruthy();
  });

  test("alta: formulario vacío con adjuntar foto o PDF", async () => {
    mockTipos = [{ id: "t1", nombre: "SOAP", aplica_a: "vehiculo", activo: true }];
    await abrir();
    // Título de la pantalla y botón final.
    expect((await screen.findAllByText("Subir documento")).length).toBe(2);
    expect(screen.getByText("Adjuntar foto o PDF")).toBeTruthy();
    expect(screen.getByText("Sin archivo adjunto")).toBeTruthy();
  });

  test("edición: precarga número y archivo, y guarda con el id", async () => {
    mockTipos = [{ id: "t1", nombre: "SOAP", aplica_a: "vehiculo", activo: true }];
    const nav = await abrir("d1");
    expect(await screen.findByDisplayValue("N-55")).toBeTruthy();
    expect(screen.getByText("Tiene un archivo adjunto")).toBeTruthy();
    await fireEvent.press(screen.getByText("Guardar cambios"));
    expect(mockGuardar).toHaveBeenCalledWith(expect.objectContaining({ id: "d1", equipoId: "e1", tipoDocumentoId: "t1", numero: "N-55", fechaVencimiento: "2027-03-31" }));
    expect(nav.goBack).toHaveBeenCalled();
  });
});
