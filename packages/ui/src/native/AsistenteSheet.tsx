import type { ReactNode } from "react";
import { Modal, Pressable, TextInput, View } from "react-native";
import { Mic, Sparkles } from "lucide-react-native";
import { tokens } from "@bitacora/design-tokens";
import { Texto } from "./Texto";
import { FUENTE_NATIVE } from "./fuentes";
import { Button } from "./Button";
import { ListRow, ListRowGrupo } from "./ListRow";

// Sistema visual móvil v2 (13-sep-2026). Bottom sheet dedicado, NO el
// `Dialog` genérico de packages/ui: el contenido (avatar+antetítulo en
// vez del título+X de Dialog) es distinto, no un simple cambio de
// texto — ver informe del Paso 0. Se duplica el shell de Modal+backdrop
// (chico, ~15 líneas) en vez de forzar un slot de header custom sobre
// Dialog, que se usa en otros lados con su contrato actual.
const RADIO_SUPERIOR = 28; // coincide con radius.lg — a diferencia de Dialog (32, ver Dialog.tsx).

export type AtajoAsistente = { icono: ReactNode; titulo: string; subtitulo?: string; onPress: () => void };

export type PropsAsistenteSheet = {
  abierto: boolean;
  onCerrar: () => void;
  atajos: AtajoAsistente[];
  mensaje: string;
  onCambiarMensaje: (texto: string) => void;
  onEnviar: () => void;
  /** Sin esto, el botón de micrófono no se muestra — la pantalla decide si hay dictado disponible. */
  onMicrofono?: () => void;
};

export function AsistenteSheet({ abierto, onCerrar, atajos, mensaje, onCambiarMensaje, onEnviar, onMicrofono }: PropsAsistenteSheet) {
  return (
    <Modal visible={abierto} transparent animationType="fade" onRequestClose={onCerrar}>
      <Pressable
        onPress={onCerrar}
        style={{ flex: 1, backgroundColor: `${tokens.color.neutral["900"]}80`, justifyContent: "flex-end" }}
      >
        <Pressable
          style={{
            backgroundColor: tokens.color.surface,
            borderTopLeftRadius: RADIO_SUPERIOR,
            borderTopRightRadius: RADIO_SUPERIOR,
            maxHeight: "85%",
            paddingHorizontal: tokens.space["4"],
            paddingTop: tokens.space["4"],
            paddingBottom: tokens.space["6"],
            gap: tokens.space["4"],
          }}
        >
          <View style={{ alignItems: "center", gap: tokens.space["1"] }}>
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: tokens.radius.pill,
                backgroundColor: tokens.color.accentRamp["200"],
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Sparkles size={22} strokeWidth={2.75} color={tokens.color.accentRamp["700"]} />
            </View>
            <Texto
              tamano={tokens.size.micro}
              color={tokens.color.accent2Ramp["800"]}
              peso="semibold"
              style={{ textTransform: "uppercase", letterSpacing: 1.3 }}
            >
              Atajos
            </Texto>
          </View>

          {atajos.length > 0 ? (
            <ListRowGrupo>
              {atajos.map((a, i) => (
                <ListRow key={i} icono={a.icono} titulo={a.titulo} subtitulo={a.subtitulo} onPress={a.onPress} />
              ))}
            </ListRowGrupo>
          ) : null}

          <View style={{ flexDirection: "row", alignItems: "center", gap: tokens.space["2"] }}>
            <TextInput
              value={mensaje}
              onChangeText={onCambiarMensaje}
              placeholder="Preguntale algo al Asistente…"
              placeholderTextColor={`${tokens.color.text}66`}
              onSubmitEditing={onEnviar}
              style={{
                flex: 1,
                height: 52,
                borderRadius: tokens.radius.pill,
                borderWidth: 1,
                borderColor: tokens.color.divider,
                paddingHorizontal: tokens.space["4"],
                fontFamily: FUENTE_NATIVE.body,
                fontSize: tokens.size.body,
                color: tokens.color.text,
              }}
            />
            {onMicrofono ? (
              <Button forma="circular" variante="secundario" onPress={onMicrofono} etiquetaAccesible="Dictar por voz" iconoIzq={<Mic size={20} strokeWidth={2.75} color={tokens.color.text} />}>
                {null}
              </Button>
            ) : null}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
