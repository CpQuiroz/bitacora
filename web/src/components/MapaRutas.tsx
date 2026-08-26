"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

export type Parada = {
  trabajo_id: string;
  cliente_nombre: string;
  direccion: string;
  lat: number | null;
  lng: number | null;
};

// Ícono propio (círculo numerado) — evita el problema clásico de
// Leaflet con los íconos por defecto, cuyas rutas de imagen no
// resuelven bien con bundlers como Turbopack/Webpack.
function iconoParada(L: typeof import("leaflet"), numero: number) {
  return L.divIcon({
    className: "",
    html: `<div style="
      background:#4338ca;color:#fff;width:28px;height:28px;border-radius:9999px;
      display:flex;align-items:center;justify-content:center;font:600 13px system-ui;
      box-shadow:0 1px 4px rgba(0,0,0,.35);border:2px solid #fff;
    ">${numero}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

export function MapaRutas({ paradas }: { paradas: Parada[] }) {
  const contenedorRef = useRef<HTMLDivElement>(null);
  const mapaRef = useRef<import("leaflet").Map | null>(null);

  useEffect(() => {
    let cancelado = false;

    import("leaflet").then((L) => {
      if (cancelado || !contenedorRef.current) return;

      const conCoords = paradas.filter(
        (p): p is Parada & { lat: number; lng: number } => p.lat != null && p.lng != null
      );

      if (!mapaRef.current) {
        mapaRef.current = L.map(contenedorRef.current).setView([-33.45, -70.66], 11);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
        }).addTo(mapaRef.current);
      }
      const mapa = mapaRef.current;

      mapa.eachLayer((layer) => {
        if (layer instanceof L.Marker) mapa.removeLayer(layer);
      });

      if (conCoords.length === 0) return;

      const puntos: [number, number][] = conCoords.map((p) => [p.lat, p.lng]);
      conCoords.forEach((p, i) => {
        L.marker([p.lat, p.lng], { icon: iconoParada(L, i + 1) })
          .addTo(mapa)
          .bindPopup(`<strong>${p.cliente_nombre}</strong><br/>${p.direccion}`);
      });

      if (puntos.length === 1) {
        mapa.setView(puntos[0], 14);
      } else {
        mapa.fitBounds(L.latLngBounds(puntos), { padding: [30, 30] });
      }
    });

    return () => {
      cancelado = true;
    };
  }, [paradas]);

  useEffect(() => {
    return () => {
      mapaRef.current?.remove();
      mapaRef.current = null;
    };
  }, []);

  return (
    <div
      ref={contenedorRef}
      className="h-80 w-full rounded-xl border border-border sm:h-96"
    />
  );
}
