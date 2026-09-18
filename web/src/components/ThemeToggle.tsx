"use client";

import { useEffect, useState } from "react";
import { Select } from "@bitacora/ui/web";

const CLAVE = "bitacora:tema";
type Tema = "auto" | "light" | "dark";

// Modo Nocturno (18-sep-2026). "auto" = sin data-theme, manda
// prefers-color-scheme (tokens.css); "light"/"dark" fuerzan el atributo
// en <html> y lo persisten — el script inline de layout.tsx lo vuelve a
// aplicar en la próxima carga, antes del primer paint.
function aplicar(tema: Tema) {
  if (tema === "auto") {
    document.documentElement.removeAttribute("data-theme");
    localStorage.removeItem(CLAVE);
  } else {
    document.documentElement.setAttribute("data-theme", tema);
    localStorage.setItem(CLAVE, tema);
  }
}

export function ThemeToggle() {
  const [tema, setTema] = useState<Tema>("auto");

  // El valor real ya lo aplicó el script inline antes del primer paint —
  // esto solo sincroniza el <Select> con lo que quedó guardado.
  useEffect(() => {
    const guardado = localStorage.getItem(CLAVE);
    if (guardado === "light" || guardado === "dark") setTema(guardado);
  }, []);

  function onCambio(v: string) {
    const t = v as Tema;
    setTema(t);
    aplicar(t);
  }

  return (
    <Select
      etiqueta="Apariencia"
      valor={tema}
      onCambio={onCambio}
      opciones={[
        { valor: "auto", etiqueta: "Automático (según tu dispositivo)" },
        { valor: "light", etiqueta: "Claro" },
        { valor: "dark", etiqueta: "Oscuro" },
      ]}
    />
  );
}
