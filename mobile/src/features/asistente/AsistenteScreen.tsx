import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { MensajeAsistente } from "@bitacora/shared";
import { useTema } from "../../theme";
import { EmptyState, ErrorState, LoadingScreen, Text } from "../../components/ui";
import { borrarHistorialAsistente, enviarAlAsistente, historialAsistente } from "../../services/asistente";
import type { GestionStackParamList } from "../../shell/navigation/types";

type Fila = MensajeAsistente | { id: "pensando"; rol: "assistant"; contenido: "__pensando__" };

const SUGERENCIAS = [
  "¿Cuántos trabajos tengo pendientes esta semana?",
  "¿Qué cobros están vencidos?",
  "Resumen de viajes del mes",
];

export function AsistenteScreen({ navigation }: NativeStackScreenProps<GestionStackParamList, "Asistente">) {
  const t = useTema();
  const listaRef = useRef<FlatList<Fila>>(null);
  const [mensajes, setMensajes] = useState<MensajeAsistente[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      setMensajes(await historialAsistente());
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar la conversación");
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function limpiar() {
    Alert.alert("Borrar la conversación", "Se borra todo el historial con el asistente. ¿Seguro?", [
      { text: "No", style: "cancel" },
      {
        text: "Sí, borrar",
        style: "destructive",
        onPress: async () => {
          await borrarHistorialAsistente().catch(() => {});
          setMensajes([]);
          setAviso(null);
        },
      },
    ]);
  }

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () =>
        mensajes && mensajes.length > 0 ? (
          <Pressable onPress={limpiar} hitSlop={10}>
            <Ionicons name="trash-outline" size={20} color={t.colores.muted} />
          </Pressable>
        ) : null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation, mensajes, t]);

  async function enviar(contenido: string) {
    const txt = contenido.trim();
    if (!txt || enviando) return;
    setTexto("");
    setAviso(null);
    setEnviando(true);
    // Optimista: mostramos el mensaje del usuario al toque.
    const provisional: MensajeAsistente = {
      id: `local-${Date.now()}`,
      empresa_id: "",
      usuario_id: "",
      rol: "user",
      contenido: txt,
      creado_en: new Date().toISOString(),
    };
    setMensajes((m) => [...(m ?? []), provisional]);
    setTimeout(() => listaRef.current?.scrollToEnd({ animated: true }), 50);

    const r = await enviarAlAsistente(txt);
    setEnviando(false);
    if (r.ok) {
      // Recargamos del server para tener los ids reales (usuario + respuesta).
      await cargar();
    } else if (r.timeout) {
      setAviso(r.error);
      await cargar();
    } else {
      setAviso(r.error);
    }
    setTimeout(() => listaRef.current?.scrollToEnd({ animated: true }), 50);
  }

  if (mensajes === null && !error) return <LoadingScreen />;
  if (error && !mensajes) return <ErrorState mensaje={error} onReintentar={cargar} />;

  const filas: Fila[] = [
    ...(mensajes ?? []),
    ...(enviando ? [{ id: "pensando" as const, rol: "assistant" as const, contenido: "__pensando__" as const }] : []),
  ];

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: t.colores.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      <FlatList
        ref={listaRef}
        data={filas}
        keyExtractor={(f) => f.id}
        contentContainerStyle={{ padding: t.espacio(4), gap: t.espacio(2.5), flexGrow: 1 }}
        onContentSizeChange={() => listaRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={
          <View style={{ flex: 1, justifyContent: "center", gap: t.espacio(4) }}>
            <EmptyState
              icono={<Ionicons name="sparkles-outline" size={40} color={t.colores.faint} />}
              titulo="Pregúntale al asistente"
              mensaje="Puede consultar trabajos, viajes, clientes y cobros de tu empresa."
            />
            <View style={{ gap: t.espacio(2) }}>
              {SUGERENCIAS.map((s) => (
                <Pressable
                  key={s}
                  onPress={() => enviar(s)}
                  style={{
                    borderWidth: 1,
                    borderColor: t.colores.border,
                    borderRadius: t.radio.md,
                    padding: t.espacio(3),
                  }}
                >
                  <Text variante="etiqueta" tono="brand">
                    {s}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        }
        renderItem={({ item }) => {
          const esUsuario = item.rol === "user";
          if (item.contenido === "__pensando__") {
            return (
              <View style={{ flexDirection: "row", alignItems: "center", gap: t.espacio(2), alignSelf: "flex-start" }}>
                <ActivityIndicator size="small" color={t.colores.muted} />
                <Text variante="caption" tono="muted">
                  Pensando…
                </Text>
              </View>
            );
          }
          return (
            <View
              style={{
                alignSelf: esUsuario ? "flex-end" : "flex-start",
                maxWidth: "85%",
                backgroundColor: esUsuario ? t.colores.brand : t.colores.surfaceAlt,
                borderRadius: t.radio.md,
                paddingHorizontal: t.espacio(3),
                paddingVertical: t.espacio(2.5),
              }}
            >
              <Text variante="cuerpo" style={{ color: esUsuario ? t.colores.brandForeground : t.colores.foreground }}>
                {item.contenido}
              </Text>
            </View>
          );
        }}
      />

      {aviso ? (
        <Text variante="caption" tono="muted" style={{ textAlign: "center", paddingHorizontal: t.espacio(4), paddingBottom: t.espacio(1) }}>
          {aviso}
        </Text>
      ) : null}

      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-end",
          gap: t.espacio(2),
          padding: t.espacio(3),
          borderTopWidth: 1,
          borderTopColor: t.colores.border,
          backgroundColor: t.colores.surface,
        }}
      >
        <TextInput
          value={texto}
          onChangeText={setTexto}
          placeholder="Escribe tu pregunta…"
          placeholderTextColor={t.colores.faint}
          multiline
          editable={!enviando}
          style={{
            flex: 1,
            maxHeight: 120,
            minHeight: 42,
            color: t.colores.foreground,
            backgroundColor: t.colores.bg,
            borderRadius: t.radio.md,
            borderWidth: 1,
            borderColor: t.colores.border,
            paddingHorizontal: t.espacio(3),
            paddingTop: t.espacio(2.5),
            paddingBottom: t.espacio(2.5),
          }}
        />
        <Pressable
          onPress={() => enviar(texto)}
          disabled={enviando || !texto.trim()}
          style={{
            width: 42,
            height: 42,
            borderRadius: 21,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: enviando || !texto.trim() ? t.colores.surfaceAlt : t.colores.brand,
          }}
        >
          <Ionicons
            name="arrow-up"
            size={20}
            color={enviando || !texto.trim() ? t.colores.faint : t.colores.brandForeground}
          />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
