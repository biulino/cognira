"use client";

/**
 * PlanoMap — renders the geo-optimised analyst routes on a Leaflet map.
 *
 * Each analyst gets a distinct colour. Establishments are shown as numbered
 * markers in visit order; analysts' routes are connected by polylines.
 *
 * This component is dynamically imported with `ssr: false` to avoid
 * the "window is not defined" error from Leaflet.
 */

import { useEffect, Fragment } from "react";
import {
  MapContainer,
  TileLayer,
  Polyline,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// ── Palette — up to 10 analysts, cycling if more ────────────────────────────
const PALETTE = [
  "#e11d48", // rose-600
  "#2563eb", // blue-600
  "#16a34a", // green-600
  "#d97706", // amber-600
  "#7c3aed", // violet-600
  "#0891b2", // cyan-600
  "#db2777", // pink-600
  "#ea580c", // orange-600
  "#059669", // emerald-600
  "#6d28d9", // purple-600
];

// ── Types ────────────────────────────────────────────────────────────────────
export interface GeoRotaItem {
  ordem: number;
  estabelecimento_id: number;
  nome: string;
  lat: number;
  lng: number;
  km_desde_anterior: number;
  zona?: number;
}

export interface PlanoItem {
  analista_id: number;
  analista_nome: string;
  distancia_total_km: number | null;
  num_zonas?: number;
  geo_rota: GeoRotaItem[] | null;
}

interface PlanoMapProps {
  plano: PlanoItem[];
}

// ── AutoFit — fits the map bounds to show all markers on mount ───────────────
function AutoFit({ bounds }: { bounds: L.LatLngBoundsExpression | null }) {
  const map = useMap();
  useEffect(() => {
    if (!bounds) return;
    try {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    } catch {
      /* ignore if bounds are invalid */
    }
  }, [map, bounds]);
  return null;
}

// ── Numbered icon factory ────────────────────────────────────────────────────
function numberedIcon(n: number, color: string): L.DivIcon {
  return L.divIcon({
    className: "",
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
    html: `<div style="
      width:28px;height:28px;border-radius:50%;
      background:${color};color:#fff;
      display:flex;align-items:center;justify-content:center;
      font-size:11px;font-weight:700;
      border:2px solid white;
      box-shadow:0 1px 4px rgba(0,0,0,.4);">${n}</div>`,
  });
}

// ── Main component ───────────────────────────────────────────────────────────
export default function PlanoMap({ plano }: PlanoMapProps) {
  // Collect all coords for bounds calculation — skip null/missing coordinates
  const allCoords: L.LatLngTuple[] = [];
  plano.forEach((item) => {
    item.geo_rota?.forEach((r) => {
      if (r.lat != null && r.lng != null) allCoords.push([r.lat, r.lng]);
    });
  });

  const bounds: L.LatLngBoundsExpression | null =
    allCoords.length >= 2 ? allCoords : null;

  const center: L.LatLngTuple =
    allCoords.length > 0
      ? [
          allCoords.reduce((s, c) => s + c[0], 0) / allCoords.length,
          allCoords.reduce((s, c) => s + c[1], 0) / allCoords.length,
        ]
      : [39.5, -8.0]; // centre of Portugal as fallback

  return (
    <div className="rounded-xl overflow-hidden border border-slate-200 shadow-sm">
      {/* Legend */}
      <div className="bg-white px-4 py-2.5 flex flex-wrap gap-x-5 gap-y-1 border-b border-slate-100">
        {plano
          .filter((item) => item.geo_rota && item.geo_rota.length > 0)
          .map((item, i) => (
            <span key={item.analista_id} className="flex items-center gap-1.5 text-xs text-slate-700">
              <span
                className="inline-block w-3 h-3 rounded-full flex-shrink-0"
                style={{ background: PALETTE[i % PALETTE.length] }}
              />
              <span className="font-medium truncate max-w-[160px]">{item.analista_nome}</span>
              {item.distancia_total_km != null && (
                <span className="text-slate-400">
                  ({item.distancia_total_km} km{item.num_zonas && item.num_zonas > 1 ? ` · ${item.num_zonas} zonas` : ""})
                </span>
              )}
            </span>
          ))}
      </div>

      {/* Map */}
      <MapContainer
        center={center}
        zoom={6}
        style={{ height: "420px", width: "100%" }}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {bounds && <AutoFit bounds={bounds} />}

        {plano.map((item, analystIdx) => {
          if (!item.geo_rota || item.geo_rota.length === 0) return null;
          const color = PALETTE[analystIdx % PALETTE.length];
          const positions: L.LatLngTuple[] = item.geo_rota
            .filter((r) => r.lat != null && r.lng != null)
            .map((r) => [r.lat, r.lng]);

          return (
            <Fragment key={item.analista_id}>
              {/* Route polyline */}
              <Polyline
                positions={positions}
                pathOptions={{ color, weight: 3, opacity: 0.75, dashArray: "6 4" }}
              />

              {/* Numbered markers */}
              {item.geo_rota.map((r) => (
                <Marker
                  key={`${item.analista_id}-${r.ordem}`}
                  position={[r.lat, r.lng]}
                  icon={numberedIcon(r.ordem, color)}
                >
                  <Popup>
                    <div className="text-xs leading-snug">
                      <p className="font-semibold">{r.nome}</p>
                      <p className="text-slate-500">
                        {item.analista_nome} · Paragem {r.ordem}
                        {r.zona ? ` · Zona ${r.zona}` : ""}
                      </p>
                      {r.km_desde_anterior > 0 && (
                        <p className="text-slate-400">{r.km_desde_anterior} km desde anterior</p>
                      )}
                    </div>
                  </Popup>
                </Marker>
              ))}
            </Fragment>
          );
        })}
      </MapContainer>
    </div>
  );
}
