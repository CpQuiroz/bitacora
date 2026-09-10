#!/usr/bin/env bash
# verificar.sh — Verificación del entorno de Bitácora (el "arnés")
#
# Lo corre el agente al EMPEZAR una sesión y antes de declarar cualquier
# tarea como `done`. Si termina con exit != 0, la sesión no debe avanzar.
#
#   [OK]    check pasó
#   [WARN]  roto de antes / no bloqueante — hay tarea abierta para ello
#   [FAIL]  hay que arreglarlo ya — hace fallar el script
#
# Uso:  ./verificar.sh            (todo)
#       ./verificar.sh --rapido   (salta mobile tsc y tests, para iterar)

set -u
cd "$(dirname "$0")"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[0;33m'; NC='\033[0m'
ok()   { printf "${GREEN}[OK]${NC}    %s\n" "$1"; }
warn() { printf "${YELLOW}[WARN]${NC}  %s\n" "$1"; }
fail() { printf "${RED}[FAIL]${NC}  %s\n" "$1"; }

EXIT_CODE=0
RAPIDO=0
[ "${1:-}" = "--rapido" ] && RAPIDO=1

# audit:tenant: baseline 0 desde 2026-09-09 (tarea #7 — los 6 hallazgos
# preexistentes se revisaron y marcaron con `// tenant-ok:`). Si aparece un
# hallazgo nuevo, revisá el .from(<tabla-empresa>): o le falta el filtro por
# empresa_id, o es legítimo y lleva `// tenant-ok: <razón>` a ±25 líneas.
BASELINE_TENANT=0

echo "── 1. Entorno ─────────────────────────────────────────"
if ! command -v node >/dev/null 2>&1; then fail "node no instalado"; exit 1; fi
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 22 ]; then
  fail "Node $NODE_MAJOR — se requiere >= 22 (backend/package.json)"; EXIT_CODE=1
else
  ok "node -> $(node -v)"
fi

echo ""
echo "── 2. Archivos base del arnés ─────────────────────────"
for f in AGENTS.md CLAUDE.md CHECKPOINTS.md trabajo_list.json \
         progress/current.md progress/history.md \
         docs/harness/arquitectura.md docs/harness/convenciones.md \
         docs/harness/verificacion.md; do
  [ -f "$f" ] && ok "Existe $f" || { fail "Falta $f"; EXIT_CODE=1; }
done

echo ""
echo "── 3. trabajo_list.json ───────────────────────────────"
node -e '
  const d = require("./trabajo_list.json");
  const valid = new Set(["pending","in_progress","done","blocked"]);
  const wip = (d.tareas||[]).filter(t => t.status === "in_progress");
  if (wip.length > 1) { console.log("[FAIL]  " + wip.length + " tareas in_progress (máx 1): " + wip.map(t=>t.id).join(", ")); process.exit(1); }
  for (const t of d.tareas||[]) if (!valid.has(t.status)) { console.log("[FAIL]  estado inválido en " + t.id + ": " + t.status); process.exit(1); }
  console.log("[OK]    válido — " + (d.tareas||[]).length + " tareas, " + wip.length + " en curso");
' || EXIT_CODE=1

echo ""
echo "── 4. Type-check (tsc --noEmit) ───────────────────────"
tsc_check() {
  local nombre="$1" proj="$2"
  if npx tsc -p "$proj" --noEmit >/tmp/harness_tsc_$nombre.log 2>&1; then
    ok "tsc $nombre"
  else
    fail "tsc $nombre — ver /tmp/harness_tsc_$nombre.log"
    tail -12 /tmp/harness_tsc_$nombre.log
    EXIT_CODE=1
  fi
}
tsc_check tokens   packages/design-tokens/tsconfig.json
tsc_check backend  backend/tsconfig.json
tsc_check shared   packages/shared/tsconfig.json
tsc_check web      web/tsconfig.json
if [ $RAPIDO -eq 0 ]; then
  tsc_check mobile mobile/tsconfig.json
else
  warn "tsc mobile salteado (--rapido)"
fi

echo ""
echo "── 5. Tests ──────────────────────────────────────────"
if [ $RAPIDO -eq 1 ]; then
  warn "tests salteados (--rapido)"
else
  test_ws() {
    local ws="$1"
    if npm run test -w "$ws" --silent >/tmp/harness_tests_$(basename "$ws").log 2>&1; then
      PASS="$(grep -Eo '# pass [0-9]+' /tmp/harness_tests_$(basename "$ws").log | grep -Eo '[0-9]+' | tail -1)"
      ok "$ws — ${PASS:-?} tests verdes"
    else
      fail "$ws tests — ver /tmp/harness_tests_$(basename "$ws").log"
      tail -15 /tmp/harness_tests_$(basename "$ws").log
      EXIT_CODE=1
    fi
  }
  test_ws packages/shared
  test_ws packages/design-tokens
  # A medida que backend/web/mobile ganen suite, agregá acá sus runners.
fi

echo ""
echo "── 6. Lint web ───────────────────────────────────────"
if npm run lint -w web --silent >/tmp/harness_lint.log 2>&1; then
  ok "eslint web"
else
  if grep -q "next/dist/compiled/babel/eslint-parser" /tmp/harness_lint.log; then
    warn "eslint web roto por resolución de 'eslint-config-next' (Next 16) — tarea aparte, no bloquea"
  else
    fail "eslint web — ver /tmp/harness_lint.log"
    tail -15 /tmp/harness_lint.log
    EXIT_CODE=1
  fi
fi

echo ""
echo "── 7. Aislamiento multi-tenant (audit:tenant) ─────────"
npm run audit:tenant -w backend --silent >/tmp/harness_tenant.log 2>&1
HALLAZGOS="$(grep -Eo '^[0-9]+ hallazgo' /tmp/harness_tenant.log | grep -Eo '^[0-9]+' | head -1)"
HALLAZGOS="${HALLAZGOS:-0}"
if [ "$HALLAZGOS" -gt "$BASELINE_TENANT" ]; then
  fail "audit:tenant — $HALLAZGOS hallazgos (baseline $BASELINE_TENANT). Revisá los nuevos .from(<tabla-empresa>) sin empresa_id."
  grep '⚠' /tmp/harness_tenant.log | tail -20
  EXIT_CODE=1
elif [ "$HALLAZGOS" -lt "$BASELINE_TENANT" ]; then
  warn "audit:tenant — $HALLAZGOS hallazgos (< baseline $BASELINE_TENANT). Bajá BASELINE_TENANT en este script."
else
  ok "audit:tenant — $HALLAZGOS hallazgos (baseline)"
fi

echo ""
echo "── 8. Sistema de diseño ──────────────────────────────"
# Idempotencia: si regenerar cambia los artefactos, tokens.json se tocó
# sin correr gen. (Comparar contra HEAD daría falso positivo cuando hay
# cambios de tokens legítimamente sin commitear.)
ANTES="$(cat packages/design-tokens/tokens.css packages/design-tokens/src/generated.ts | shasum)"
npm run gen:tokens --silent >/dev/null 2>&1
DESPUES="$(cat packages/design-tokens/tokens.css packages/design-tokens/src/generated.ts | shasum)"
if [ "$ANTES" = "$DESPUES" ]; then
  ok "tokens.css y generated.ts al día con tokens.json"
else
  fail "tokens.css / generated.ts desactualizados — corré 'npm run gen:tokens' y commiteá"
  EXIT_CODE=1
fi
if node scripts/check-colores.mjs; then
  :
else
  fail "colores literales nuevos — ver arriba"
  EXIT_CODE=1
fi

echo ""
echo "── 9. Migraciones ────────────────────────────────────"
node -e '
  const fs = require("fs");
  const files = fs.readdirSync("supabase/migrations").filter(f => f.endsWith(".sql"));
  const nums = files.map(f => parseInt(f.split("_")[0], 10)).filter(n => !isNaN(n)).sort((a,b)=>a-b);
  const dups = nums.filter((n,i) => nums.indexOf(n) !== i);
  if (dups.length) { console.log("[FAIL]  números de migración duplicados: " + [...new Set(dups)].join(", ")); process.exit(1); }
  const huecos = [];
  for (let i = 1; i < nums.length; i++) if (nums[i] !== nums[i-1] + 1) huecos.push(nums[i-1] + "→" + nums[i]);
  if (huecos.length) console.log("[WARN]  huecos en la numeración: " + huecos.join(", "));
  console.log("[OK]    " + files.length + " migraciones, última = " + nums[nums.length-1] + " (sync con prod lo valida el CI check-migraciones-prod)");
' || EXIT_CODE=1

echo ""
echo "── Resumen ───────────────────────────────────────────"
if [ $EXIT_CODE -eq 0 ]; then
  ok "Entorno listo. Podés trabajar."
else
  fail "Entorno NO listo. Resolvé los [FAIL] antes de avanzar."
fi
exit $EXIT_CODE
