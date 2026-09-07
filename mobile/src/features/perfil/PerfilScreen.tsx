import { useEffect, useState } from "react";
import Constants from "expo-constants";
import { Alert, Linking, Pressable, Share, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTema } from "../../theme";
import { Button, Card, Screen, Text } from "../../components/ui";
import { useAuth } from "../auth/AuthContext";
import { useRed } from "../../services/sync/NetworkProvider";
import { apiFetch, apiJson } from "../../services/api";
import { biometriaActivada, biometriaDisponible, nombreBiometria, pedirBiometria, setBiometriaActivada } from "../../lib/biometria";
import { preferencias, setPreferencia, suscribirPreferencias, type Preferencias } from "../../lib/preferencias";

const WEB_URL = "https://app.transportesitineris.cl";

const ETIQUETA_ROL: Record<string, string> = {
  admin: "Administrador",
  supervisor: "Supervisor",
  contador: "Contador",
  colaborador: "Colaborador",
};
const ETIQUETA_FUNCION: Record<string, string> = {
  tecnico: "Técnico",
  chofer: "Chofer",
  instalador: "Instalador",
  administrativo: "Administrativo",
  otro: "Otro",
};

export function PerfilScreen() {
  const t = useTema();
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

  if (auth.fase !== "listo" && auth.fase !== "mfa-requerido") return null;
  const u = auth.usuario;
  const tituloBio = bioNombre === "Face ID" ? "Bloquear con Face ID" : "Bloquear con huella";
  const iniciales = u.nombre.split(" ").slice(0, 2).map((s) => s[0]).join("").toUpperCase();

  return (
    <Screen scroll style={{ gap: t.espacio(4) }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: t.espacio(3) }}>
        <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: t.colores.brandSoft, alignItems: "center", justifyContent: "center" }}>
          <Text weight="bold" tono="brand">
            {iniciales}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text variante="titulo">{u.nombre}</Text>
          <Text variante="etiqueta" tono="muted">
            {ETIQUETA_ROL[u.rol] ?? u.rol} · {u.empresa.nombre}
          </Text>
        </View>
      </View>

      <Card>
        {u.funcion ? <Fila etiqueta="Función" valor={ETIQUETA_FUNCION[u.funcion] ?? u.funcion} /> : null}
        {u.telefono ? <Fila etiqueta="Teléfono" valor={u.telefono} /> : null}
        {u.zona ? <Fila etiqueta="Zona" valor={u.zona} /> : null}
        <Fila etiqueta="Conexión" valor={enLinea ? "En línea" : "Sin conexión"} />
      </Card>

      {/* Cola de sincronización detallada */}
      {pendientes.length > 0 && (
        <View style={{ backgroundColor: t.colores.accentSoft, borderRadius: t.radio.md, padding: t.espacio(4), gap: t.espacio(2) }}>
          <Text variante="etiqueta" weight="semibold" style={{ color: t.colores.warning, textTransform: "uppercase" }}>
            {pendientes.length} sin enviar
          </Text>
          {pendientes.map((a) => (
            <View key={a.id} style={{ borderTopWidth: 1, borderTopColor: "rgba(138,74,16,0.15)", paddingTop: t.espacio(2) }}>
              <Text variante="etiqueta" weight="medium">
                {a.etiqueta}
              </Text>
              <Text mono variante="caption" tono="muted">
                {a.creadoEn ? new Date(a.creadoEn).toLocaleString("es-CL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : ""}
                {a.archivo ? " · con foto adjunta" : ""}
              </Text>
            </View>
          ))}
          <View style={{ flexDirection: "row", gap: t.espacio(2), marginTop: t.espacio(2) }}>
            <Button titulo="Reintentar ahora" variante="secundario" onPress={sincronizarAhora} style={{ flex: 1 }} />
            <Button
              titulo="Descartar"
              variante="ghost"
              onPress={() =>
                Alert.alert("Descartar lo pendiente", `Se borran ${pendientes.length} acción(es). Úsalo solo si quedó algo trancado que ya no necesitas.`, [
                  { text: "No", style: "cancel" },
                  { text: "Sí, descartar", style: "destructive", onPress: descartarTodo },
                ])
              }
            />
          </View>
        </View>
      )}

      {fallidas.length > 0 && (
        <Card style={{ borderColor: t.colores.danger, backgroundColor: t.colores.dangerSoft }} plano>
          <View style={{ flexDirection: "row", alignItems: "center", gap: t.espacio(2), marginBottom: t.espacio(3) }}>
            <Ionicons name="alert-circle-outline" size={18} color={t.colores.danger} />
            <Text variante="etiqueta" weight="semibold" style={{ color: t.colores.danger }}>
              No se pudieron enviar
            </Text>
          </View>
          <Text variante="caption" tono="muted" style={{ marginBottom: t.espacio(3) }}>
            Estas acciones fallaron varias veces. Reinténtalas o, si ya no aplican, descártalas.
          </Text>
          {fallidas.map((a) => (
            <View
              key={a.id}
              style={{
                borderTopWidth: 1,
                borderTopColor: t.colores.border,
                paddingVertical: t.espacio(3),
                gap: t.espacio(2),
              }}
            >
              <Text variante="etiqueta" weight="semibold">
                {a.etiqueta}
              </Text>
              {a.ultimoError ? (
                <Text variante="caption" tono="danger">
                  {a.ultimoError}
                </Text>
              ) : null}
              <View style={{ flexDirection: "row", gap: t.espacio(2.5) }}>
                <Button titulo="Reintentar" variante="secundario" tamano="md" onPress={() => reintentar(a.id)} />
                <Button titulo="Descartar" variante="ghost" onPress={() => descartar(a.id)} />
              </View>
            </View>
          ))}
        </Card>
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
              gap: t.espacio(3),
              minHeight: 44,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <View style={{ flex: 1, gap: 2 }}>
              <Text variante="etiqueta" weight="medium">
                {tituloBio}
              </Text>
              <Text variante="caption" tono="muted">
                Pide tu {bioNombre} al abrir la app.
              </Text>
            </View>
            <Ionicons
              name={bioActiva ? "toggle" : "toggle-outline"}
              size={34}
              color={bioActiva ? t.colores.brand : t.colores.muted}
            />
          </Pressable>
        </Card>
      )}

      {consentPend && (
        <Card style={{ borderColor: t.colores.warning, backgroundColor: t.colores.warningSoft, gap: t.espacio(2) }} plano>
          <Text variante="etiqueta" weight="semibold" style={{ color: t.colores.warning }}>
            Política de Privacidad actualizada
          </Text>
          <Text variante="caption" tono="muted">
            Revisá y aceptá la Política de Privacidad y los Términos.
          </Text>
          <View style={{ flexDirection: "row", gap: t.espacio(2) }}>
            <Button titulo="Aceptar" onPress={aceptarConsentimiento} cargando={ocupado} />
            <Button titulo="Ver" variante="secundario" onPress={() => Linking.openURL(`${WEB_URL}/privacidad`)} />
          </View>
        </Card>
      )}

      <Card>
        <Pressable
          onPress={descargarMisDatos}
          hitSlop={8}
          style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: t.espacio(3), minHeight: 44, opacity: pressed ? 0.7 : 1 })}
        >
          <Ionicons name="download-outline" size={22} color={t.colores.muted} />
          <View style={{ flex: 1 }}>
            <Text variante="etiqueta" weight="medium">
              Mis datos personales
            </Text>
            <Text variante="caption" tono="muted">
              Descargá todo lo que Bitácora guarda sobre vos.
            </Text>
          </View>
        </Pressable>
      </Card>

      <Card style={{ gap: t.espacio(1) }}>
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
      </Card>

      <Text mono variante="caption" tono="faint" style={{ textAlign: "center" }}>
        Bitácora {Constants.expoConfig?.version ?? ""}
      </Text>

      <Button titulo="Cerrar sesión" variante="peligro" onPress={auth.cerrarSesion} />
    </Screen>
  );
}

function Interruptor({ titulo, sub, valor, onCambiar }: { titulo: string; sub: string; valor: boolean; onCambiar: (v: boolean) => void }) {
  const t = useTema();
  return (
    <Pressable
      onPress={() => onCambiar(!valor)}
      hitSlop={8}
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: t.espacio(3), minHeight: 46, opacity: pressed ? 0.7 : 1 })}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text variante="etiqueta" weight="medium">
          {titulo}
        </Text>
        <Text variante="caption" tono="muted">
          {sub}
        </Text>
      </View>
      <Ionicons name={valor ? "toggle" : "toggle-outline"} size={34} color={valor ? t.colores.brand : t.colores.muted} />
    </Pressable>
  );
}

function Fila({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  const t = useTema();
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: t.espacio(1.5) }}>
      <Text variante="etiqueta" tono="muted">
        {etiqueta}
      </Text>
      <Text variante="etiqueta" weight="medium">
        {valor}
      </Text>
    </View>
  );
}
