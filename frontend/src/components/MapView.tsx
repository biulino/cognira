"use client";

import { useEffect, useRef, useMemo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix Leaflet's default icon resolution under webpack/Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

interface Estabelecimento {
  id: number;
  nome: string;
  cliente_id: number;
  id_loja_externo: string | null;
  tipo_canal: string | null;
  regiao: string | null;
  morada: string | null;
  latitude: number | null;
  longitude: number | null;
  activo: boolean;
}

interface Visita {
  id: number;
  estabelecimento_id: number;
  estado: string;
  analista_nome: string | null;
  planeada_em: string | null;
}

interface Cliente {
  id: number;
  nome: string;
}

interface Props {
  estabelecimentos: Estabelecimento[];
  visitasByEstab: Record<number, Visita[]>;
  selectedEstado: string;
  clientes: Cliente[];
  route: Estabelecimento[];
  onHover: (e: Estabelecimento | null) => void;
  /** When provided, markers are coloured by score instead of client colour. */
  scoreData?: Record<number, number | null>;
}

// Create a coloured circle marker icon
function makeIcon(color: string, label?: string): L.DivIcon {
  const inner = label
    ? `<span style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:#fff;">${label}</span>`
    : "";
  return L.divIcon({
    className: "",
    html: `<div style="position:relative;width:24px;height:24px;background:${color};border:2px solid rgba(255,255,255,0.85);border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,.35);">${inner}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -14],
  });
}

// Client colour per cliente_id — cycling through a palette
const PALETTE = ["#e03131", "#1971c2", "#2f9e44", "#e67700", "#862e9c", "#1098ad", "#c2255c"];
const clientColorMap = new Map<number, string>();
function clientColor(id: number): string {
  if (!clientColorMap.has(id)) {
    clientColorMap.set(id, PALETTE[clientColorMap.size % PALETTE.length]);
  }
  return clientColorMap.get(id)!;
}

function scoreColor(score: number | null | undefined): string {
  if (score == null) return "#94a3b8"; // grey = no data
  if (score >= 80) return "#22c55e"; // green
  if (score >= 60) return "#eab308"; // yellow
  return "#ef4444"; // red
}

export default function MapView({ estabelecimentos, visitasByEstab, selectedEstado, clientes, route, onHover, scoreData }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.CircleMarker[]>([]);
  const routeLayerRef = useRef<L.LayerGroup | null>(null);

  // Build visita count by state
  const visitaCount = (estabId: number) => {
    const vs = visitasByEstab[estabId] || [];
    if (selectedEstado === "todas") return vs.length;
    return vs.filter(v => v.estado === selectedEstado).length;
  };

  // Initialise map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: [39.5, -8.0],
      zoom: 7,
      zoomControl: false,
    });
    L.control.zoom({ position: "bottomright" }).addTo(map);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);
    mapRef.current = map;
    routeLayerRef.current = L.layerGroup().addTo(map);
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update markers when establishments or filters change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remove old markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    for (const e of estabelecimentos) {
      if (!e.latitude || !e.longitude) continue;
      const color = scoreData ? scoreColor(scoreData[e.id]) : clientColor(e.cliente_id);
      const cnt = visitaCount(e.id);
      const clienteName = clientes.find(c => c.id === e.cliente_id)?.nome ?? `Cliente ${e.cliente_id}`;

      const marker = L.circleMarker([e.latitude, e.longitude], {
        radius: 8,
        fillColor: color,
        color: "#fff",
        weight: 2,
        opacity: 1,
        fillOpacity: 0.85,
      });

      const popupHtml = `
        <div style="min-width:180px;font-family:system-ui,sans-serif">
          <div style="font-weight:700;font-size:13px;margin-bottom:4px;color:#1e293b">${e.nome}</div>
          <div style="font-size:11px;color:#64748b;margin-bottom:6px">${e.id_loja_externo ?? ""}</div>
          <div style="display:flex;flex-direction:column;gap:2px;font-size:12px">
            ${e.regiao ? `<span><b>Região:</b> ${e.regiao}</span>` : ""}
            ${e.tipo_canal ? `<span><b>Canal:</b> ${e.tipo_canal}</span>` : ""}
            <span style="margin-top:2px"><b>Cliente:</b> <span style="color:${color};font-weight:600">${clienteName}</span></span>
            <span style="margin-top:4px;padding:3px 6px;background:#f1f5f9;border-radius:4px;display:inline-block">
              Visitas${selectedEstado !== "todas" ? ` (${selectedEstado})` : ""}: <b>${cnt}</b>
            </span>
          </div>
          ${e.morada ? `<div style="font-size:11px;color:#94a3b8;margin-top:6px">${e.morada}</div>` : ""}
        </div>
      `;

      marker.bindPopup(popupHtml, { maxWidth: 260 });
      marker.on("mouseover", () => onHover(e));
      marker.on("click", () => { marker.openPopup(); onHover(e); });
      marker.addTo(map);
      markersRef.current.push(marker);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estabelecimentos, selectedEstado, clientes]);

  // Update route layer
  useEffect(() => {
    const rl = routeLayerRef.current;
    if (!rl) return;
    rl.clearLayers();
    if (!route || route.length < 2) return;

    const latlngs: [number, number][] = route
      .filter(e => e.latitude && e.longitude)
      .map(e => [e.latitude!, e.longitude!]);

    if (latlngs.length >= 2) {
      L.polyline(latlngs, {
        color: "#3b82f6",
        weight: 3,
        opacity: 0.8,
        dashArray: "6 4",
      }).addTo(rl);

      // Numbered route markers on top
      latlngs.forEach((ll, i) => {
        L.marker(ll, { icon: makeIcon("#3b82f6", String(i + 1)), zIndexOffset: 1000 }).addTo(rl);
      });
    }
  }, [route]);

  return (
    <div ref={containerRef} style={{ width: "100%", height: "100%", minHeight: 500 }} />
  );
}
