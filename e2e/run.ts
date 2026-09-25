// Corre todas las suites E2E en una empresa aislada y la borra al final.
// Uso (con el backend local corriendo contra DEV):  npm run e2e
// Solo algunas suites:                              npm run e2e -- viaticos roles
import { esperarBackend, limpiar, provisionar, type Ctx, type Resultado } from "./entorno";
import { clientesEliminar } from "./suites/clientesEliminar";
import { viajesMonto } from "./suites/viajesMonto";
import { viajesAsignarChofer } from "./suites/viajesAsignarChofer";
import { cobroMultiViaje } from "./suites/cobroMultiViaje";
import { revisionParteA } from "./suites/revisionParteA";
import { viaticos } from "./suites/viaticos";
import { roles } from "./suites/roles";
import { whatsappChofer } from "./suites/whatsappChofer";
import { tarifasViajes } from "./suites/tarifasViajes";
import { precioViajes } from "./suites/precioViajes";

const SUITES: Record<string, (ctx: Ctx) => Promise<void>> = {
  clientesEliminar,
  viajesMonto,
  viajesAsignarChofer,
  cobroMultiViaje,
  revisionParteA,
  viaticos,
  roles,
  whatsappChofer,
  tarifasViajes,
  precioViajes,
};

async function main(): Promise<number> {
  const pedidas = process.argv.slice(2);
  const aCorrer = pedidas.length ? pedidas : Object.keys(SUITES);
  const desconocidas = aCorrer.filter((n) => !SUITES[n]);
  if (desconocidas.length) throw new Error(`Suites desconocidas: ${desconocidas.join(", ")}. Hay: ${Object.keys(SUITES).join(", ")}`);

  await esperarBackend();
  const resultados: Resultado[] = [];
  const ctx = await provisionar(resultados);
  try {
    for (const nombre of aCorrer) {
      const antes = resultados.length;
      try {
        await SUITES[nombre]!(ctx);
      } catch (e) {
        resultados.push({ ok: false, nombre: `${nombre}: se cayó`, detalle: e instanceof Error ? e.stack ?? e.message : String(e) });
      }
      const propios = resultados.slice(antes);
      console.log(`\n── ${nombre}: ${propios.filter((r) => r.ok).length}/${propios.length}`);
      for (const r of propios) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.nombre}${r.ok ? "" : `  →  ${r.detalle}`}`);
    }
  } finally {
    await limpiar(ctx);
  }
  const fallas = resultados.filter((r) => !r.ok).length;
  console.log(`\nTotal: ${resultados.length - fallas}/${resultados.length} OK${fallas ? ` — ${fallas} FALLA(S)` : ""}`);
  return fallas ? 1 : 0;
}

main()
  .then((codigo) => process.exit(codigo))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
