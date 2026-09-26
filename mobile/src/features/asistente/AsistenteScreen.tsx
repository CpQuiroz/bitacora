import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, TextInput, View } from "react-native";
import { ArrowUp, Sparkles, Trash2 } from "lucide-react-native";
import type { NativeStackNavigationOptions } from "@react-navigation/native-stack";
import type { MensajeAsistente } from "@bitacora/shared";
import { tokens } from "@bitacora/design-tokens";
import { EmptyState, ErrorState, LoadingState, Texto, useMarca } from "@bitacora/ui/native";
import { borrarHistorialAsistente, enviarAlAsistente, historialAsistente } from "../../services/asistente";

// Se entra desde el botón de la cabecera de "Hoy" y desde "Más" → solo
// necesita setOptions, así que no se ata a un ParamList concreto.
type NavConOpciones = { setOptions: (o: Partial<NativeStackNavigationOptions>) => void };

type Fila = MensajeAsistente | { id: "pensando"; rol: "assistant"; contenido: "__pensando__" };

const SUGERENCIAS = [
  "¿Cuántos trabajos tengo pendientes esta semana?",
  "¿Qué cobros están vencidos?",
  "Resumen de viajes del mes",
];

// Sistema visual móvil v2 (tarea 31) — esta pantalla es el DESTINO del
// AsistenteButton flotante de las 4 raíces de tab (Hoy/Agenda/Clientes/
// Más), así que NO lleva uno propio (sería circular). Es genérica a 4
// Stacks distintos (NavConOpciones, sin ParamList concreto) y ninguno de
// esos Stacks apaga su header nativo para ella — se mantiene el header
// nativo (con el botón de borrar historial via setOptions.headerRight,
// igual que antes) y se migra solo fondo/tipografía/burbujas a tokens +
// Texto/useMarca de @bitacora/ui/native. La estructura de layout de chat
// (FlatList invertido a mano con scroll al final, burbujas, input
// flotante abajo) se preserva tal cual — no tiene equivalente directo en
// los primitivos v2.
export function AsistenteScreen({ navigation }: { navigation: NavConOpciones }) {
  const marca = useMarca();
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
            <Trash2 size={20} color={tokens.color.textSecondary} />
          </Pressable>
        ) : null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation, mensajes]);

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

  if (mensajes === null && !error) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.color.bg, padding: tokens.space["4"] }}>
        <LoadingState />
      </View>
    );
  }
  if (error && !mensajes) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
        <ErrorState mensaje={error} onReintentar={cargar} />
      </View>
    );
  }

  const filas: Fila[] = [
    ...(mensajes ?? []),
    ...(enviando ? [{ id: "pensando" as const, rol: "assistant" as const, contenido: "__pensando__" as const }] : []),
  ];

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: tokens.color.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      <FlatList
        ref={listaRef}
        data={filas}
        keyExtractor={(f) => f.id}
        contentContainerStyle={{ padding: tokens.space["4"], gap: tokens.space["3"], flexGrow: 1 }}
        onContentSizeChange={() => listaRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={
          <View style={{ flex: 1, justifyContent: "center", gap: tokens.space["4"] }}>
            <EmptyState
              icono={<Sparkles size={32} strokeWidth={2.75} color={tokens.color.accent2Ramp["800"]} />}
              titulo="Pregúntale al asistente"
              mensaje="Puede consultar trabajos, viajes, clientes y cobros de tu empresa."
            />
            <View style={{ gap: tokens.space["2"] }}>
              {SUGERENCIAS.map((s) => (
                <Pressable
                  key={s}
                  onPress={() => enviar(s)}
                  style={{
                    borderWidth: 1,
                    borderColor: tokens.color.divider,
                    borderRadius: tokens.radius.md,
                    padding: tokens.space["3"],
                  }}
                >
                  <Texto tamano={tokens.size.small} color={marca.base} peso="semibold">
                    {s}
                  </Texto>
                </Pressable>
              ))}
            </View>
          </View>
        }
        renderItem={({ item }) => {
          const esUsuario = item.rol === "user";
          if (item.contenido === "__pensando__") {
            return (
              <View style={{ flexDirection: "row", alignItems: "center", gap: tokens.space["2"], alignSelf: "flex-start" }}>
                <ActivityIndicator size="small" color={tokens.color.textSecondary} />
                <Texto tamano={tokens.size.caption} color={tokens.color.textSecondary}>
                  Pensando…
                </Texto>
              </View>
            );
          }
          return (
            <View
              style={{
                alignSelf: esUsuario ? "flex-end" : "flex-start",
                maxWidth: "85%",
                backgroundColor: esUsuario ? marca.suave : tokens.color.neutral["200"],
                borderRadius: tokens.radius.md,
                paddingHorizontal: tokens.space["3"],
                paddingVertical: tokens.space["3"],
              }}
            >
              <Texto tamano={tokens.size.body} color={esUsuario ? marca.fuerte : tokens.color.text}>
                {item.contenido}
              </Texto>
            </View>
          );
        }}
      />

      {aviso ? (
        <Texto
          tamano={tokens.size.caption}
          color={tokens.color.textSecondary}
          style={{ textAlign: "center", paddingHorizontal: tokens.space["4"], paddingBottom: tokens.space["1"] }}
        >
          {aviso}
        </Texto>
      ) : null}

      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-end",
          gap: tokens.space["2"],
          padding: tokens.space["3"],
          borderTopWidth: 1,
          borderTopColor: tokens.color.divider,
          backgroundColor: tokens.color.surface,
        }}
      >
        <TextInput
          value={texto}
          onChangeText={setTexto}
          placeholder="Escribe tu pregunta…"
          placeholderTextColor={tokens.color.textSecondary}
          multiline
          editable={!enviando}
          style={{
            flex: 1,
            maxHeight: 120,
            minHeight: 42,
            color: tokens.color.text,
            backgroundColor: tokens.color.bg,
            borderRadius: tokens.radius.md,
            borderWidth: 1,
            borderColor: tokens.color.divider,
            paddingHorizontal: tokens.space["3"],
            paddingTop: tokens.space["3"],
            paddingBottom: tokens.space["3"],
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
            backgroundColor: enviando || !texto.trim() ? tokens.color.neutral["200"] : marca.base,
          }}
        >
          <ArrowUp size={20} color={enviando || !texto.trim() ? tokens.color.textSecondary : marca.foreground} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
