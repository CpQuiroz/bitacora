import { View } from "react-native";
import { useTema } from "../../../theme";
import { formatearMoneda } from "../../../lib/plata";
import { obtenerFinanciero } from "../../../services/informes";
import { Bloque, CargandoSeccion, ErrorSeccion, FilaTabla, GrillaMetricas, Metrica, SinDatos, useInformeFetch } from "../componentes";

const ETIQUETA_MEDIO: Record<string, string> = {
  webpay: "Webpay",
  flow: "Flow",
  mercadopago: "Mercado Pago",
  transferencia: "Transferencia",
  efectivo: "Efectivo",
  otro: "Otro",
  sin_definir: "Sin definir",
};

const pct = (parte: number, total: number) => (total > 0 ? `${((parte / total) * 100).toFixed(0)}% del total` : undefined);

export function Financiero({ desde, hasta, moneda }: { desde: string; hasta: string; moneda: string }) {
  const t = useTema();
  const { datos, error, reintentar } = useInformeFetch(() => obtenerFinanciero(desde, hasta), [desde, hasta]);

  if (error) return <ErrorSeccion mensaje={error} onReintentar={reintentar} />;
  if (!datos) return <CargandoSeccion />;

  const { resumen_financiero: r, ingresos_por_mes: porMes, por_forma_pago: formaPago, mejores_clientes: clientes } = datos;

  return (
    <View style={{ gap: t.espacio(4) }}>
      <GrillaMetricas>
        <Metrica etiqueta="Ingreso total" valor={formatearMoneda(r.total, moneda)} />
        <Metrica etiqueta="Total recibido" valor={formatearMoneda(r.recibido, moneda)} nota={pct(r.recibido, r.total)} />
        <Metrica etiqueta="Total pendiente" valor={formatearMoneda(r.pendiente, moneda)} nota={pct(r.pendiente, r.total)} />
        <Metrica etiqueta="Total vencido" valor={formatearMoneda(r.atrasado, moneda)} nota={pct(r.atrasado, r.total)} />
      </GrillaMetricas>

      <Bloque titulo="Ingreso por período (últimos 12 meses)">
        {porMes.length === 0 ? (
          <SinDatos mensaje="Sin datos de ingresos todavía." />
        ) : (
          porMes.map((m) => (
            <FilaTabla key={m.mes} label={m.mes} valor={formatearMoneda(m.recibido, moneda)} sub="Recibido" />
          ))
        )}
      </Bloque>

      <Bloque titulo="Ingreso por estado">
        <FilaTabla label="Recibido" valor={formatearMoneda(r.recibido, moneda)} />
        <FilaTabla label="Pendiente" valor={formatearMoneda(r.pendiente, moneda)} />
        <FilaTabla label="Vencido" valor={formatearMoneda(r.atrasado, moneda)} />
      </Bloque>

      <Bloque titulo="Por forma de pago">
        {formaPago.length === 0 ? (
          <SinDatos mensaje="Ningún cobro con forma de pago registrada en el período." />
        ) : (
          formaPago.map((f) => (
            <FilaTabla
              key={f.medio_pago}
              label={ETIQUETA_MEDIO[f.medio_pago] ?? f.medio_pago}
              valor={formatearMoneda(f.monto, moneda)}
              valorSecundario={`${f.cantidad} cobro(s)`}
            />
          ))
        )}
      </Bloque>

      <Bloque titulo="Mejores clientes">
        {clientes.length === 0 ? (
          <SinDatos mensaje="Ningún cobro registrado en el período." />
        ) : (
          clientes.map((c) => (
            <FilaTabla key={c.cliente} label={c.cliente} sub={`${c.cobros} cobro(s)`} valor={formatearMoneda(c.ingreso, moneda)} />
          ))
        )}
      </Bloque>
    </View>
  );
}
