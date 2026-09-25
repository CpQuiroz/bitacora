// Tarea 146 (bug real 25-sep-2026): el archivo del documento tiene que ir en
// el multipart como File de expo-file-system. El objeto {uri,name,type} de
// antes lo rechaza el fetch de Expo ("Unsupported FormDataPart") y la app
// mostraba "No se pudo conectar" sin llegar nunca al servidor.
import { guardarDocumento } from "./equipos";

// Se captura lo que se entrega a FormData.append tal cual (el FormData de
// Node en las pruebas convertiría a texto lo que no es Blob).
const partes = new Map<string, unknown>();
const appendOriginal = FormData.prototype.append;
beforeEach(() => {
  partes.clear();
  jest.spyOn(FormData.prototype, "append").mockImplementation(function (this: FormData, campo: string, valor: unknown) {
    partes.set(campo, valor);
    return (appendOriginal as (c: string, v: string) => void).call(this, campo, typeof valor === "string" ? valor : "x");
  } as never);
});
afterEach(() => jest.restoreAllMocks());

jest.mock("expo-file-system", () => {
  class File {
    uri: string;
    constructor(uri: string) {
      this.uri = uri;
    }
  }
  return { File };
});
const mockApiFetch = jest.fn(async (_ruta: string, _op: { body: FormData }) => ({ ok: true, status: 201, json: async () => ({}) }));
jest.mock("./api", () => ({
  apiFetch: (ruta: string, op: { body: FormData }) => mockApiFetch(ruta, op),
  apiJson: jest.fn(),
  TIMEOUT_MULTIPART_MS: 1000,
}));
jest.mock("./sync/cache", () => ({ guardarCache: jest.fn(), leerCache: jest.fn() }));

test("sube el archivo como File (no como {uri,name,type})", async () => {
  const { File } = jest.requireMock("expo-file-system") as { File: new (uri: string) => { uri: string } };
  const r = await guardarDocumento({
    equipoId: "e1",
    tipoDocumentoId: "t1",
    numero: " A-1 ",
    fechaEmision: null,
    fechaVencimiento: "2027-03-31",
    archivo: { uri: "file:///fotos-cola/123.jpg", name: "foto.jpeg", type: "image/jpeg" },
  });
  expect(r).toEqual({ ok: true });
  const [ruta] = mockApiFetch.mock.calls[0]!;
  expect(ruta).toBe("/api/documentos");
  const archivo = partes.get("archivo");
  expect(archivo).toBeInstanceOf(File);
  expect((archivo as unknown as { uri: string }).uri).toBe("file:///fotos-cola/123.jpg");
  expect(partes.get("entidad_id")).toBe("e1");
  expect(partes.get("numero")).toBe("A-1");
});

test("un error que no es de red se muestra tal cual (no 'sin conexión')", async () => {
  mockApiFetch.mockRejectedValueOnce(new Error("Unsupported FormDataPart implementation"));
  const r = await guardarDocumento({ id: "d1", equipoId: "e1", tipoDocumentoId: "t1", numero: "", fechaEmision: null, fechaVencimiento: null, archivo: null });
  expect(r).toEqual({ ok: false, error: "No se pudo subir el archivo (Unsupported FormDataPart implementation)" });
});
