// ============================================================
// Crea un Super-Admin — acción manual, offline, deliberadamente sin
// endpoint HTTP (no hay auto-registro para esta identidad).
//
// Uso: npx tsx scripts/crear-superadmin.ts <correo> <nombre>
// Pide el password por stdin (no como argumento, para que no quede en
// el historial de la shell). Al final imprime la key TOTP para
// cargarla a mano en Google Authenticator/Authy/1Password — no hace
// falta un lector de QR, todas aceptan entrada manual.
// ============================================================
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { supabase } from "../src/supabase";
import { env } from "../src/env";
import { cifrarJson } from "../src/crypto";
import { hashPassword } from "../src/superadmin/passwords";
import { generarSecretoTotp, otpauthUri } from "../src/superadmin/totp";

// Enmascara lo que se tipea con "*" — readline no lo hace por
// default. Usa el truco estándar de la comunidad Node (interceptar
// _writeToOutput, no documentado pero estable hace años) para no
// sumar una dependencia solo para esto.
async function preguntarPasswordOculto(pregunta: string): Promise<string> {
  const rl = createInterface({ input: stdin, output: stdout });
  const rlInterno = rl as unknown as { _writeToOutput: (s: string) => void; output: NodeJS.WritableStream };
  let promptYaEscrito = false;
  rlInterno._writeToOutput = (fragmento: string) => {
    if (!promptYaEscrito) {
      rlInterno.output.write(fragmento);
      if (fragmento === pregunta) promptYaEscrito = true;
    } else {
      rlInterno.output.write("*");
    }
  };
  const respuesta = await rl.question(pregunta);
  rl.close();
  stdout.write("\n");
  return respuesta;
}

async function main() {
  const [correo, ...resto] = process.argv.slice(2);
  const nombre = resto.join(" ");
  if (!correo || !nombre) {
    console.error("Uso: npx tsx scripts/crear-superadmin.ts <correo> <nombre>");
    process.exit(1);
  }

  const password = await preguntarPasswordOculto("Password (mínimo 12 caracteres): ");
  if (password.length < 12) {
    console.error("El password debe tener al menos 12 caracteres.");
    process.exit(1);
  }

  const secretoTotp = generarSecretoTotp();
  const { data, error } = await supabase
    .from("super_admins")
    .insert({
      correo: correo.trim().toLowerCase(),
      nombre,
      password_hash: hashPassword(password),
      totp_secreto: cifrarJson({ secreto: secretoTotp }, env.SUPERADMIN_ENCRYPTION_KEY, "SUPERADMIN_ENCRYPTION_KEY"),
    })
    .select("id")
    .single();

  if (error) {
    console.error("Error creando el super-admin:", error.message);
    process.exit(1);
  }

  console.log("\nSuper-admin creado:", data.id);
  console.log("\nCarga esto en tu app de autenticación (Google Authenticator, Authy, 1Password...):");
  console.log("  Key manual:", secretoTotp);
  console.log("  URI completa:", otpauthUri(secretoTotp, correo));
  console.log("\nEsta key no se puede volver a mostrar — si la pierdes, hay que generar una nueva (correr este script de nuevo genera un super-admin distinto; para resetear el TOTP de este mismo, se actualiza directo en la base).");
}

main();
