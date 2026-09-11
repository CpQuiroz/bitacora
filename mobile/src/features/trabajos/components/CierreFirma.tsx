import { useRef, useState } from "react";
import { Alert, Image, View } from "react-native";
import { tokens } from "@bitacora/design-tokens";
import { Button, Card, Input, Textarea, Texto, useMarca } from "@bitacora/ui/native";
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

// PASO 6 (sistema de diseño) — migrado. Ver docs/design-system.md.
export function CierreFirma({
  orden,
  editable,
  onFirmar,
  onFirmarTecnico,
  onCerrar,
  onGuardarSinFirmar,
}: {
  orden: OrdenConFirma | null;
  editable: boolean;
  onFirmar: (p: { firma_base64: string; firmante_nombre: string; firmante_documento: string; observaciones_cierre: string }) => void | Promise<void>;
  onFirmarTecnico?: (p: { firma_base64: string; tecnico_nombre: string; tecnico_documento: string }) => void | Promise<void>;
  onCerrar?: () => void;
  onGuardarSinFirmar?: (observaciones: string) => void;
}) {
  const marca = useMarca();
  const [nombre, setNombre] = useState("");
  const [cargo, setCargo] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [cerrando, setCerrando] = useState(false);
  const lienzo = useRef<LienzoFirmaHandle>(null);

  // Firma del técnico (opcional, va en el PDF).
  const [tecNombre, setTecNombre] = useState("");
  const [tecDoc, setTecDoc] = useState("");
  const [guardandoTec, setGuardandoTec] = useState(false);
  const lienzoTec = useRef<LienzoFirmaHandle>(null);
  const tecFirmado = Boolean(orden?.firma_tecnico_url || orden?.firma_tecnico_url_firmada);

  async function guardarFirmaTecnico() {
    if (!onFirmarTecnico) return;
    if (!tecNombre.trim()) return Alert.alert("Falta un dato", "Escribe el nombre del técnico.");
    const base64 = await lienzoTec.current?.capturar();
    if (!base64) return Alert.alert("Falta la firma", "Firma en el recuadro.");
    setGuardandoTec(true);
    try {
      await onFirmarTecnico({ firma_base64: base64, tecnico_nombre: tecNombre.trim(), tecnico_documento: tecDoc.trim() });
    } finally {
      setGuardandoTec(false);
    }
  }

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
    <View style={{ gap: tokens.space["3"] }}>
      {/* Firma del técnico — opcional, queda en el PDF */}
      {onFirmarTecnico ? (
        <View style={{ gap: tokens.space["2"] }}>
          <Texto tamano={tokens.size.small} color={`${tokens.color.text}99`} peso="semibold" style={{ textTransform: "uppercase" }}>
            Firma del técnico
          </Texto>
          {tecFirmado ? (
            <Card>
              {orden?.firma_tecnico_url_firmada ? (
                <Image source={{ uri: orden.firma_tecnico_url_firmada }} resizeMode="contain" style={{ width: "100%", height: 90, marginBottom: tokens.space["2"] }} />
              ) : null}
              <Texto tamano={tokens.size.body} color={tokens.color.text}>
                Firma del técnico registrada ✓{orden?.tecnico_firmante_nombre ? ` — ${orden.tecnico_firmante_nombre}` : ""}
              </Texto>
            </Card>
          ) : editable ? (
            <>
              <LienzoFirma ref={lienzoTec} />
              <Input etiqueta="Nombre del técnico" valor={tecNombre} onCambio={setTecNombre} />
              <Input etiqueta="RUT del técnico (opcional)" valor={tecDoc} onCambio={setTecDoc} />
              <Button variante="secundario" onPress={guardarFirmaTecnico} cargando={guardandoTec}>
                Guardar firma del técnico
              </Button>
              <Texto tamano={tokens.size.caption} color={`${tokens.color.text}99`}>
                Opcional. Va en el PDF junto a la firma del cliente.
              </Texto>
            </>
          ) : (
            <Texto tamano={tokens.size.body} color={`${tokens.color.text}99`}>
              Sin firma del técnico.
            </Texto>
          )}
        </View>
      ) : null}

      <Texto tamano={tokens.size.small} color={`${tokens.color.text}99`} peso="semibold" style={{ textTransform: "uppercase" }}>
        Cierre y firma del cliente
      </Texto>

      <View style={{ flexDirection: "row", gap: tokens.space["2"] }}>
        {cajas.map((c) => (
          <View
            key={c.k}
            style={{
              flex: 1,
              borderRadius: tokens.radius.md,
              borderWidth: 1,
              borderColor: c.activa ? marca.base : tokens.color.divider,
              backgroundColor: c.activa ? `${marca.base}14` : tokens.color.surface,
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

      {orden?.firma_url_firmada ? (
        <Card>
          <Image source={{ uri: orden.firma_url_firmada }} resizeMode="contain" style={{ width: "100%", height: 120, marginBottom: tokens.space["2"] }} />
          <Texto tamano={tokens.size.body} color={tokens.color.text}>
            Firma registrada ✓{orden.firmante_nombre ? ` — ${orden.firmante_nombre}` : ""}
          </Texto>
          {orden.firmante_documento ? (
            <Texto tamano={tokens.size.small} color={`${tokens.color.text}99`}>
              {orden.firmante_documento}
            </Texto>
          ) : null}
          {orden.observaciones_cierre ? (
            <Texto tamano={tokens.size.small} color={`${tokens.color.text}99`}>
              Obs: {orden.observaciones_cierre}
            </Texto>
          ) : null}
        </Card>
      ) : editable ? (
        <>
          <LienzoFirma ref={lienzo} />
          <Input etiqueta="Nombre de quien firma" valor={nombre} onCambio={setNombre} />
          <Input etiqueta="Cargo o RUT de quien firma" valor={cargo} onCambio={setCargo} />
          <Textarea etiqueta="Observación para el cliente" filas={2} valor={observaciones} onCambio={setObservaciones} />

          <View style={{ backgroundColor: tokens.color.accentRamp["100"], borderRadius: tokens.radius.md, padding: tokens.space["3"] }}>
            <Texto tamano={tokens.size.caption} color={tokens.color.accentRamp["800"]}>
              Al firmar se descuenta el stock de los productos de la OS y la orden queda firmada. Sin señal, queda en la cola y
              se envía al recuperar conexión.
            </Texto>
          </View>

          <Button tamano="lg" bloque onPress={firmarYCerrar} cargando={cerrando} deshabilitado={!salidaHecha}>
            Firmar y cerrar
          </Button>
          {!salidaHecha ? (
            <Texto tamano={tokens.size.caption} color={`${tokens.color.text}99`} style={{ textAlign: "center" }}>
              Registra la salida para poder cerrar.
            </Texto>
          ) : onGuardarSinFirmar ? (
            <Texto
              onPress={() => onGuardarSinFirmar(observaciones.trim())}
              tamano={tokens.size.small}
              color={`${tokens.color.text}99`}
              style={{ textAlign: "center", textDecorationLine: "underline" }}
            >
              Guardar sin firmar
            </Texto>
          ) : null}
        </>
      ) : (
        <Texto tamano={tokens.size.body} color={`${tokens.color.text}99`}>
          Sin firma registrada.
        </Texto>
      )}
    </View>
  );
}
