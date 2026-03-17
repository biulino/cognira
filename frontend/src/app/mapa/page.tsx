"use client";

import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { api } from "@/lib/api";
import { MapPin, Navigation, Filter, RefreshCw, Route, Info, Thermometer, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";

// ── Dynamic Leaflet map (SSR-disabled) ────────────────────────────────────────
const MapView = dynamic(() => import("@/components/MapView"), { ssr: false, loading: () => (
  <div className="flex-1 flex items-center justify-center bg-slate-100 dark:bg-slate-800 rounded-lg">
    <div className="text-slate-500 text-sm">A carregar mapa…</div>
  </div>
)});

// ── Types ─────────────────────────────────────────────────────────────────────
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

// Haversine distance in km
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Nearest-neighbour TSP heuristic
function optimizeRoute(points: Estabelecimento[]): Estabelecimento[] {
  if (points.length <= 2) return points;
  const visited = new Set<number>();
  const route: Estabelecimento[] = [points[0]];
  visited.add(points[0].id);
  while (route.length < points.length) {
    const last = route[route.length - 1];
    let nearest = points.find(p => !visited.has(p.id))!;
    let minDist = Infinity;
    for (const p of points) {
      if (visited.has(p.id) || !p.latitude || !p.longitude || !last.latitude || !last.longitude) continue;
      const d = haversine(last.latitude, last.longitude, p.latitude, p.longitude);
      if (d < minDist) { minDist = d; nearest = p; }
    }
    route.push(nearest);
    visited.add(nearest.id);
  }
  return route;
}

export default function MapaPage() {
  const { t } = useI18n();
  const [estabelecimentos, setEstabelecimentos] = useState<Estabelecimento[]>([]);
  const [visitas, setVisitas] = useState<Visita[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedCliente, setSelectedCliente] = useState<number | null>(null);
  const [selectedEstado, setSelectedEstado] = useState<string>("todas");
  const [showRoute, setShowRoute] = useState(false);
  const [routeOptimized, setRouteOptimized] = useState<Estabelecimento[]>([]);
  const [routeOptimizing, setRouteOptimizing] = useState(false);
  const [routeTotalKm, setRouteTotalKm] = useState(0);
  const [routeImprovementPct, setRouteImprovementPct] = useState<number | null>(null);
  const [hoveredEstab, setHoveredEstab] = useState<Estabelecimento | null>(null);
  const [scoreMode, setScoreMode] = useState(false);
  const [scoreData, setScoreData] = useState<Record<number, number | null>>({});
  const [scoreLoading, setScoreLoading] = useState(false);

  const handleToggleScoreMode = async () => {
    if (scoreMode) { setScoreMode(false); return; }
    try {
      setScoreLoading(true);
      const raw = await api.get<Record<string, number>>("/estabelecimentos/scores");
      setScoreData(Object.fromEntries(Object.entries(raw).map(([k, v]) => [Number(k), v])));
      setScoreMode(true);
    } catch { /* silent */ } finally {
      setScoreLoading(false);
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [estabs, clientes, visitasData] = await Promise.all([
        api.get<Estabelecimento[]>("/estabelecimentos/?page_size=5000"),
        api.get<Cliente[]>("/clientes/"),
        api.get<{ items: Visita[] }>("/visitas/?page_size=500"),
      ]);
      setEstabelecimentos(estabs);
      setClientes(clientes);
      setVisitas(visitasData.items ?? []);
    } catch {
      setError("Erro ao carregar dados do mapa.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filteredEstabs = estabelecimentos.filter(e => {
    if (!e.latitude || !e.longitude) return false;
    if (selectedCliente && e.cliente_id !== selectedCliente) return false;
    return true;
  });

  const visitasByEstab = visitas.reduce<Record<number, Visita[]>>((acc, v) => {
    (acc[v.estabelecimento_id] ||= []).push(v);
    return acc;
  }, {});

  const filteredByEstado = (estabId: number) => {
    const vs = visitasByEstab[estabId] || [];
    if (selectedEstado === "todas") return vs;
    return vs.filter(v => v.estado === selectedEstado);
  };

  const handleOptimizeRoute = async () => {
    // Immediate nearest-neighbour preview
    const nn = optimizeRoute(filteredEstabs);
    setRouteOptimized(nn);
    setRouteImprovementPct(null);
    setShowRoute(true);

    // Then call backend 2-opt for a better solution
    try {
      setRouteOptimizing(true);
      const ids = filteredEstabs.map(e => e.id);
      const result = await api.post<{
        route: { id: number; nome: string; latitude: number | null; longitude: number | null }[];
        total_km: number;
        improvement_pct: number;
      }>("/estabelecimentos/route-optimize", { ids });
      // Merge back into full Estabelecimento objects
      const byId = Object.fromEntries(filteredEstabs.map(e => [e.id, e]));
      const ordered = result.route
        .map(r => byId[r.id])
        .filter(Boolean) as Estabelecimento[];
      setRouteOptimized(ordered);
      setRouteTotalKm(result.total_km);
      setRouteImprovementPct(result.improvement_pct);
    } catch {
      // keep nearest-neighbour result
    } finally {
      setRouteOptimizing(false);
    }
  };

  const totalKm = routeTotalKm > 0 ? routeTotalKm : routeOptimized.reduce((sum, p, i) => {
    if (i === 0) return 0;
    const prev = routeOptimized[i - 1];
    if (!prev.latitude || !prev.longitude || !p.latitude || !p.longitude) return sum;
    return sum + haversine(prev.latitude, prev.longitude, p.latitude, p.longitude);
  }, 0);

  const ESTADOS = ["todas", "nova", "planeada", "inserida", "validada", "fechada", "anulada"];
  const ESTADO_COLORS: Record<string, string> = {
    nova: "bg-slate-100 text-slate-700", planeada: "bg-blue-100 text-blue-700",
    inserida: "bg-yellow-100 text-yellow-800", validada: "bg-green-100 text-green-700",
    fechada: "bg-emerald-100 text-emerald-800", anulada: "bg-red-100 text-red-700",
  };

  return (
    <div className="h-full flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <MapPin className="text-brand flex-shrink-0" size={22} />
          <h1 className="text-xl font-bold text-slate-800 dark:text-white truncate">{t("mapa.title")}</h1>
        </div>
        <div className="sm:ml-auto flex flex-wrap gap-2">
          <button
            onClick={handleToggleScoreMode}
            disabled={scoreLoading}
            title={scoreLoading ? "A carregar..." : scoreMode ? "Heatmap Ativo" : "Heatmap Score"}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg font-medium transition-colors disabled:opacity-60 ${
              scoreMode
                ? "bg-orange-500 text-white hover:bg-orange-600"
                : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50"
            }`}
          >
            <Thermometer size={14} />
            <span className="hidden sm:inline">{scoreLoading ? "A carregar..." : scoreMode ? "Heatmap Ativo" : "Heatmap Score"}</span>
          </button>
          <button
            onClick={load}
            title="Actualizar"
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            <RefreshCw size={14} /><span className="hidden sm:inline"> Actualizar</span>
          </button>
          <button
            onClick={showRoute ? () => { setShowRoute(false); setRouteTotalKm(0); setRouteImprovementPct(null); } : handleOptimizeRoute}
            disabled={routeOptimizing}
            title={routeOptimizing ? "Optimizando..." : showRoute ? "Limpar rota" : "Optimizar Rota"}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
              showRoute
                ? "bg-brand text-white hover:bg-brand/90"
                : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50"
            } disabled:opacity-60`}
          >
            <Route size={14} />
            <span className="hidden sm:inline">{routeOptimizing
              ? "Optimizando..."
              : showRoute
              ? `Rota (${Math.round(totalKm)} km${routeImprovementPct !== null ? ` ↓${routeImprovementPct}%` : ""}) — Limpar`
              : "Optimizar Rota"}</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
        <div className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400 flex-shrink-0">
          <Filter size={14} />
          <span className="font-medium hidden sm:inline">Filtros:</span>
        </div>
        <select
          className="flex-1 min-w-[120px] text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200"
          value={selectedCliente ?? ""}
          onChange={e => setSelectedCliente(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">{t("mapa.allClients")}</option>
          {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
        <select
          className="flex-1 min-w-[120px] text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200"
          value={selectedEstado}
          onChange={e => setSelectedEstado(e.target.value)}
        >
          {ESTADOS.map(s => <option key={s} value={s}>{s === "todas" ? "Todos os estados" : s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
        </select>
        <div className="ml-auto text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 flex-shrink-0">
          <Navigation size={12} />
          {filteredEstabs.length} est.
        </div>
      </div>

      {/* Score legend */}
      {scoreMode && (
        <div className="flex items-center gap-4 px-4 py-2 bg-orange-50 dark:bg-orange-950/20 border border-orange-100 dark:border-orange-900 rounded-lg text-xs">
          <span className="font-semibold text-orange-700 dark:text-orange-400 flex items-center gap-1.5"><Thermometer size={13} />{t("mapa.heatmap")}</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full bg-[#22c55e]"></span> ≥80%</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full bg-[#eab308]"></span> ≥60%</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full bg-[#ef4444]"></span> &lt;60%</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full bg-[#94a3b8]"></span> Sem dados</span>
        </div>
      )}

      {/* Map + Info panel */}
      <div className="flex-1 flex gap-4 min-h-0">
        {/* Map */}
        <div className="flex-1 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 min-h-[500px]">
          {loading ? (
            <div className="w-full h-full flex items-center justify-center bg-slate-100 dark:bg-slate-800">
              <div className="text-slate-500 animate-pulse">A carregar...</div>
            </div>
          ) : error ? (
            <div className="w-full h-full flex items-center justify-center bg-red-50">
              <div className="text-red-500 text-sm">{error}</div>
            </div>
          ) : (
            <MapView
              estabelecimentos={filteredEstabs}
              visitasByEstab={visitasByEstab}
              selectedEstado={selectedEstado}
              clientes={clientes}
              route={showRoute ? routeOptimized : []}
              onHover={setHoveredEstab}
              scoreData={scoreMode ? scoreData : undefined}
            />
          )}
        </div>

        {/* Info panel */}
        {hoveredEstab && (
          <div className="w-72 flex-shrink-0 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3 overflow-y-auto max-h-[60vh] lg:max-h-full">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2 min-w-0">
                <MapPin size={16} className="text-brand mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <div className="font-semibold text-slate-800 dark:text-white text-sm leading-tight">{hoveredEstab.nome}</div>
                  {hoveredEstab.id_loja_externo && (
                    <div className="text-xs text-slate-500 dark:text-slate-400">{hoveredEstab.id_loja_externo}</div>
                  )}
                </div>
              </div>
              <button
                onClick={() => setHoveredEstab(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition flex-shrink-0"
                title={t("common.close")}
              >
                <X size={14} />
              </button>
            </div>
            {hoveredEstab.regiao && (
              <div className="text-xs text-slate-600 dark:text-slate-300">
                <span className="font-medium">Região:</span> {hoveredEstab.regiao}
              </div>
            )}
            {hoveredEstab.tipo_canal && (
              <div className="text-xs text-slate-600 dark:text-slate-300">
                <span className="font-medium">Canal:</span> {hoveredEstab.tipo_canal}
              </div>
            )}
            {hoveredEstab.latitude && hoveredEstab.longitude && (
              <div className="text-xs text-slate-400 font-mono">
                {hoveredEstab.latitude.toFixed(4)}, {hoveredEstab.longitude.toFixed(4)}
              </div>
            )}
            <div className="border-t border-slate-100 dark:border-slate-700 pt-2">
              <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">Visitas</div>
              {(() => {
                const vs = filteredByEstado(hoveredEstab.id);
                if (vs.length === 0) return <div className="text-xs text-slate-400">{t("mapa.noVisits")}</div>;
                const byEstado = vs.reduce<Record<string, number>>((a, v) => { a[v.estado] = (a[v.estado] || 0) + 1; return a; }, {});
                return (
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(byEstado).map(([e, cnt]) => (
                      <span key={e} className={`text-xs px-2 py-0.5 rounded-full font-medium ${ESTADO_COLORS[e] || "bg-slate-100 text-slate-600"}`}>
                        {e}: {cnt}
                      </span>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        )}
        {!hoveredEstab && !loading && !error && (
          <div className="w-72 flex-shrink-0 hidden lg:flex items-center justify-center bg-slate-50 dark:bg-slate-800/50 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
            <div className="text-center text-xs text-slate-400 p-4">
              <Info size={20} className="mx-auto mb-2 opacity-40" />
              Clique ou passe o rato sobre um pin do mapa para ver detalhes do estabelecimento.
            </div>
          </div>
        )}
      </div>

      {/* Route summary */}
      {showRoute && routeOptimized.length > 1 && (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Route size={16} className="text-brand" />
            <span className="font-semibold text-slate-800 dark:text-white text-sm">
              Rota Optimizada — {routeOptimized.length} paragens · {Math.round(totalKm)} km total
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {routeOptimized.map((e, i) => (
              <div key={e.id} className="flex items-center gap-1.5 text-xs bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1">
                <span className="w-4 h-4 rounded-full bg-brand text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0">{i + 1}</span>
                <span className="text-slate-700 dark:text-slate-200 truncate max-w-[120px]">{e.nome}</span>
                {i < routeOptimized.length - 1 && e.latitude && routeOptimized[i + 1].latitude && (
                  <span className="text-slate-400 font-mono ml-1">
                    {Math.round(haversine(e.latitude!, e.longitude!, routeOptimized[i + 1].latitude!, routeOptimized[i + 1].longitude!))} km
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
