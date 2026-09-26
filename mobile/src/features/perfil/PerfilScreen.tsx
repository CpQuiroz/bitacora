import { useEffect, useState } from "react";
import Constants from "expo-constants";
import { Alert, Linking, Pressable, ScrollView, Share, Switch, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AlertCircle, ArrowLeft, Download } from "lucide-react-native";
import { tokens } from "@bitacora/design-tokens";
import type { Empresa } from "@bitacora/shared";
import { Button, Card, ScreenHeader, Select, Texto, useMarca } from "@bitacora/ui/native";
import { useAuth } from "../auth/AuthContext";
import { useRed } from "../../services/sync/NetworkProvider";
import { MAX_INTENTOS, ultimoErrorGlobal } from "../../services/sync/queue";
import { apiFetch, apiJson } from "../../services/api";
import { biometriaActivada, biometriaDisponible, nombreBiometria, pedirBiometria, setBiometriaActivada } from "../../lib/biometria";
import { preferencias, setPreferencia, suscribirPreferencias, type Preferencias } from "../../lib/preferencias";
import type { MasStackParamList } from "../../shell/navigation/types";

const WEB_URL = "https://app.transportesitineris.cl";

const ETIQUETA_ROL: Record<string, string> = {
  admin: "Administrador",
  supervisor: "Supervisor",
  colaborador: "Colaborador",
};
const ETIQUETA_FUNCION: Record<string, string> = {
  tecnico: "Técnico",
  chofer: "Chofer",
  instalador: "Instalador",
  administrativo: "Administrativo",
  otro: "Otro",
};

// Mismo dato que Configuración > Empresa en la web (empresas.tema,
// PATCH /api/empresa) — acá solo cambia color (ver theme/aplicarTema.ts;
// "Taller" en la web también cambia tipografía, en mobile por ahora no).
const OPCIONES_TEMA: { valor: Empresa["tema"]; etiqueta: string }[] = [
  { valor: "faena", etiqueta: "Faena (original)" },
  { valor: "taller", etiqueta: "Taller" },
  { valor: "confianza", etiqueta: "Confianza" },
];

// Sistema visual móvil v2 (14-sep-2026) — ScreenHeader propio (volver) +
// tokens/Texto/Card en vez de useTema()/components-ui viejo. El toggle
// on/off usa el `Switch` nativo de RN (no hay primitivo v2 para esto).
export function PerfilScreen({ navigation }: NativeStackScreenProps<MasStackParamList, "Perfil">) {
  const marca = useMarca();
  const auth = useAuth();
  const { enLinea, pendientes, fallidas, sincronizarAhora, reintentar, descartar, descartarTodo } = useRed();

  const [prefs, setPrefs] = useState<Preferencias>(preferencias());
  useEffect(() => suscribirPreferencias(setPrefs), []);

  const [bioDisponible, setBioDisponible] = useState(false);
  const [bioNombre, setBioNombre] = useState("biometría");
  const [bioActiva, setBioActiva] = useState(false);
  const [consentPend, setConsentPend] = useState(auth.fase === "listo" ? auth.consentimientoPendiente : false);
  const [ocupado, setOcupado] = useState(false);
  async function aceptarConsentimiento() {
    setOcupado(true);
    const r = await apiJson("/api/consentimiento", { method: "POST" });
    setOcupado(false);
    if (r.ok) setConsentPend(false);
    else Alert.alert("No se pudo guardar", "Intenta de nuevo con conexión.");
  }

  async function descargarMisDatos() {
    setOcupado(true);
    try {
      const res = await apiFetch("/api/usuarios/me/datos", {}, 30000);
      if (!res.ok) {
        Alert.alert("No se pudo generar", "Intenta de nuevo.");
        return;
      }
      const texto = await res.text();
      await Share.share({ message: texto });
    } catch {
      Alert.alert("Sin conexión", "Necesitas conexión para esto.");
    } finally {
      setOcupado(false);
    }
  }

  useEffect(() => {
    biometriaDisponible().then(setBioDisponible);
    nombreBiometria().then(setBioNombre);
    biometriaActivada().then(setBioActiva);
  }, []);

  const [temaGuardando, setTemaGuardando] = useState(false);
  const [temaError, setTemaError] = useState<string | null>(null);
  async function cambiarTema(nuevo: Empresa["tema"]) {
    setTemaGuardando(true);
    setTemaError(null);
    const r = await apiJson("/api/empresa", { method: "PATCH", body: JSON.stringify({ tema: nuevo }) });
    setTemaGuardando(false);
    if (!r.ok) {
      setTemaError("No se pudo guardar. Intenta de nuevo con conexión.");
      return;
    }
    // Refresca /api/me: al llegar el usuario.empresa.tema nuevo,
    // App.tsx (NavegacionConTema) remonta la navegación con la paleta
    // aplicada — ver theme/aplicarTema.ts.
    await auth.refrescar();
  }

  async function alternarBiometria() {
    if (bioActiva) {
      await setBiometriaActivada(false);
      setBioActiva(false);
      return;
    }
    const ok = await pedirBiometria(`Confirma con ${bioNombre} para activar el bloqueo`);
    if (!ok) {
      Alert.alert("No se pudo activar", "No se verificó tu identidad.");
      return;
    }
    await setBiometriaActivada(true);
    setBioActiva(true);
  }

  const volver = { icono: <ArrowLeft size={20} strokeWidth={2.5} color={tokens.color.text} />, onPress: () => navigation.goBack(), etiquetaAccesible: "Volver" };

  if (auth.fase !== "listo" && auth.fase !== "mfa-requerido" && auth.fase !== "prueba-vencida") {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
        <ScreenHeader titulo="Perfil" accion={volver} />
      </View>
    );
  }
  const u = auth.usuario;
  const tituloBio = bioNombre === "Face ID" ? "Bloquear con Face ID" : "Bloquear con huella";
  const iniciales = u.nombre.split(" ").slice(0, 2).map((s) => s[0]).join("").toUpperCase();

  return (
    <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
      <ScreenHeader titulo="Perfil" accion={volver} />
      <ScrollView contentContainerStyle={{ padding: tokens.space["4"], gap: tokens.space["4"], paddingBottom: tokens.space["8"] }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: tokens.space["3"] }}>
          <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: marca.secundarioSuave, alignItems: "center", justifyContent: "center" }}>
            <Texto tamano={tokens.size.body} peso="semibold" color={marca.secundarioFuerte}>
              {iniciales}
            </Texto>
          </View>
          <View style={{ flex: 1 }}>
            <Texto tamano={tokens.size.h4} color={tokens.color.text}>
              {u.nombre}
            </Texto>
            <Texto tamano={tokens.size.small} color={tokens.color.textSecondary}>
              {ETIQUETA_ROL[u.rol] ?? u.rol} · {u.empresa.nombre}
            </Texto>
          </View>
        </View>

        <Card>
          <View style={{ gap: 2 }}>
            {u.funcion ? <Fila etiqueta="Función" valor={ETIQUETA_FUNCION[u.funcion] ?? u.funcion} /> : null}
            {u.telefono ? <Fila etiqueta="Teléfono" valor={u.telefono} /> : null}
            {u.zona ? <Fila etiqueta="Zona" valor={u.zona} /> : null}
            <Fila etiqueta="Conexión" valor={enLinea ? "En línea" : "Sin conexión"} />
          </View>
        </Card>

        {/* Tema de la empresa (20-sep-2026) — solo admin, mismo criterio
            de acceso que Configuración > Empresa en la web. */}
        {u.rol === "admin" && auth.fase !== "prueba-vencida" && (
          <Card>
            <View style={{ gap: tokens.space["2"] }}>
              <Texto tamano={tokens.size.small} peso="semibold" color={tokens.color.text}>
                Tema de {u.empresa.nombre}
              </Texto>
              <Texto tamano={tokens.size.caption} color={tokens.color.textSecondary}>
                Cambia los colores de toda la app para tu equipo (se guarda para toda la empresa).
              </Texto>
              <Select
                valor={u.empresa.tema ?? "faena"}
                onCambio={(v) => cambiarTema(v as Empresa["tema"])}
                opciones={OPCIONES_TEMA}
                deshabilitado={temaGuardando}
              />
              {temaGuardando ? (
                <Texto tamano={tokens.size.caption} color={tokens.color.textSecondary}>
                  Guardando…
                </Texto>
              ) : null}
              {temaError ? (
                <Texto tamano={tokens.size.caption} color={tokens.color.accentRamp["700"]}>
                  {temaError}
                </Texto>
              ) : null}
            </View>
          </Card>
        )}

        {/* Diagnóstico (14-sep-2026): un error que escapa de procesar() sin
            que nadie lo capture desaparecía sin dejar rastro — "Reintentar
            ahora" no mostraba nada. Esto expone el último de esos errores
            aunque haya pasado en un reintento automático, no solo al tocar
            el botón. */}
        {ultimoErrorGlobal() ? (
          <View style={{ backgroundColor: tokens.color.accentRamp["200"], borderRadius: tokens.radius.md, padding: tokens.space["4"], gap: tokens.space["1"] }}>
            <Texto tamano={tokens.size.small} peso="semibold" color={tokens.color.accentRamp["800"]}>
              Error inesperado al sincronizar
            </Texto>
            <Texto tamano={tokens.size.caption} color={tokens.color.accentRamp["800"]}>
              {ultimoErrorGlobal()}
            </Texto>
          </View>
        ) : null}

        {/* Cola de sincronización detallada */}
        {pendientes.length > 0 && auth.fase === "prueba-vencida" ? (
          <Texto tamano={tokens.size.caption} color={tokens.color.textSecondary}>
            Lo que quedó sin enviar está guardado en este teléfono y se envía solo cuando tu empresa vuelva a estar activa.
          </Texto>
        ) : null}
        {pendientes.length > 0 && (
          <View style={{ backgroundColor: tokens.color.surface, borderRadius: tokens.radius.md, padding: tokens.space["4"], gap: tokens.space["2"] }}>
            <Texto tamano={tokens.size.caption} peso="semibold" color={tokens.color.textSecondary} style={{ textTransform: "uppercase", letterSpacing: 1 }}>
              {pendientes.length} sin enviar
            </Texto>
            {pendientes.map((a) => (
              <View key={a.id} style={{ borderTopWidth: 1, borderTopColor: tokens.color.divider, paddingTop: tokens.space["2"] }}>
                <Texto tamano={tokens.size.small} peso="medium" color={tokens.color.text}>
                  {a.etiqueta}
                </Texto>
                <Texto tamano={tokens.size.caption} color={tokens.color.textSecondary} style={{ fontVariant: ["tabular-nums"] }}>
                  {a.creadoEn ? new Date(a.creadoEn).toLocaleString("es-CL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : ""}
                  {a.archivo || a.archivos?.length ? " · con foto adjunta" : ""}
                </Texto>
                {/* Bug real (14-sep-2026): esto mostraba el error solo si
                    a.intentos > 0 — pero un error normal de red (no timeout,
                    ver queue.ts) NUNCA incrementa intentos a propósito (para
                    no gastar los 6 intentos por un simple "sin señal"), así
                    que un error real y persistente (ej. el de FormDataPart
                    encontrado hoy) quedaba invisible para siempre, con
                    intentos en 0. Ahora se muestra el error si existe,
                    independientemente de intentos. */}
                {a.ultimoError ? (
                  <Texto tamano={tokens.size.caption} color={tokens.color.accentRamp["700"]}>
                    {a.intentos > 0 ? `Intento ${a.intentos} de ${MAX_INTENTOS} — ` : ""}
                    {a.ultimoError}
                  </Texto>
                ) : null}
              </View>
            ))}
            <View style={{ flexDirection: "row", gap: tokens.space["2"], marginTop: tokens.space["2"] }}>
              <View style={{ flex: 1 }}>
                <Button variante="secundario" bloque onPress={sincronizarAhora}>
                  Reintentar ahora
                </Button>
              </View>
              {/* Tarea 144: con la prueba vencida lo pendiente se guarda y sale
                  solo al reactivarse la empresa — no se ofrece descartarlo. */}
              {auth.fase === "prueba-vencida" ? null : (
                <Button
                  variante="ghost"
                  onPress={() =>
                    Alert.alert("Descartar lo pendiente", `Se borran ${pendientes.length} acción(es). Úsalo solo si quedó algo trancado que ya no necesitas.`, [
                      { text: "No", style: "cancel" },
                      { text: "Sí, descartar", style: "destructive", onPress: descartarTodo },
                    ])
                  }
                >
                  Descartar
                </Button>
              )}
            </View>
          </View>
        )}

        {fallidas.length > 0 && (
          <View style={{ backgroundColor: tokens.color.accentRamp["200"], borderRadius: tokens.radius.md, padding: tokens.space["4"], gap: tokens.space["1"] }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: tokens.space["2"], marginBottom: tokens.space["1"] }}>
              <AlertCircle size={18} strokeWidth={2.25} color={tokens.color.accentRamp["800"]} />
              <Texto tamano={tokens.size.small} peso="semibold" color={tokens.color.accentRamp["800"]}>
                No se pudieron enviar
              </Texto>
            </View>
            <Texto tamano={tokens.size.caption} color={tokens.color.accentRamp["800"]} style={{ marginBottom: tokens.space["1"] }}>
              Estas acciones fallaron varias veces. Reinténtalas o, si ya no aplican, descártalas.
            </Texto>
            {fallidas.map((a) => (
              <View key={a.id} style={{ borderTopWidth: 1, borderTopColor: tokens.color.accentRamp["800"] + "33", paddingVertical: tokens.space["3"], gap: tokens.space["2"] }}>
                <Texto tamano={tokens.size.small} peso="semibold" color={tokens.color.accentRamp["800"]}>
                  {a.etiqueta}
                </Texto>
                {a.ultimoError ? (
                  <Texto tamano={tokens.size.caption} color={tokens.color.accentRamp["800"]}>
                    {a.ultimoError}
                  </Texto>
                ) : null}
                <View style={{ flexDirection: "row", gap: tokens.space["2"] }}>
                  <Button variante="secundario" onPress={() => reintentar(a.id)}>
                    Reintentar
                  </Button>
                  {auth.fase === "prueba-vencida" ? null : (
                    <Button variante="ghost" onPress={() => descartar(a.id)}>
                      Descartar
                    </Button>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        {bioDisponible && (
          <Card>
            <Pressable
              onPress={alternarBiometria}
              hitSlop={8}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: tokens.space["3"],
                minHeight: 44,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <Texto tamano={tokens.size.small} peso="medium" color={tokens.color.text}>
                  {tituloBio}
                </Texto>
                <Texto tamano={tokens.size.caption} color={tokens.color.textSecondary}>
                  Pide tu {bioNombre} al abrir la app.
                </Texto>
              </View>
              <Switch value={bioActiva} onValueChange={alternarBiometria} trackColor={{ true: marca.base, false: tokens.color.divider }} />
            </Pressable>
          </Card>
        )}

        {consentPend && (
          <View style={{ backgroundColor: tokens.color.accent2Ramp["200"], borderRadius: tokens.radius.md, padding: tokens.space["4"], gap: tokens.space["2"] }}>
            <Texto tamano={tokens.size.small} peso="semibold" color={tokens.color.accent2Ramp["800"]}>
              Política de Privacidad actualizada
            </Texto>
            <Texto tamano={tokens.size.caption} color={tokens.color.accent2Ramp["800"]}>
              Revisá y aceptá la Política de Privacidad y los Términos.
            </Texto>
            <View style={{ flexDirection: "row", gap: tokens.space["2"] }}>
              <Button onPress={aceptarConsentimiento} cargando={ocupado}>
                Aceptar
              </Button>
              <Button variante="secundario" onPress={() => Linking.openURL(`${WEB_URL}/privacidad`)}>
                Ver
              </Button>
            </View>
          </View>
        )}

        <Card>
          <Pressable
            onPress={descargarMisDatos}
            hitSlop={8}
            style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: tokens.space["3"], minHeight: 44, opacity: pressed ? 0.7 : 1 })}
          >
            <Download size={22} strokeWidth={2} color={tokens.color.textSecondary} />
            <View style={{ flex: 1 }}>
              <Texto tamano={tokens.size.small} peso="medium" color={tokens.color.text}>
                Mis datos personales
              </Texto>
              <Texto tamano={tokens.size.caption} color={tokens.color.textSecondary}>
                Descargá todo lo que Bitácora guarda sobre vos.
              </Texto>
            </View>
          </Pressable>
        </Card>

        <Card>
          <View style={{ gap: tokens.space["1"] }}>
            <Interruptor
              titulo="Descargar el día al abrir"
              sub="Precarga lo de hoy apenas abres la app."
              valor={prefs.descargarDiaAlAbrir}
              onCambiar={(v) => setPreferencia("descargarDiaAlAbrir", v)}
            />
            <Interruptor
              titulo="Subir fotos solo con WiFi"
              sub="En datos móviles las fotos esperan en la cola."
              valor={prefs.fotosSoloWifi}
              onCambiar={(v) => setPreferencia("fotosSoloWifi", v)}
            />
          </View>
        </Card>

        <Texto tamano={tokens.size.caption} color={tokens.color.textSecondary} style={{ textAlign: "center", fontVariant: ["tabular-nums"] }}>
          Bitácora {Constants.expoConfig?.version ?? ""}
        </Texto>

        <Button variante="peligro" bloque onPress={auth.cerrarSesion}>
          Cerrar sesión
        </Button>
      </ScrollView>
    </View>
  );
}

function Interruptor({ titulo, sub, valor, onCambiar }: { titulo: string; sub: string; valor: boolean; onCambiar: (v: boolean) => void }) {
  const marca = useMarca();
  return (
    <Pressable
      onPress={() => onCambiar(!valor)}
      hitSlop={8}
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: tokens.space["3"], minHeight: 46, opacity: pressed ? 0.7 : 1 })}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Texto tamano={tokens.size.small} peso="medium" color={tokens.color.text}>
          {titulo}
        </Texto>
        <Texto tamano={tokens.size.caption} color={tokens.color.textSecondary}>
          {sub}
        </Texto>
      </View>
      <Switch value={valor} onValueChange={onCambiar} trackColor={{ true: marca.base, false: tokens.color.divider }} />
    </Pressable>
  );
}

function Fila({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 }}>
      <Texto tamano={tokens.size.small} color={tokens.color.textSecondary}>
        {etiqueta}
      </Texto>
      <Texto tamano={tokens.size.small} peso="medium" color={tokens.color.text}>
        {valor}
      </Texto>
    </View>
  );
}
