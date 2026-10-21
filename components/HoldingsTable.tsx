"use client";

import { useState } from "react";

export type HoldingRow = {
  id: string;
  quantity: number;
  avg_cost: number;
  auto_reinvest: boolean;
  instrument: {
    symbol: string;
    name: string;
    type: string;
    current_price: number;
    previous_close: number | null;
    fifty_two_week_low: number | null;
    fifty_two_week_high: number | null;
    div_ttm?: number | null;
    div_count_12m?: number | null;
  } | null;
};

function usd(v: number) {
  return v.toLocaleString("es-UY", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}
function signedUsd(v: number) {
  return `${v > 0.004 ? "+" : v < -0.004 ? "−" : ""}${usd(Math.abs(v))}`;
}
function pct(v: number) {
  return `${v > 0.0049 ? "+" : v < -0.0049 ? "−" : ""}${Math.abs(v).toFixed(2)}%`;
}
function tone(v: number | null) {
  return v == null ? "muted" : v > 0.004 ? "delta-up" : v < -0.004 ? "delta-down" : "muted";
}

export function RangeBar({ price, low, high }: { price: number; low: number | null; high: number | null }) {
  if (low == null || high == null || high <= low) {
    return <span className="muted">—</span>;
  }
  const fraction = Math.min(1, Math.max(0, (price - low) / (high - low)));
  return (
    <div className="range-bar-wrap">
      <div className="range-bar">
        <div className="range-bar-dot" style={{ left: `${(fraction * 100).toFixed(1)}%` }} />
      </div>
      <div className="range-bar-labels">
        <span>{usd(low)}</span>
        <span>{usd(high)}</span>
      </div>
    </div>
  );
}

type SortKey = "valor" | "dia" | "ganancia";

export default function HoldingsTable({ rows, linkSymbols = true }: { rows: HoldingRow[]; linkSymbols?: boolean }) {
  const [sort, setSort] = useState<SortKey>("valor");

  if (rows.length === 0) {
    return (
      <p className="muted" style={{ fontSize: 13 }}>
        Todavía no hay inversiones cargadas.
      </p>
    );
  }

  const data = rows.map((h) => {
    const inst = h.instrument;
    const price = Number(inst?.current_price) || 0;
    const prev = inst?.previous_close != null ? Number(inst.previous_close) : null;
    const qty = Number(h.quantity);
    const avg = Number(h.avg_cost);
    return {
      h,
      price,
      value: qty * price,
      dayPct: prev && prev > 0 ? ((price - prev) / prev) * 100 : null,
      dayUsd: prev && prev > 0 ? (price - prev) * qty : 0,
      gainPct: avg > 0 ? ((price - avg) / avg) * 100 : 0,
      gainUsd: (price - avg) * qty,
    };
  });
  const total = data.reduce((s, r) => s + r.value, 0);
  data.sort((a, b) =>
    sort === "dia" ? (b.dayPct ?? -1e9) - (a.dayPct ?? -1e9) : sort === "ganancia" ? b.gainPct - a.gainPct : b.value - a.value
  );

  return (
    <div>
      <div className="table-toolbar">
        <label htmlFor="holdings-sort" style={{ margin: 0 }}>Ordenar por</label>
        <select id="holdings-sort" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
          <option value="valor">Valor de la posición</option>
          <option value="dia">Variación de hoy</option>
          <option value="ganancia">Ganancia desde la compra</option>
        </select>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table className="rtable rtable-titled">
          <thead>
            <tr>
              <th>Instrumento</th>
              <th className="right">Cantidad</th>
              <th className="right">Costo prom.</th>
              <th className="right">Precio actual</th>
              <th className="right">Hoy</th>
              <th>Rango 52 semanas</th>
              <th className="right">Ganancia</th>
              <th className="right">Valor</th>
              <th className="right">Peso</th>
            </tr>
          </thead>
          <tbody>
            {data.map(({ h, price, value, dayPct, dayUsd, gainPct, gainUsd }) => {
              const inst = h.instrument;
              return (
                <tr key={h.id}>
                  <td data-label="Instrumento" className="cell-title">
                    {linkSymbols && inst ? (
                      <a href={`/mercado?ver=buscar&q=${encodeURIComponent(inst.symbol)}`} className="symbol-link"
                        title="Ver su evolución del último año">
                        {inst.symbol}
                      </a>
                    ) : (
                      <strong>{inst?.symbol}</strong>
                    )}
                    <div className="muted" style={{ fontSize: 12, fontWeight: 400 }}>{inst?.name}</div>
                  </td>
                  <td data-label="Cantidad" className="right">
                    {Number(h.quantity).toLocaleString("es-UY", { maximumFractionDigits: 4 })}
                  </td>
                  <td data-label="Costo prom." className="right">{usd(Number(h.avg_cost))}</td>
                  <td data-label="Precio actual" className="right">{usd(price)}</td>
                  <td data-label="Hoy" className={`right ${tone(dayPct)}`}>
                    {dayPct == null ? "—" : pct(dayPct)}
                    {dayPct != null && <div style={{ fontSize: 12 }}>{signedUsd(dayUsd)}</div>}
                  </td>
                  <td data-label="Rango 52 sem.">
                    <RangeBar price={price} low={inst?.fifty_two_week_low ?? null} high={inst?.fifty_two_week_high ?? null} />
                  </td>
                  <td data-label="Ganancia" className={`right ${tone(gainPct)}`}>
                    {pct(gainPct)}
                    <div style={{ fontSize: 12 }}>{signedUsd(gainUsd)}</div>
                  </td>
                  <td data-label="Valor" className="right">{usd(value)}</td>
                  <td data-label="Peso" className="right muted">
                    {total > 0 ? `${((value / total) * 100).toFixed(1)}%` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>
        Tocá un símbolo para ver cómo se movió en el último año. &quot;Hoy&quot; es la
        variación respecto del cierre anterior; &quot;Peso&quot;, cuánto representa
        cada posición en la cartera.
      </p>
    </div>
  );
}
