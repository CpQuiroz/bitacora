import { useCallback, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import type { Servicio, TipoPack } from "@bitacora/shared";
import { useTema } from "../../theme";
import { Button, Card, EmptyState, LoadingScreen, Text } from "../../components/ui";
import { useAuth } from "../auth/AuthContext";
import { formatearMoneda } from "../../lib/plata";
import { listarServicios } from "../../services/servicios";
import { listarTiposPack } from "../../services/tiposPack";
import { NuevoServicioModal } from "./NuevoServicioModal";
import { TipoPackModal } from "./TipoPackModal";

// "Servicios y packs" (pestaña Más) — administra el catálogo de Agenda
// Pro desde la app: crear y editar servicios (precio, duración) y tipos
// de pack (precio, sesiones, vigencia). Antes solo se hacía en la web.
export function CatalogoScreen() {
  const t = useTema();
  const auth = useAuth();
  const moneda = auth.fase === "listo" ? auth.usuario.empresa.moneda : "CLP";

  const [servicios, setServicios] = useState<Servicio[] | null>(null);
  const [packs, setPacks] = useState<TipoPack[] | null>(null);

  const [servicioModal, setServicioModal] = useState<{ abierto: boolean; servicio: Servicio | null }>({ abierto: false, servicio: null });
  const [packModal, setPackModal] = useState<{ abierto: boolean; pack: TipoPack | null }>({ abierto: false, pack: null });

  const cargar = useCallback(() => {
    listarServicios(false).then(setServicios);
    listarTiposPack(false).then(setPacks);
  }, []);

  useFocusEffect(useCallback(() => cargar(), [cargar]));

  if (servicios === null || packs === null) return <LoadingScreen />;

  return (
    <>
      <ScrollView contentContainerStyle={{ padding: t.espacio(5), gap: t.espacio(5) }}>
        {/* Servicios */}
        <View style={{ gap: t.espacio(2) }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text variante="subtitulo">Servicios ({servicios.length})</Text>
            <Pressable onPress={() => setServicioModal({ abierto: true, servicio: null })} hitSlop={8}>
              <Text variante="caption" weight="semibold" tono="brand">
                ＋ Nuevo
              </Text>
            </Pressable>
          </View>
          {servicios.length === 0 ? (
            <Text variante="caption" tono="muted">
              Todavía no hay servicios. Creá el primero para poder elegirlo en una reserva.
            </Text>
          ) : (
            servicios.map((s) => (
              <Card key={s.id} onPress={() => setServicioModal({ abierto: true, servicio: s })}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: t.espacio(3) }}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text variante="etiqueta" weight="medium">
                      {s.nombre} {!s.activo ? <Text variante="caption" tono="muted">· inactivo</Text> : null}
                    </Text>
                    <Text variante="caption" tono="muted">
                      {formatearMoneda(s.precio, moneda)} · {s.duracion_sugerida_min} min
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={t.colores.faint} />
                </View>
              </Card>
            ))
          )}
        </View>

        {/* Packs */}
        <View style={{ gap: t.espacio(2) }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text variante="subtitulo">Packs de sesiones ({packs.length})</Text>
            <Pressable onPress={() => setPackModal({ abierto: true, pack: null })} hitSlop={8}>
              <Text variante="caption" weight="semibold" tono="brand">
                ＋ Nuevo
              </Text>
            </Pressable>
          </View>
          {packs.length === 0 ? (
            <Text variante="caption" tono="muted">
              Sin packs. Un pack es una plantilla (X sesiones a un precio) que después le vendés a un cliente.
            </Text>
          ) : (
            packs.map((p) => {
              const servicio = servicios.find((s) => s.id === p.servicio_id);
              return (
                <Card key={p.id} onPress={() => setPackModal({ abierto: true, pack: p })}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: t.espacio(3) }}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text variante="etiqueta" weight="medium">
                        {p.nombre} {!p.activo ? <Text variante="caption" tono="muted">· inactivo</Text> : null}
                      </Text>
                      <Text variante="caption" tono="muted">
                        {p.cantidad_sesiones} sesiones · {p.precio != null ? formatearMoneda(p.precio, moneda) : "sin precio"}
                        {servicio ? ` · ${servicio.nombre}` : ""}
                        {p.vigencia_dias != null ? ` · vence a los ${p.vigencia_dias} días` : " · no vence"}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={t.colores.faint} />
                  </View>
                </Card>
              );
            })
          )}
        </View>

        {servicios.length === 0 && packs.length === 0 ? (
          <EmptyState
            icono={<Ionicons name="pricetags-outline" size={40} color={t.colores.faint} />}
            titulo="Catálogo vacío"
            mensaje="Creá tus servicios y packs con el botón «＋ Nuevo» de cada sección."
          />
        ) : null}

        <Button titulo="Nuevo servicio" variante="secundario" onPress={() => setServicioModal({ abierto: true, servicio: null })} />
        <Button titulo="Nuevo pack" variante="secundario" onPress={() => setPackModal({ abierto: true, pack: null })} />
      </ScrollView>

      <NuevoServicioModal
        key={servicioModal.servicio?.id ?? "nuevo-servicio"}
        visible={servicioModal.abierto}
        servicio={servicioModal.servicio}
        onCerrar={() => setServicioModal({ abierto: false, servicio: null })}
        onGuardado={() => {
          setServicioModal({ abierto: false, servicio: null });
          cargar();
        }}
      />
      <TipoPackModal
        key={packModal.pack?.id ?? "nuevo-pack"}
        visible={packModal.abierto}
        tipoPack={packModal.pack}
        servicios={servicios.filter((s) => s.activo)}
        onCerrar={() => setPackModal({ abierto: false, pack: null })}
        onGuardado={() => {
          setPackModal({ abierto: false, pack: null });
          cargar();
        }}
      />
    </>
  );
}
