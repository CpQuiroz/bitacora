import { useRef, useState } from "react";
import { Alert, Image, Pressable, View } from "react-native";
import { Camera } from "lucide-react-native";
import { tokens } from "@bitacora/design-tokens";
import { Button, Card, Input, Textarea, Texto, useMarca } from "@bitacora/ui/native";
import { LienzoFirma, type LienzoFirmaHandle } from "../../../components/LienzoFirma";
import { elegirFotos } from "../../../lib/imagen";
import type { OrdenConFirma } from "../../../services/trabajos";

function hhmm(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
}

function duracion(a: string | null | undefined, b: string | null | undefined): string {
  if (!a || !b) return "—";
  const min = Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000));
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${min % 60} min`;
}

export type ConfirmarCierrePayload =
  | { tipo: "firma"; firma_base64: string; firmante_nombre: string }
  | { tipo: "no_disponible"; motivo: string; foto: { uri: string; name: string; type: string } };

// Paso 3 — CERRAR (Fase 3.4, 23-sep-2026, pedido explícito). Antes
// pedía firma dibujada del técnico + nombre/"cargo o RUT" tipeado del
// cliente. Ahora: el técnico ya quedó acreditado por su sesión (ver
// bloqueEjecutor en generarPdfOS.ts) — acá solo se pide "Nombre del
// encargado" + su firma (el RUT sale de la ficha del cliente, no se
// pide más), o "Cliente no disponible" (motivo + foto) si no hay
// nadie que firme. El check-out + /finalizar los dispara el padre
// (TrabajoDetalleScreen) al confirmar — ya no son pasos separados que
// el técnico tenga que acordarse de hacer antes.
export function CierreFirma({
  orden,
  editable,
  confirmando,
  onConfirmar,
}: {
  orden: OrdenConFirma | null;
  editable: boolean;
  confirmando: boolean;
  onConfirmar: (payload: ConfirmarCierrePayload) => void | Promise<void>;
}) {
  const marca = useMarca();
  const [nombre, setNombre] = useState("");
  const lienzo = useRef<LienzoFirmaHandle>(null);

  const [clienteNoDisponible, setClienteNoDisponible] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [fotoEvidencia, setFotoEvidencia] = useState<{ uri: string; name: string; type: string } | null>(null);

  const cajas = [
    { k: "Entrada", v: hhmm(orden?.check_in_at) },
    { k: "Salida", v: hhmm(orden?.check_out_at) },
    { k: "Total", v: duracion(orden?.check_in_at, orden?.check_out_at) },
  ];

  async function elegirEvidencia() {
    const [elegida] = await elegirFotos({ titulo: "Foto de evidencia" });
    if (elegida) setFotoEvidencia(elegida);
  }

  async function confirmar() {
    if (clienteNoDisponible) {
      if (!motivo.trim()) return Alert.alert("Falta el motivo", "Explica por qué el cliente no está disponible.");
      if (!fotoEvidencia) return Alert.alert("Falta la foto", "Agrega una foto de evidencia.");
      await onConfirmar({ tipo: "no_disponible", motivo: motivo.trim(), foto: fotoEvidencia });
      return;
    }
    if (!nombre.trim()) return Alert.alert("Falta un dato", "Escribe el nombre del cliente o encargado que firma.");
    const base64 = await lienzo.current?.capturar();
    if (!base64) return Alert.alert("Falta la firma", "Pide al cliente o encargado que firme en el recuadro.");
    await onConfirmar({ tipo: "firma", firma_base64: base64, firmante_nombre: nombre.trim() });
  }

  // Ya cerrada — muestra lo que quedó guardado, sin edición.
  if (!editable) {
    if (orden?.cliente_no_disponible) {
      return (
        <Card>
          <Texto tamano={tokens.size.body} color={tokens.color.text} peso="semibold">
            Cliente no disponible
          </Texto>
          {orden.cliente_no_disponible_motivo ? (
            <Texto tamano={tokens.size.small} color={`${tokens.color.text}99`} style={{ marginTop: 4 }}>
              {orden.cliente_no_disponible_motivo}
            </Texto>
          ) : null}
        </Card>
      );
    }
    if (orden?.firma_url_firmada) {
      return (
        <Card>
          <Image source={{ uri: orden.firma_url_firmada }} resizeMode="contain" style={{ width: "100%", height: 120, marginBottom: tokens.space["2"] }} />
          <Texto tamano={tokens.size.body} color={tokens.color.text}>
            Firma registrada ✓{orden.firmante_nombre ? ` — ${orden.firmante_nombre}` : ""}
          </Texto>
        </Card>
      );
    }
    return (
      <Texto tamano={tokens.size.body} color={`${tokens.color.text}99`}>
        Sin firma registrada.
      </Texto>
    );
  }

  return (
    <View style={{ gap: tokens.space["3"] }}>
      <Texto tamano={tokens.size.small} color={`${tokens.color.text}99`} peso="semibold" style={{ textTransform: "uppercase" }}>
        Resumen
      </Texto>
      <View style={{ flexDirection: "row", gap: tokens.space["2"] }}>
        {cajas.map((c) => (
          <View
            key={c.k}
            style={{
              flex: 1,
              borderRadius: tokens.radius.md,
              borderWidth: 1,
              borderColor: tokens.color.divider,
              backgroundColor: tokens.color.surface,
              padding: tokens.space["3"],
              gap: 2,
            }}
          >
            <Texto tamano={11} color={`${tokens.color.text}66`} style={{ textTransform: "uppercase", letterSpacing: 0.6 }}>
              {c.k}
            </Texto>
            <Texto tamano={15} color={tokens.color.text} peso="semibold" style={{ fontVariant: ["tabular-nums"] }}>
              {c.v}
            </Texto>
          </View>
        ))}
      </View>

      <Pressable onPress={() => setClienteNoDisponible((v) => !v)} style={{ alignSelf: "flex-start" }}>
        <Texto tamano={tokens.size.small} color={marca.base} peso="semibold" style={{ textDecorationLine: "underline" }}>
          {clienteNoDisponible ? "← Sí hay alguien que firma" : "El cliente no está disponible"}
        </Texto>
      </Pressable>

      {clienteNoDisponible ? (
        <View style={{ gap: tokens.space["2"] }}>
          <Textarea etiqueta="Motivo" placeholder="Ej.: no había nadie en el domicilio a la hora acordada" filas={3} valor={motivo} onCambio={setMotivo} />
          {fotoEvidencia ? (
            <Image source={{ uri: fotoEvidencia.uri }} style={{ width: "100%", height: 160, borderRadius: tokens.radius.md, backgroundColor: tokens.color.neutral["200"] }} resizeMode="cover" />
          ) : null}
          <Button variante="secundario" iconoIzq={<Camera size={16} strokeWidth={2.5} />} onPress={elegirEvidencia}>
            {fotoEvidencia ? "Cambiar foto de evidencia" : "Agregar foto de evidencia"}
          </Button>
        </View>
      ) : (
        // Quien firma es el CLIENTE (o su encargado), no el técnico — el
        // técnico queda acreditado por su cuenta ("Ejecutado por" en el
        // PDF). Pedido 24-sep-2026: "Nombre del encargado" se leía como
        // la firma del técnico.
        <View style={{ gap: tokens.space["2"] }}>
          <Texto tamano={tokens.size.body} color={tokens.color.text} peso="semibold">
            Firma de conformidad del cliente o encargado
          </Texto>
          <Texto tamano={tokens.size.small} color={`${tokens.color.text}99`}>
            Pásale el teléfono al cliente para que firme. Tú no firmas: quedas registrado por tu cuenta.
          </Texto>
          <Input etiqueta="Nombre del cliente o encargado" valor={nombre} onCambio={setNombre} />
          <LienzoFirma ref={lienzo} />
        </View>
      )}

      <View style={{ backgroundColor: tokens.color.accentRamp["100"], borderRadius: tokens.radius.md, padding: tokens.space["3"] }}>
        <Texto tamano={tokens.size.caption} color={tokens.color.accentRamp["800"]}>
          Al confirmar se registra la salida, se descuenta el stock de los productos de la OS y la orden queda cerrada. Sin
          señal, queda en la cola y se envía al recuperar conexión.
        </Texto>
      </View>

      <Button tamano="lg" bloque onPress={confirmar} cargando={confirmando}>
        Confirmar y cerrar
      </Button>
    </View>
  );
}
