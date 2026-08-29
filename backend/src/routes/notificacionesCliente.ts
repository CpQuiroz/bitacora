// ============================================================
// BITÁCORA — Historial de notificaciones al cliente (Configuración >
// Notificaciones) + reenvío manual de las que fallaron. Gateado por
// "financiero" (admin + contador): la mayoría de los 6 eventos son de
// cotizaciones/cobros, y esos módulos ya son financiero-only — más
// simple un solo gate que partir el historial por tipo de evento.
// ============================================================
import { Router } from "express";
import type { TipoNotificacionCliente } from "@bitacora/shared";
import { supabase } from "../supabase";
import { requiereModulo } from "../permisos";
import { notificarCliente } from "../notificarCliente";
import { avisarCitaAgendada } from "../agendaProAvisos";
import { armarDatosPdfCotizacion } from "./cotizaciones";
import { generarPdfCotizacion } from "../generarPdfCotizacion";
import { armarDatosPdf } from "./trabajos";
import { generarPdfOS } from "../generarPdfOS";
import type { RequestConEmpresa } from "../empresa";
import { ah } from "../asyncHandler";

export const notificacionesClienteRouter = Router();

notificacionesClienteRouter.get(
  "/",
  requiereModulo("financiero"),
  ah<RequestConEmpresa>(async (req, res) => {
    const { data, error } = await supabase
      .from("notificaciones_cliente_log")
      .select("*")
      .eq("empresa_id", req.empresaId!)
      .order("creado_en", { ascending: false })
      .limit(100);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data);
  })
);

notificacionesClienteRouter.post(
  "/:id/reenviar",
  requiereModulo("financiero"),
  ah<RequestConEmpresa>(async (req, res) => {
    const { data: fila } = await supabase
      .from("notificaciones_cliente_log")
      .select("*")
      .eq("empresa_id", req.empresaId!)
      .eq("id", req.params.id)
      .maybeSingle();
    if (!fila) {
      res.status(404).json({ error: "Registro no encontrado" });
      return;
    }
    const tipo = fila.tipo as TipoNotificacionCliente;
    const { data: empresa } = await supabase.from("empresas").select("nombre").eq("id", req.empresaId!).single();

    if (tipo === "cotizacion_enviada" || tipo === "cotizacion_por_vencer") {
      const datos = await armarDatosPdfCotizacion(req.empresaId!, fila.entidad_id);
      if (!datos || !datos.clienteId) {
        res.status(404).json({ error: "La cotización ya no existe" });
        return;
      }
      await notificarCliente(req.empresaId!, tipo, fila.destinatario, {
        clienteId: datos.clienteId,
        entidadTipo: "cotizacion",
        entidadId: fila.entidad_id,
        variables: {
          cliente: datos.clienteNombre,
          fecha: tipo === "cotizacion_por_vencer" ? datos.fechaVencimiento ?? datos.fecha : datos.fecha,
          monto: `$${Math.round(datos.total).toLocaleString("es-CL")}`,
          empresa: datos.empresaNombre,
        },
        adjunto: tipo === "cotizacion_enviada" ? { filename: `${datos.numeroTexto}.pdf`, buffer: await generarPdfCotizacion(datos) } : undefined,
      });
    } else if (tipo === "os_completada") {
      const datos = await armarDatosPdf(req.empresaId!, fila.entidad_id);
      if (!datos || !datos.clienteId) {
        res.status(404).json({ error: "El trabajo ya no existe" });
        return;
      }
      await notificarCliente(req.empresaId!, "os_completada", fila.destinatario, {
        clienteId: datos.clienteId,
        entidadTipo: "trabajo",
        entidadId: fila.entidad_id,
        variables: { cliente: datos.clienteNombre, empresa: datos.empresaNombre, tecnico: datos.colaboradorNombre },
        adjunto: { filename: `${datos.folioTexto}.pdf`, buffer: await generarPdfOS(datos) },
      });
    } else if (tipo === "tecnico_en_camino") {
      const { data: trabajo } = await supabase
        .from("trabajos")
        .select("cliente, cliente_id, responsable:usuarios(nombre)")
        .eq("empresa_id", req.empresaId!)
        .eq("id", fila.entidad_id)
        .maybeSingle();
      if (!trabajo || !trabajo.cliente_id) {
        res.status(404).json({ error: "El trabajo ya no existe" });
        return;
      }
      const tecnico = (trabajo as unknown as { responsable: { nombre: string } | null })?.responsable?.nombre ?? "Nuestro equipo";
      await notificarCliente(req.empresaId!, "tecnico_en_camino", fila.destinatario, {
        clienteId: trabajo.cliente_id,
        entidadTipo: "trabajo",
        entidadId: fila.entidad_id,
        variables: { cliente: trabajo.cliente, tecnico, empresa: empresa?.nombre ?? "" },
      });
    } else if (tipo === "cita_agendada") {
      // No existía rama para este tipo — el botón "Reenviar" quedaba en
      // no-op silencioso. Reusa avisarCitaAgendada tal cual (reintenta
      // ambos canales configurados, no solo el que falló — aceptable
      // acá, evita duplicar la lógica de armar variables/canal por canal).
      const { data: tarea } = await supabase
        .from("tareas")
        .select("fecha, hora, cliente_id")
        .eq("empresa_id", req.empresaId!)
        .eq("id", fila.entidad_id)
        .maybeSingle();
      if (!tarea || !tarea.cliente_id) {
        res.status(404).json({ error: "La cita ya no existe" });
        return;
      }
      await avisarCitaAgendada(req.empresaId!, fila.entidad_id, tarea.fecha, tarea.hora, tarea.cliente_id);
    } else if (tipo === "cobro_pendiente" || tipo === "cobro_vencido") {
      const { data: factura } = await supabase
        .from("facturas")
        .select("monto, fecha_vencimiento, cliente_id, cliente_info:clientes(nombre)")
        .eq("empresa_id", req.empresaId!)
        .eq("id", fila.entidad_id)
        .maybeSingle();
      if (!factura || !factura.cliente_id) {
        res.status(404).json({ error: "El cobro ya no existe" });
        return;
      }
      const clienteInfo = (factura as unknown as { cliente_info: { nombre: string } | null }).cliente_info;
      await notificarCliente(req.empresaId!, tipo, fila.destinatario, {
        clienteId: factura.cliente_id,
        entidadTipo: "factura",
        entidadId: fila.entidad_id,
        variables: {
          cliente: clienteInfo?.nombre ?? "",
          fecha: factura.fecha_vencimiento,
          monto: `$${Math.round(factura.monto).toLocaleString("es-CL")}`,
          empresa: empresa?.nombre ?? "",
        },
      });
    }

    res.json({ ok: true });
  })
);
