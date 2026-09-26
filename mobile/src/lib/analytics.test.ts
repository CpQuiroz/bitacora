// Tarea 153: PostHog en la app no hace nada sin clave; con clave identifica
// por id técnico y marca la plataforma; nunca rompe la app.
const mockCliente = { identify: jest.fn(), group: jest.fn(), capture: jest.fn(), reset: jest.fn() };
const mockConstructor = jest.fn(() => mockCliente);
jest.mock("posthog-react-native", () => ({ __esModule: true, default: mockConstructor }));

afterEach(() => {
  delete process.env.EXPO_PUBLIC_POSTHOG_KEY;
  jest.resetModules();
  jest.clearAllMocks();
});

test("sin EXPO_PUBLIC_POSTHOG_KEY no crea el cliente ni envía nada", () => {
  const a = require("./analytics");
  a.registrarEvento("os_creada");
  expect(mockConstructor).not.toHaveBeenCalled();
});

test("con clave: sin grabación de sesión, identifica por id y agrega la plataforma", () => {
  process.env.EXPO_PUBLIC_POSTHOG_KEY = "phc_prueba";
  const a = require("./analytics");
  a.identificarUsuario("u1", "e1", "colaborador", "chofer");
  expect(mockConstructor).toHaveBeenCalledWith("phc_prueba", expect.objectContaining({ enableSessionReplay: false }));
  expect(mockCliente.identify).toHaveBeenCalledWith("u1", { rol: "colaborador", funcion: "chofer" });
  expect(mockCliente.group).toHaveBeenCalledWith("empresa", "e1");
  a.registrarEvento("viaje_iniciado", { sin_conexion: true });
  expect(mockCliente.capture).toHaveBeenCalledWith("viaje_iniciado", { sin_conexion: true, plataforma: "mobile" });
});

test("si PostHog falla, la app sigue", () => {
  process.env.EXPO_PUBLIC_POSTHOG_KEY = "phc_prueba";
  mockCliente.capture.mockImplementationOnce(() => {
    throw new Error("red");
  });
  const a = require("./analytics");
  expect(() => a.registrarEvento("login")).not.toThrow();
});
