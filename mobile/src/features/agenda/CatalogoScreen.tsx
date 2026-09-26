import { useCallback, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { ArrowLeft, ChevronRight, Layers, Tags } from "lucide-react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { Servicio, TipoPack } from "@bitacora/shared";
import { tokens } from "@bitacora/design-tokens";
import { Button, EmptyState, ListRow, ListRowGrupo, LoadingState, ScreenHeader, Tag, Texto, useMarca } from "@bitacora/ui/native";
import { useAuth } from "../auth/AuthContext";
import { formatearMoneda } from "../../lib/plata";
import { listarServicios } from "../../services/servicios";
import { listarTiposPack } from "../../services/tiposPack";
import { NuevoServicioModal } from "./NuevoServicioModal";
import { TipoPackModal } from "./TipoPackModal";
import type { MasStackParamList } from "../../shell/navigation/types";

// "Servicios y packs" (pestaña Más) — administra el catálogo de Agenda
// Pro desde la app: crear y editar servicios (precio, duración) y tipos
// de pack (precio, sesiones, vigencia). Antes solo se hacía en la web.
//
// Sistema visual móvil v2 (14-sep-2026) — migrada al sistema nuevo:
// ScreenHeader propio con `accion`=volver (es una pantalla push, no
// raíz de tab) + ListRow/ListRowGrupo para cada sección, mismo patrón
// que "Más" (que ya usa Tags/Layers como íconos afines). Lógica de
// negocio (carga, modales de alta/edición) intacta.
export function CatalogoScreen({ navigation }: NativeStackScreenProps<MasStackParamList, "Catalogo">) {
  const marca = useMarca();
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

  const volver = { icono: <ArrowLeft size={20} strokeWidth={2.5} color={tokens.color.text} />, onPress: () => navigation.goBack(), etiquetaAccesible: "Volver" };

  if (servicios === null || packs === null) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
        <ScreenHeader titulo="Servicios y packs" accion={volver} />
        <View style={{ padding: tokens.space["4"] }}>
          <LoadingState />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
      <ScreenHeader titulo="Servicios y packs" accion={volver} />
      <ScrollView contentContainerStyle={{ padding: tokens.space["4"], gap: tokens.space["4"] }}>
        {/* Servicios */}
        <View style={{ gap: tokens.space["2"] }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Texto tamano={tokens.size.micro} color={tokens.color.accent2Ramp["800"]} peso="semibold" style={{ textTransform: "uppercase", letterSpacing: 1.3 }}>
              Servicios ({servicios.length})
            </Texto>
            <Pressable onPress={() => setServicioModal({ abierto: true, servicio: null })} hitSlop={8}>
              <Texto tamano={tokens.size.small} color={marca.base} peso="semibold">
                ＋ Nuevo
              </Texto>
            </Pressable>
          </View>
          {servicios.length === 0 ? (
            <Texto tamano={tokens.size.small} color={tokens.color.textSecondary}>
              Todavía no hay servicios. Creá el primero para poder elegirlo en una reserva.
            </Texto>
          ) : (
            <ListRowGrupo>
              {servicios.map((s) => (
                <ListRow
                  key={s.id}
                  icono={<Tags size={22} strokeWidth={2.25} color={tokens.color.accentRamp["700"]} />}
                  titulo={s.nombre}
                  subtitulo={`${formatearMoneda(s.precio, moneda)} · ${s.duracion_sugerida_min} min`}
                  trailing={!s.activo ? <Tag tono="neutral">Inactivo</Tag> : <ChevronRight size={18} strokeWidth={2.25} color={tokens.color.textSecondary} />}
                  onPress={() => setServicioModal({ abierto: true, servicio: s })}
                />
              ))}
            </ListRowGrupo>
          )}
        </View>

        {/* Packs */}
        <View style={{ gap: tokens.space["2"] }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Texto tamano={tokens.size.micro} color={tokens.color.accent2Ramp["800"]} peso="semibold" style={{ textTransform: "uppercase", letterSpacing: 1.3 }}>
              Packs de sesiones ({packs.length})
            </Texto>
            <Pressable onPress={() => setPackModal({ abierto: true, pack: null })} hitSlop={8}>
              <Texto tamano={tokens.size.small} color={marca.base} peso="semibold">
                ＋ Nuevo
              </Texto>
            </Pressable>
          </View>
          {packs.length === 0 ? (
            <Texto tamano={tokens.size.small} color={tokens.color.textSecondary}>
              Sin packs. Un pack es una plantilla (X sesiones a un precio) que después le vendés a un cliente.
            </Texto>
          ) : (
            <ListRowGrupo>
              {packs.map((p) => {
                const servicio = servicios.find((s) => s.id === p.servicio_id);
                return (
                  <ListRow
                    key={p.id}
                    icono={<Layers size={22} strokeWidth={2.25} color={tokens.color.accentRamp["700"]} />}
                    titulo={p.nombre}
                    subtitulo={`${p.cantidad_sesiones} sesiones · ${p.precio != null ? formatearMoneda(p.precio, moneda) : "sin precio"}${servicio ? ` · ${servicio.nombre}` : ""}${p.vigencia_dias != null ? ` · vence a los ${p.vigencia_dias} días` : " · no vence"}`}
                    trailing={!p.activo ? <Tag tono="neutral">Inactivo</Tag> : <ChevronRight size={18} strokeWidth={2.25} color={tokens.color.textSecondary} />}
                    onPress={() => setPackModal({ abierto: true, pack: p })}
                  />
                );
              })}
            </ListRowGrupo>
          )}
        </View>

        {servicios.length === 0 && packs.length === 0 ? (
          <EmptyState
            icono={<Tags size={32} strokeWidth={2.75} color={tokens.color.accent2Ramp["800"]} />}
            titulo="Catálogo vacío"
            mensaje="Creá tus servicios y packs con «＋ Nuevo» en cada sección."
          />
        ) : null}

        <View style={{ gap: tokens.space["2"] }}>
          <Button variante="secundario" bloque onPress={() => setServicioModal({ abierto: true, servicio: null })}>
            Nuevo servicio
          </Button>
          <Button variante="secundario" bloque onPress={() => setPackModal({ abierto: true, pack: null })}>
            Nuevo pack
          </Button>
        </View>
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
    </View>
  );
}
