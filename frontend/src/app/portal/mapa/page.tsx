"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowLeft, Map as MapIcon } from "lucide-react";
import { api } from "@/lib/api";

// Leaflet only runs client-side
const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });

// ── Types ─────────────────────────────────────────────────────────────────────
interface MapPoint {
  id: number;
  nome: string;
  lat: number;
  lng: number;
  total_visitas: number;
  pontuacao_media: number | null;
}

interface EstudoOpt {
  id: number;
  nome: string;
}

interface EstudoItem {
  id: number;
  nome: string;
  estado: string;
}

// ── Adapters to satisfy MapView's expected types ──────────────────────────────
function toEstab(p: MapPoint) {
  return {
    id: p.id,
    nome: p.nome,
    cliente_id: 0,
    id_loja_externo: null,
    tipo_canal: null,
    regiao: null,
    morada: null,
    latitude: p.lat,
    longitude: p.lng,
    activo: true,
  };
}

// ── Legend ────────────────────────────────────────────────────────────────────
function ScoreLegend() {
  return (
    <div className="flex flex-wrap gap-3 text-xs text-slate-600 dark:text-slate-300">
      {[
        { color: "bg-emerald-500", label: "≥ 80% — Excelente" },
        { color: "bg-yellow-400", label: "60–79% — Aceitável" },
        { color: "bg-red-400", label: "< 60% — Crítico" },
        { color: "bg-slate-400", label: "Sem pontuação" },
      ].map(({ color, label }) => (
        <div key={label} className="flex items-center gap-1.5">
          <span className={`inline-block w-3 h-3 rounded-full ${color}`} />
          {label}
        </div>
      ))}
    </div>
  );
}

// ── Inner component (uses searchParams) ──────────────────────────────────────
function PortalMapaInner() {
  const searchParams = useSearchParams();
  const initialEstudo = searchParams.get("estudo") ? Number(searchParams.get("estudo")) : null;

  const [estudos, setEstudos] = useState<EstudoOpt[]>([]);
  const [selectedEstudo, setSelectedEstudo] = useState<number | null>(initialEstudo);
  const [points, setPoints] = useState<MapPoint[]>([]);
  const [loading, setLoading] = useState(false);

  // Load available studies
  useEffect(() => {
    api
      .get<{ estudos: EstudoItem[] }>("/portal/dashboard")
      .then((d) => {
        const opts = d.estudos.map((e) => ({ id: e.id, nome: e.nome }));
        setEstudos(opts);
        if (!selectedEstudo && opts.length > 0) setSelectedEstudo(opts[0].id);
      })
      .catch(() => {});
  }, [selectedEstudo]);

  // Load map data when study changes
  useEffect(() => {
    if (!selectedEstudo) return;
    setLoading(true);
    api
      .get<MapPoint[]>(`/portal/mapa/${selectedEstudo}`)
      .then(setPoints)
      .catch(() => setPoints([]))
      .finally(() => setLoading(false));
  }, [selectedEstudo]);

  const scoreData: Record<number, number | null> = {};
  for (const p of points) scoreData[p.id] = p.pontuacao_media;

  const estabelecimentos = points.map(toEstab);

  return (
    <main className="flex flex-col h-[calc(100vh-64px)]">
      {/* Toolbar */}
      <div className="flex items-center gap-4 px-4 py-3 border-b border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-900 z-10">
        <Link
          href="/portal"
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="w-4 h-4" /> Portal
        </Link>
        <MapIcon className="w-4 h-4 text-indigo-500" />
        <h1 className="font-semibold text-slate-900 dark:text-white text-sm">
          Mapa de Resultados
        </h1>
        <div className="ml-auto flex items-center gap-2">
          {estudos.length > 1 && (
            <select
              className="text-sm px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"
              value={selectedEstudo ?? ""}
              onChange={(e) => setSelectedEstudo(Number(e.target.value))}
            >
              {estudos.map((est) => (
                <option key={est.id} value={est.id}>
                  {est.nome}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="px-4 py-2 bg-white/80 dark:bg-slate-900/80 border-b border-slate-100 dark:border-slate-700">
        <ScoreLegend />
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-white/60">
            <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {!loading && (
          <MapView
            estabelecimentos={estabelecimentos}
            visitasByEstab={{}}
            selectedEstado="todas"
            clientes={[]}
            route={[]}
            onHover={() => {}}
            scoreData={scoreData}
          />
        )}
      </div>
    </main>
  );
}

// ── Page wrapper (required for useSearchParams) ───────────────────────────────
export default function PortalMapaPage() {
  return (
    <Suspense>
      <PortalMapaInner />
    </Suspense>
  );
}
