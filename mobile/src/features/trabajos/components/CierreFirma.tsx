import { useState } from "react";
import { Alert, Image, View } from "react-native";
import { useTema } from "../../../theme";
import { Card, Input, Text } from "../../../components/ui";
import { SignaturePad } from "../../../components/SignaturePad";
import type { OrdenConFirma } from "../../../services/trabajos";

export function CierreFirma({
  orden,
  editable,
  onFirmar,
}: {
  orden: OrdenConFirma | null;
  editable: boolean;
  onFirmar: (p: { firma_base64: string; firmante_nombre: string; firmante_documento: string; observaciones_cierre: string }) => void;
}) {
  const t = useTema();
  const [nombre, setNombre] = useState("");
  const [documento, setDocumento] = useState("");
  const [observaciones, setObservaciones] = useState("");

  return (
    <View style={{ gap: t.espacio(3) }}>
      <Text variante="etiqueta" tono="muted" weight="semibold" style={{ textTransform: "uppercase" }}>
        Cierre y firma del cliente
      </Text>

      {orden?.firma_url_firmada ? (
        <Card plano>
          <Image
            source={{ uri: orden.firma_url_firmada }}
            resizeMode="contain"
            style={{ width: "100%", height: 120, marginBottom: t.espacio(2) }}
          />
          <Text variante="cuerpo">Firma registrada ✓{orden.firmante_nombre ? ` — ${orden.firmante_nombre}` : ""}</Text>
          {orden.firmante_documento ? (
            <Text variante="etiqueta" tono="muted">
              RUT/Documento: {orden.firmante_documento}
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
          <Input etiqueta="Nombre de quien firma *" value={nombre} onChangeText={setNombre} />
          <Input etiqueta="RUT / documento" value={documento} onChangeText={setDocumento} />
          <Input etiqueta="Observaciones de cierre" multiline value={observaciones} onChangeText={setObservaciones} />
          <SignaturePad
            onGuardar={(base64) => {
              if (!nombre.trim()) {
                Alert.alert("Falta el nombre", "Ingresa el nombre de quien firma antes de guardar.");
                return;
              }
              onFirmar({
                firma_base64: base64,
                firmante_nombre: nombre.trim(),
                firmante_documento: documento.trim(),
                observaciones_cierre: observaciones.trim(),
              });
            }}
          />
        </>
      ) : (
        <Text variante="cuerpo" tono="muted">
          Sin firma registrada.
        </Text>
      )}
    </View>
  );
}
