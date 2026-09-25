// ============================================================
// Pruebas completas contra el backend + Supabase DEV (tarea 127, capa 3).
//
// Autosuficientes: cada corrida crea su propia empresa "E2E …" con sus
// usuarios (admin, supervisor, técnico y dos choferes), corre las suites y
// al final la borra (la empresa arrastra en cascada todo lo que cuelga de
// ella; las cuentas de Auth se borran aparte). Nunca toca otras empresas.
//
// Se niega a correr contra prod. Requisitos: backend/.env apuntando a DEV
// (service role) y el backend corriendo (E2E_API_URL, por defecto
// http://localhost:8080). Clave pública de Supabase: E2E_SUPABASE_ANON_KEY
// o, en local, la de web/.env.local.
// ============================================================
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { FuncionColaborador } from "@bitacora/shared";
import { supabase } from "../backend/src/supabase";
import { env } from "../backend/src/env";
import { activarModulosDePrueba } from "../backend/src/planes";

const REF_PROD = "yjbskbskyadxjooxngjv";
if (env.SUPABASE_URL.includes(REF_PROD)) throw new Error("Las pruebas E2E no corren contra prod.");

export const API = process.env.E2E_API_URL ?? "http://localhost:8080";

function claveAnonima(): string {
  if (process.env.E2E_SUPABASE_ANON_KEY) return process.env.E2E_SUPABASE_ANON_KEY;
  const archivo = path.resolve(__dirname, "../web/.env.local");
  const m = fs.existsSync(archivo) ? fs.readFileSync(archivo, "utf8").match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/) : null;
  if (!m) throw new Error("Falta E2E_SUPABASE_ANON_KEY (o web/.env.local con NEXT_PUBLIC_SUPABASE_ANON_KEY).");
  return m[1]!.trim();
}

export type Quien = "admin" | "supervisor" | "tecnico" | "chofer" | "chofer2";
type Usuario = { id: string; correo: string; password: string; nombre: string };

export type Ctx = {
  empresaId: string;
  u: Record<Quien, Usuario>;
  sesion: (q: Quien) => Promise<string>;
  api: (token: string, metodo: string, ruta: string, body?: unknown) => Promise<{ s: number; j: any }>; // eslint-disable-line @typescript-eslint/no-explicit-any
  check: (nombre: string, ok: boolean, detalle?: string) => void;
  hoy: string;
};

// Sesión de Supabase Auth con correo y clave (usuarios de las pruebas).
export async function tokenDe(correo: string, password: string): Promise<string> {
  const r = await fetch(`${env.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: claveAnonima(), "Content-Type": "application/json" },
    body: JSON.stringify({ email: correo, password }),
  }).then((x) => x.json());
  if (!r.access_token) throw new Error(`Sin sesión para ${correo}`);
  return r.access_token as string;
}

export type Resultado = { ok: boolean; nombre: string; detalle: string };

export async function esperarBackend(): Promise<void> {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(`${API}/health`)).ok) return;
    } catch {
      // arrancando
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`El backend no responde en ${API}/health`);
}

const PERFILES: { quien: Quien; rol: "admin" | "supervisor" | "colaborador"; funcion?: FuncionColaborador; mfa?: boolean }[] = [
  { quien: "admin", rol: "admin", mfa: true },
  { quien: "supervisor", rol: "supervisor" },
  { quien: "tecnico", rol: "colaborador", funcion: "tecnico" },
  { quien: "chofer", rol: "colaborador", funcion: "chofer" },
  { quien: "chofer2", rol: "colaborador", funcion: "chofer" },
];

export async function provisionar(resultados: Resultado[]): Promise<Ctx> {
  const marca = `${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "")}-${crypto.randomBytes(3).toString("hex")}`;
  const { data: empresa, error } = await supabase
    .from("empresas")
    .insert({ nombre: `E2E ${marca}`, rubro: "servicio_tecnico", plan: "pro" })
    .select("id")
    .single();
  if (error || !empresa) throw new Error(`No se pudo crear la empresa E2E: ${error?.message}`);
  await activarModulosDePrueba(empresa.id);

  const u = {} as Record<Quien, Usuario>;
  for (const p of PERFILES) {
    const correo = `e2e-${marca}-${p.quien}@bitacora-e2e.test`;
    const password = `E2e-${crypto.randomBytes(12).toString("base64url")}9`;
    const nombre = `E2E ${p.quien}`;
    const { data, error: eAuth } = await supabase.auth.admin.createUser({ email: correo, password, email_confirm: true });
    if (eAuth || !data.user) throw new Error(`auth ${p.quien}: ${eAuth?.message}`);
    const { error: eUsr } = await supabase.from("usuarios").insert({
      id: data.user.id,
      empresa_id: empresa.id,
      nombre,
      rol: p.rol,
      activo: true,
      ...(p.funcion ? { funcion: p.funcion } : {}),
      // El Admin exige 2FA (roles.requiere_2fa): se marca activado para que
      // el gate de requiereEmpresa lo deje pasar en las pruebas.
      ...(p.mfa ? { mfa_activado: true, mfa_metodo: "email" } : {}),
    });
    if (eUsr) throw new Error(`usuarios ${p.quien}: ${eUsr.message}`);
    u[p.quien] = { id: data.user.id, correo, password, nombre };
  }

  const cache = new Map<Quien, string>();
  const sesion = async (q: Quien) => {
    const guardada = cache.get(q);
    if (guardada) return guardada;
    const token = await tokenDe(u[q].correo, u[q].password);
    cache.set(q, token);
    return token;
  };
  const api: Ctx["api"] = async (token, metodo, ruta, body) => {
    const r = await fetch(`${API}${ruta}`, {
      method: metodo,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    let j = null;
    try {
      j = await r.json();
    } catch {
      // sin cuerpo (204)
    }
    return { s: r.status, j };
  };
  const check: Ctx["check"] = (nombre, ok, detalle = "") => resultados.push({ ok, nombre, detalle });
  return { empresaId: empresa.id, u, sesion, api, check, hoy: new Date().toISOString().slice(0, 10) };
}

export async function limpiar(ctx: Pick<Ctx, "empresaId" | "u">): Promise<void> {
  // La empresa arrastra en cascada usuarios, viajes, gastos, cobros, etc.
  const { error } = await supabase.from("empresas").delete().eq("id", ctx.empresaId);
  if (error) console.error(`No se pudo borrar la empresa E2E ${ctx.empresaId}: ${error.message}`);
  for (const usuario of Object.values(ctx.u)) {
    const { error: e } = await supabase.auth.admin.deleteUser(usuario.id);
    if (e) console.error(`No se pudo borrar la cuenta ${usuario.correo}: ${e.message}`);
  }
}

export { supabase };
