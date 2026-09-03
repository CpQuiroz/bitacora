// Versión vigente de los documentos legales (Política de Privacidad y
// Términos). Se guarda junto a cada consentimiento (tabla
// `consentimientos`, migración 79) para poder demostrar QUÉ versión
// aceptó cada persona. Al publicar una versión nueva de cualquiera de
// los dos documentos, subir esta fecha — el backend marcará
// `consentimiento_pendiente` a quienes aceptaron una anterior.
export const DOCUMENTOS_LEGALES_VERSION = "2026-09-03";

export type DocumentoLegal = "privacidad" | "terminos";
export const DOCUMENTOS_LEGALES: DocumentoLegal[] = ["privacidad", "terminos"];
