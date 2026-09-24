// Simulacros de módulos nativos para las pruebas de pantallas (tarea 127).
// Son los que publican las propias librerías para Jest.
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
jest.mock("@react-native-community/netinfo", () => require("@react-native-community/netinfo/jest/netinfo-mock.js"));

// Sin red en las pruebas: valores de mentira para que el cliente de
// Supabase y la API se puedan construir (nunca se llega a llamarlos).
process.env.EXPO_PUBLIC_SUPABASE_URL ??= "https://pruebas.supabase.invalid";
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??= "clave-de-pruebas";
process.env.EXPO_PUBLIC_API_URL ??= "https://api.pruebas.invalid";

// Firma y WebView son vistas nativas: en las pruebas se reemplazan por una
// vista vacía (lo que se prueba es que la pantalla renderice, no el lienzo).
jest.mock("react-native-webview", () => {
  const { View } = require("react-native");
  return { __esModule: true, default: View, WebView: View };
});
jest.mock("react-native-signature-canvas", () => {
  const react = require("react");
  const { View } = require("react-native");
  return { __esModule: true, default: react.forwardRef((_props: unknown, _ref: unknown) => react.createElement(View)) };
});

// Márgenes seguros (notch): simulacro oficial de react-native-safe-area-context.
jest.mock("react-native-safe-area-context", () => require("react-native-safe-area-context/jest/mock").default);
