"use client";

import { useEffect, useMemo, useState } from "react";
import HoldingsTable, { type HoldingRow } from "./HoldingsTable";

export type ClientRow = {
  user_id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  created_at: string;
  last_sign_in_at: string | null;
  terms_accepted: boolean;
  instruments_count: number;
  invested: number;
  current_value: number;
  unrealized_gain: number;
  day_change: number;
  realized_gain: number;
  trades_count: number;
  last_trade_at: string | null;
};

export type AdminHolding = HoldingRow & { user_id: string };

const ACTIVE_DAYS = 30;

function usd0(v: number) {
  return v.toLocaleString("es-UY", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}
function usd(v: number) {
  return v.toLocaleString("es-UY", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}
function signed(v: number, f: (n: number) => string) {
  return `${v > 0 ? "+" : v < 0 ? "−" : ""}${f(Math.abs(v))}`;
}
function pct(v: number) {
  return `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(1)}%`;
}
function tone(v: number) {
  return v > 0 ? "delta-up" : v < 0 ? "delta-down" : "muted";
}
function ago(iso: string | null) {
  if (!iso) return "Nunca";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 864e5);
  if (days <= 0) return "Hoy";
  if (days === 1) return "Ayer";
  if (days < 30) return `Hace ${days} días`;
  return new Date(iso).toLocaleDateString("es-UY");
}

export default function AdminClientsDashboard({
  clients,
  holdings,
}: {
  clients: ClientRow[];
  holdings: AdminHolding[];
}) {
  const [selectedId, setSelectedId] = useState<string>("");
  // Las fechas relativas ("Hace 3 días") dependen del reloj y la zona horaria
  // del navegador: se calculan recién en el cliente para no chocar con el
  // HTML generado en el servidor.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => setNow(Date.now()), []);
  const selected = clients.find((c) => c.user_id === selectedId) || null;
  const scope = selected ? [selected] : clients;

  const activeCutoff = (now ?? 0) - ACTIVE_DAYS * 864e5;
  const isActive = (c: ClientRow) =>
    now != null && !!c.last_sign_in_at && new Date(c.last_sign_in_at).getTime() >= activeCutoff;
  const when = (iso: string | null) => (now == null ? "…" : ago(iso));
  const day = (iso: string) => (now == null ? "…" : new Date(iso).toLocaleDateString("es-UY"));

  const k = useMemo(() => {
    const value = scope.reduce((s, r) => s + r.current_value, 0);
    const invested = scope.reduce((s, r) => s + r.invested, 0);
    const gain = value - invested;
    const day = scope.reduce((s, r) => s + r.day_change, 0);
    return {
      value,
      invested,
      gain,
      gainPct: invested > 0 ? (gain / invested) * 100 : 0,
      day,
      dayPct: value - day > 0 ? (day / (value - day)) * 100 : 0,
      realized: scope.reduce((s, r) => s + r.realized_gain, 0),
      trades: scope.reduce((s, r) => s + r.trades_count, 0),
      instruments: scope.reduce((s, r) => s + r.instruments_count, 0),
    };
  }, [scope]);

  const selectedHoldings = useMemo(
    () => (selected ? holdings.filter((h) => h.user_id === selected.user_id) : []),
    [holdings, selected]
  );
  const best = selectedHoldings
    .map((h) => ({
      symbol: h.instrument?.symbol,
      pct: h.avg_cost > 0 ? (((h.instrument?.current_price || 0) - h.avg_cost) / h.avg_cost) * 100 : 0,
    }))
    .sort((a, b) => b.pct - a.pct)[0];

  const pendingTerms = clients.filter((r) => !r.terms_accepted).length;
  const label = (c: ClientRow) => c.full_name?.trim() || c.email || "Sin nombre";

  return (
    <>
      <div className="client-picker">
        <label htmlFor="client-select">Ver</label>
        <select id="client-select" value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
          <option value="">Todos los clientes ({clients.length})</option>
          {clients.map((c) => (
            <option key={c.user_id} value={c.user_id}>
              {label(c)}
              {c.role === "admin" ? " (admin)" : ""}
            </option>
          ))}
        </select>
        {selected && (
          <button type="button" className="secondary-btn" onClick={() => setSelectedId("")}>
            Ver todos
          </button>
        )}
      </div>

      <div className="card">
        <h2 className="muted">
          {selected ? `Cartera de ${label(selected)}` : "Valor total en carteras de clientes"}
        </h2>
        <div className="hero-value">{usd0(k.value)}</div>
        <p style={{ margin: 0, fontSize: 14 }} className={tone(k.gain)}>
          {signed(k.gain, usd0)} ({pct(k.gainPct)}) sobre lo invertido ·{" "}
          <span className={tone(k.day)}>
            hoy {signed(k.day, usd0)} ({pct(k.dayPct)})
          </span>
        </p>
        {selected && (
          <p className="muted" style={{ margin: "8px 0 0", fontSize: 13 }}>
            {selected.email} · último ingreso: {when(selected.last_sign_in_at).toLowerCase()} ·
            registrado el {day(selected.created_at)}
            {!selected.terms_accepted && " · términos pendientes"}
          </p>
        )}
      </div>

      <div className="stat-grid stat-grid-3">
        {selected ? (
          <>
            <div className="stat-tile">
              <div className="stat-label">Instrumentos en cartera</div>
              <div className="stat-value">{selected.instruments_count}</div>
            </div>
            <div className="stat-tile">
              <div className="stat-label">Mejor posición</div>
              <div className={`stat-value ${best ? tone(best.pct) : "muted"}`} style={{ fontSize: 16 }}>
                {best ? `${best.symbol} (${pct(best.pct)})` : "—"}
              </div>
            </div>
            <div className="stat-tile">
              <div className="stat-label">Operaciones registradas</div>
              <div className="stat-value">{selected.trades_count}</div>
            </div>
          </>
        ) : (
          <>
            <div className="stat-tile">
              <div className="stat-label">Usuarios registrados</div>
              <div className="stat-value">{clients.length}</div>
            </div>
            <div className="stat-tile">
              <div className="stat-label">Activos (últimos {ACTIVE_DAYS} días)</div>
              <div className="stat-value">{now == null ? "…" : clients.filter(isActive).length}</div>
            </div>
            <div className="stat-tile">
              <div className="stat-label">Con cartera cargada</div>
              <div className="stat-value">{clients.filter((c) => c.instruments_count > 0).length}</div>
            </div>
          </>
        )}
        <div className="stat-tile">
          <div className="stat-label">Invertido</div>
          <div className="stat-value">{usd0(k.invested)}</div>
        </div>
        <div className="stat-tile">
          <div className="stat-label">Ganancia no realizada</div>
          <div className={`stat-value ${tone(k.gain)}`}>{signed(k.gain, usd0)}</div>
        </div>
        <div className="stat-tile">
          <div className="stat-label">Ganancia realizada</div>
          <div className={`stat-value ${tone(k.realized)}`}>{signed(k.realized, usd0)}</div>
        </div>
      </div>

      {selected && (
        <div className="card">
          <h2>Tenencias de {label(selected)}</h2>
          <HoldingsTable rows={selectedHoldings} />
        </div>
      )}

      <div className="card">
        <h2>Clientes</h2>
        <p className="tag-op" style={{ marginTop: -8 }}>
          Ordenados por valor de cartera. Tocá un cliente para ver sus
          indicadores. Los importes salen de lo que cada usuario registró y de
          las cotizaciones actuales.
          {pendingTerms > 0 &&
            ` ${pendingTerms} ${pendingTerms === 1 ? "usuario todavía no aceptó" : "usuarios todavía no aceptaron"} los términos vigentes (se les pide al entrar).`}
        </p>
        {clients.length === 0 ? (
          <p className="muted" style={{ fontSize: 13 }}>Todavía no hay usuarios registrados.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="rtable">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Último ingreso</th>
                  <th className="right">Instrum.</th>
                  <th className="right">Invertido</th>
                  <th className="right">Valor</th>
                  <th className="right">Ganancia</th>
                  <th className="right">Hoy</th>
                  <th className="right">Realizada</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((r) => {
                  const gp = r.invested > 0 ? (r.unrealized_gain / r.invested) * 100 : 0;
                  return (
                    <tr
                      key={r.user_id}
                      className={`client-row ${r.user_id === selectedId ? "selected" : ""}`}
                      onClick={() => {
                        setSelectedId(r.user_id === selectedId ? "" : r.user_id);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                    >
                      <td data-label="Cliente">
                        {label(r)}
                        {r.role === "admin" && <span className="role-tag">admin</span>}
                        <div className="muted" style={{ fontSize: 12, fontWeight: 400 }}>{r.email}</div>
                      </td>
                      <td data-label="Último ingreso">
                        <span className={isActive(r) ? "" : "muted"}>{when(r.last_sign_in_at)}</span>
                        {!r.terms_accepted && (
                          <div className="muted" style={{ fontSize: 12 }}>términos pendientes</div>
                        )}
                      </td>
                      <td data-label="Instrumentos" className="right">{r.instruments_count}</td>
                      <td data-label="Invertido" className="right">{usd(r.invested)}</td>
                      <td data-label="Valor" className="right"><strong>{usd(r.current_value)}</strong></td>
                      <td data-label="Ganancia" className={`right ${tone(r.unrealized_gain)}`}>
                        {signed(r.unrealized_gain, usd)}
                        <div style={{ fontSize: 12 }}>{r.invested > 0 ? pct(gp) : "—"}</div>
                      </td>
                      <td data-label="Hoy" className={`right ${tone(r.day_change)}`}>{signed(r.day_change, usd)}</td>
                      <td data-label="Realizada" className={`right ${tone(r.realized_gain)}`}>
                        {signed(r.realized_gain, usd)}
                        <div className="muted" style={{ fontSize: 12 }}>
                          {r.trades_count} {r.trades_count === 1 ? "operación" : "operaciones"}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
