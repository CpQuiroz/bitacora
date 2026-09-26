// Tarea 153: el envoltorio de PostHog no hace nada sin clave y, con clave,
// manda los eventos por id técnico; nunca rompe la app si PostHog falla.
import { afterEach, describe, expect, test, vi } from "vitest";

const posthog = vi.hoisted(() => ({ init: vi.fn(), capture: vi.fn(), identify: vi.fn(), group: vi.fn(), reset: vi.fn() }));
vi.mock("posthog-js", () => ({ default: posthog }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  Object.values(posthog).forEach((f) => f.mockReset());
});

describe("analytics", () => {
  test("sin NEXT_PUBLIC_POSTHOG_KEY no inicia ni envía nada", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "");
    const a = await import("./analytics");
    a.iniciarAnalytics();
    a.registrarEvento("os_creada");
    expect(posthog.init).not.toHaveBeenCalled();
    expect(posthog.capture).not.toHaveBeenCalled();
  });

  test("con clave inicia sin autocaptura ni grabación, identifica por id y envía el evento", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_prueba");
    const a = await import("./analytics");
    a.iniciarAnalytics();
    expect(posthog.init).toHaveBeenCalledWith("phc_prueba", expect.objectContaining({ autocapture: false, disable_session_recording: true }));
    a.identificarUsuario("u1", "e1", "admin");
    expect(posthog.identify).toHaveBeenCalledWith("u1", { rol: "admin" });
    expect(posthog.group).toHaveBeenCalledWith("empresa", "e1");
    a.registrarEvento("cobro_creado", { origen: "manual" });
    expect(posthog.capture).toHaveBeenCalledWith("cobro_creado", { origen: "manual" });
  });

  test("si PostHog falla, la app sigue", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_prueba");
    posthog.capture.mockImplementation(() => {
      throw new Error("red");
    });
    const a = await import("./analytics");
    a.iniciarAnalytics();
    expect(() => a.registrarEvento("login")).not.toThrow();
  });
});
