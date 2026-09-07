import { useRef, useState } from "react";
import { Alert, Image, View } from "react-native";
import { useTema } from "../../../theme";
import { Button, Card, Input, Text } from "../../../components/ui";
import { LienzoFirma, type LienzoFirmaHandle } from "../../../components/LienzoFirma";
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

export function CierreFirma({
  orden,
  editable,
  onFirmar,
  onCerrar,
  onGuardarSinFirmar,
}: {
  orden: OrdenConFirma | null;
  editable: boolean;
  onFirmar: (p: { firma_base64: string; firmante_nombre: string; firmante_documento: string; observaciones_cierre: string }) => void | Promise<void>;
  onCerrar?: () => void;
  onGuardarSinFirmar?: (observaciones: string) => void;
}) {
  const t = useTema();
  const [nombre, setNombre] = useState("");
  const [cargo, setCargo] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [cerrando, setCerrando] = useState(false);
  const lienzo = useRef<LienzoFirmaHandle>(null);

  const salidaHecha = Boolean(orden?.check_out_at);

  const cajas = [
    { k: "Entrada", v: hhmm(orden?.check_in_at), activa: false },
    { k: "Salida", v: hhmm(orden?.check_out_at), activa: !salidaHecha },
    { k: "Total", v: duracion(orden?.check_in_at, orden?.check_out_at), activa: false },
  ];

  async function firmarYCerrar() {
    if (!nombre.trim()) return Alert.alert("Falta un dato", "Escribe el nombre de quien firma.");
    const base64 = await lienzo.current?.capturar();
    if (!base64) return Alert.alert("Falta la firma", "Pide al cliente que firme en el recuadro.");
    setCerrando(true);
    try {
      await onFirmar({
        firma_base64: base64,
        firmante_nombre: nombre.trim(),
        firmante_documento: cargo.trim(),
        observaciones_cierre: observaciones.trim(),
      });
      onCerrar?.();
    } finally {
      setCerrando(false);
    }
  }

  return (
    <View style={{ gap: t.espacio(3) }}>
      <Text variante="etiqueta" tono="muted" weight="semibold" style={{ textTransform: "uppercase" }}>
        Cierre y firma del cliente
      </Text>

      <View style={{ flexDirection: "row", gap: t.espacio(2) }}>
        {cajas.map((c) => (
          <View
            key={c.k}
            style={{
              flex: 1,
              borderRadius: t.radio.md,
              borderWidth: 1,
              borderColor: c.activa ? t.colores.brand : t.colores.border,
              backgroundColor: c.activa ? "#F3F6F9" : t.colores.surface,
              padding: t.espacio(3),
              gap: 2,
            }}
          >
            <Text variante="caption" tono="faint" style={{ textTransform: "uppercase", letterSpacing: 0.6 }}>
              {c.k}
            </Text>
            <Text mono weight="semibold" style={{ fontSize: 15 }}>
              {c.v}
            </Text>
          </View>
        ))}
      </View>

      {orden?.firma_url_firmada ? (
        <Card plano>
          <Image source={{ uri: orden.firma_url_firmada }} resizeMode="contain" style={{ width: "100%", height: 120, marginBottom: t.espacio(2) }} />
          <Text variante="cuerpo">
            Firma registrada ✓{orden.firmante_nombre ? ` — ${orden.firmante_nombre}` : ""}
          </Text>
          {orden.firmante_documento ? (
            <Text variante="etiqueta" tono="muted">
              {orden.firmante_documento}
            </Text>
          ) : null}
          {orden.observaciones_cierre ? (
            <Text variante="etiqueta" tono="muted">
              Obs: {orden.observaciones_cierre}
            </Text>
          ) : null}
        </Card>
      ) : editable ? (
        <>
          <LienzoFirma ref={lienzo} />
          <Input etiqueta="Nombre de quien firma" value={nombre} onChangeText={setNombre} />
          <Input etiqueta="Cargo o RUT de quien firma" value={cargo} onChangeText={setCargo} />
          <Input etiqueta="Observación para el cliente" multiline value={observaciones} onChangeText={setObservaciones} />

          <View style={{ backgroundColor: t.colores.accentSoft, borderRadius: t.radio.md, padding: t.espacio(3) }}>
            <Text variante="caption" style={{ color: t.colores.warning }}>
              Al firmar se descuenta el stock de los productos de la OS y la orden queda firmada. Sin señal, queda en la cola y
              se envía al recuperar conexión.
            </Text>
          </View>

          <Button titulo="Firmar y cerrar" tamano="lg" onPress={firmarYCerrar} cargando={cerrando} disabled={!salidaHecha} />
          {!salidaHecha ? (
            <Text variante="caption" tono="muted" style={{ textAlign: "center" }}>
              Registra la salida para poder cerrar.
            </Text>
          ) : onGuardarSinFirmar ? (
            <Text
              onPress={() => onGuardarSinFirmar(observaciones.trim())}
              variante="etiqueta"
              tono="muted"
              style={{ textAlign: "center", textDecorationLine: "underline" }}
            >
              Guardar sin firmar
            </Text>
          ) : null}
        </>
      ) : (
        <Text variante="cuerpo" tono="muted">
          Sin firma registrada.
        </Text>
      )}
    </View>
  );
}
