-- Caché del PDF de una cotización — se genera una sola vez y se sirve
-- desde storage en los siguientes pedidos, en vez de regenerarlo con
-- pdfkit cada clic. Se invalida (vuelve a null) cuando la cotización
-- se edita — ver PATCH /:id en cotizaciones.ts.
alter table presupuestos add column pdf_url text;
