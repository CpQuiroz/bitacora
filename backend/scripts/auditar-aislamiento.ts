// ============================================================
// Alarma heurística de aislamiento multi-tenant (Etapa 0).
//
// OJO: esto es un chequeo por texto (ventana de líneas alrededor de
// cada ".from(tabla)"), NO un parser de AST. Puede tener falsos
// negativos (una consulta rara que sí está bien pero el script no la
// reconoce) y en teoría falsos positivos. Sirve para dirigir dónde
// mirar a mano, no reemplaza la revisión humana ni es una prueba
// formal de que el aislamiento es correcto.
//
// Uso: npm run audit:tenant (desde backend/)
// ============================================================
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

// Mantener sincronizado con Database.Tables en packages/shared/src/types.ts.
// Las tablas que NO están acá (empresas, whatsapp_mensajes_procesados,
// notificaciones_preferencias) se acotan por otra columna, no por
// empresa_id — no aplica este chequeo.
const TABLAS_POR_EMPRESA = [
  "accesos_usuario", "agenda_pro_config", "agenda_pro_horarios", "analisis_fotos",
  "asistente_mensajes", "auditoria_usuarios",
  "catalogo_items", "catalogo_kit_items", "categorias_gasto", "centros_costo",
  "checklist_templates", "clientes", "documentos", "empresa_modulos", "equipos", "facturas",
  "gastos", "gastos_fijos", "informes_generados", "informes_personalizados",
  "integraciones", "inventario", "inventario_movimientos", "mensajes_personalizados",
  "notificaciones", "notificaciones_cliente_log", "notificaciones_config",
  "ordenes_servicio", "os_items", "paquetes_sesiones", "plantillas_documento", "portal_accesos",
  "portal_codigos", "presupuesto_items", "presupuestos", "proveedores",
  "rutas_planificadas", "suscripciones", "suscripcion_cobros", "tareas", "tipos_documento", "tipos_os", "tipos_trabajo",
  "trabajos", "unidades_medida", "usuarios", "vehiculo_asignaciones", "vehiculos",
  "viajes",
];

// Archivos completos excluidos del chequeo, con la razón — revisados a
// mano por separado, no siguen el patrón requiereAuth+requiereEmpresa.
const ARCHIVOS_EXCLUIDOS: Record<string, string> = {
  "encuestaPublica.ts": "público a propósito (link de encuesta por correo), se acota por id de trabajo, no por empresa",
  "portal.ts": "Portal de Cliente — se acota por el token/código propio, no por req.empresaId",
  "whatsapp.ts": "webhook entrante del bot — se acota resolviendo el chofer por teléfono, no por req.empresaId",
  "reservaPublica.ts": "reserva online pública, sin cuenta de Bitácora — se acota por :empresaId del path (validado vía empresaHabilitada), no por req.empresaId",
};

const VENTANA = 25; // líneas hacia adelante y atrás a inspeccionar

const rutasDir = join(__dirname, "..", "src", "routes");
const archivos = readdirSync(rutasDir).filter((f) => f.endsWith(".ts") && !(f in ARCHIVOS_EXCLUIDOS));

let totalRevisadas = 0;
let hallazgos = 0;

for (const archivo of archivos) {
  const ruta = join(rutasDir, archivo);
  const contenido = readFileSync(ruta, "utf8");
  const lineas = contenido.split("\n");

  lineas.forEach((linea, i) => {
    for (const tabla of TABLAS_POR_EMPRESA) {
      const patron = new RegExp(`\\.from\\((["'])${tabla}\\1\\)`);
      if (!patron.test(linea)) continue;
      totalRevisadas++;

      const desde = Math.max(0, i - VENTANA);
      const hasta = Math.min(lineas.length, i + VENTANA);
      const ventana = lineas.slice(desde, hasta).join("\n");

      // "tenant-ok" es una marca manual: se usó cuando revisé la línea a
      // mano y confirmé que el id ya viene validado más arriba en la
      // misma función (ej. un trabajoExiste()/rutaExiste() previo) — no
      // es un pase automático, cada una se puso después de leer el código.
      const tieneEmpresaId = /empresa_id/.test(ventana) || /desdeEmpresa\(/.test(ventana) || /tenant-ok/.test(ventana);
      if (!tieneEmpresaId) {
        hallazgos++;
        console.log(`⚠  ${archivo}:${i + 1}  .from("${tabla}")  — sin "empresa_id" en ±${VENTANA} líneas`);
      }
    }
  });
}

console.log(`\nArchivos revisados: ${archivos.length} (excluidos: ${Object.keys(ARCHIVOS_EXCLUIDOS).join(", ")})`);
console.log(`Ocurrencias de .from(tabla-de-empresa) revisadas: ${totalRevisadas}`);
console.log(hallazgos === 0 ? "Sin hallazgos." : `${hallazgos} hallazgo(s) — revisar a mano antes de confiar en el resultado.`);
process.exit(hallazgos === 0 ? 0 : 1);
