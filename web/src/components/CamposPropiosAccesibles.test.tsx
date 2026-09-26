// Accesibilidad base (tarea 155): los campos propios de la app (Combobox,
// InputMonto) se asocian a su <label> vía id, y el combobox declara qué
// listbox controla.
import { describe, expect, test } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Combobox } from "./Combobox";
import { InputMonto } from "./InputMonto";

const nada = () => {};
const opciones = [
  { id: "a", label: "Santiago" },
  { id: "b", label: "Valparaíso" },
];

describe("campos propios con etiqueta asociada", () => {
  test("el combobox se encuentra por su etiqueta y controla su listbox", () => {
    render(
      <>
        <label htmlFor="origen">Origen</label>
        <Combobox id="origen" value="" onChange={nada} opciones={opciones} />
      </>
    );
    const campo = screen.getByLabelText("Origen");
    expect(campo.getAttribute("role")).toBe("combobox");
    expect(campo.getAttribute("aria-expanded")).toBe("false");
    fireEvent.focus(campo);
    expect(campo.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("listbox").id).toBe(campo.getAttribute("aria-controls"));
  });

  test("dos combobox no comparten el id de su listbox", () => {
    render(
      <>
        <Combobox id="origen" value="" onChange={nada} opciones={opciones} />
        <Combobox id="destino" value="" onChange={nada} opciones={opciones} />
      </>
    );
    const [origen, destino] = screen.getAllByRole("combobox");
    expect(origen.getAttribute("aria-controls")).not.toBe(destino.getAttribute("aria-controls"));
  });

  test("el campo de monto se encuentra por su etiqueta", () => {
    render(
      <>
        <label htmlFor="monto">Monto</label>
        <InputMonto id="monto" value="1250000" onChange={nada} />
      </>
    );
    expect((screen.getByLabelText("Monto") as HTMLInputElement).value).toContain("1.250.000");
  });
});
