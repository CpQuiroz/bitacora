-- ============================================================
-- BITÁCORA — Tercer valor de empresas.tema: 'confianza'.
--
-- Mismo mecanismo que 'taller' (migración 109) — un tema alternativo
-- por empresa, seleccionable en Configuración > Empresa. A diferencia
-- de 'taller' (colores + tipografía Archivo), 'confianza' es SOLO
-- color: azul clásico + acento naranja, pensado como alternativa
-- "segura" de confianza para negocios que recién arrancan con
-- clientes nuevos (investigación de mercado, ver progress/current.md).
-- Sigue usando Caprasimo/Figtree, igual que 'faena'.
--
-- Postgres no tiene "alter check" — hay que sacar el constraint viejo
-- y poner uno nuevo con el valor agregado.
-- ============================================================

alter table empresas drop constraint empresas_tema_check;

alter table empresas
  add constraint empresas_tema_check
    check (tema in ('faena', 'taller', 'confianza'));
