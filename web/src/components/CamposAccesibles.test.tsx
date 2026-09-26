// Accesibilidad base (tarea 155): los campos de @bitacora/ui/web asocian su
// etiqueta (clic en la etiqueta enfoca el campo, el lector de pantalla lee su
// nombre) y su mensaje de error o ayuda.
import { describe, expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { DatePicker, Input, Select, Textarea } from "@bitacora/ui/web";

const nada = () => {};

describe("campos de @bitacora/ui/web", () => {
  test("cada campo se encuentra por su etiqueta y los ids no se repiten", () => {
    render(
      <>
        <Input etiqueta="Patente" valor="" onCambio={nada} />
        <Input etiqueta="Kilometraje" valor="" onCambio={nada} />
        <Select etiqueta="Estado" valor="" onCambio={nada} opciones={[{ valor: "a", etiqueta: "Activo" }]} />
        <Textarea etiqueta="Notas" valor="" onCambio={nada} />
        <DatePicker etiqueta="Vence" valor={null} onCambio={nada} />
      </>
    );
    const campos = ["Patente", "Kilometraje", "Estado", "Notas", "Vence"].map((e) => screen.getByLabelText(e));
    expect(new Set(campos.map((c) => c.id)).size).toBe(5);
  });

  test("el error queda asociado al campo y lo marca inválido", () => {
    render(<Input etiqueta="RUT" valor="1" onCambio={nada} error="RUT inválido" />);
    const campo = screen.getByLabelText("RUT");
    expect(campo.getAttribute("aria-invalid")).toBe("true");
    expect(document.getElementById(campo.getAttribute("aria-describedby")!)?.textContent).toBe("RUT inválido");
  });

  test("sin error ni ayuda no apunta a un mensaje inexistente", () => {
    render(<Input etiqueta="Nombre" valor="" onCambio={nada} />);
    expect(screen.getByLabelText("Nombre").hasAttribute("aria-describedby")).toBe(false);
  });
});

describe("id y etiqueta accesible propios", () => {
  test("un <label htmlFor> externo se asocia con el id pasado", () => {
    render(
      <>
        <label htmlFor="prov-tel">Teléfono</label>
        <Input id="prov-tel" valor="" onCambio={nada} />
      </>
    );
    expect(screen.getByLabelText("Teléfono").id).toBe("prov-tel");
  });

  test("sin etiqueta visible, etiquetaAccesible da el nombre", () => {
    render(<Select etiquetaAccesible="Estado de la cotización" valor="" onCambio={nada} opciones={[]} />);
    expect(screen.getByLabelText("Estado de la cotización").tagName).toBe("SELECT");
  });
});
