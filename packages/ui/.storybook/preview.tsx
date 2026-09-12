import type { Preview } from "@storybook/react-vite";
import { ToastProvider } from "../src/web/Toast";
import "./preview.css";

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      default: "fondo",
      values: [{ name: "fondo", value: "#f5ead8" }],
    },
  },
  decorators: [
    // bg-ds-bg/text-ds-text: mismo fondo/texto base que ve una pantalla
    // real del dashboard (Card.tsx y compañía asumen que su padre ya
    // trae esos dos, no se los ponen a sí mismos). ToastProvider: Toast
    // usa useToast() vía contexto — sin esto su historia rompería.
    (Story) => (
      <div className="bg-ds-bg text-ds-text min-h-screen p-ds-6 font-ds-body">
        <ToastProvider>
          <Story />
        </ToastProvider>
      </div>
    ),
  ],
};
export default preview;
