"use client";

import { useEffect, useState } from "react";
import { Sparkline } from "./PracticePortfolios";
import { AllocationBar, type Slice } from "./ExamplePortfolios";
import { DIVIDEND_WITHHOLDING, netOf, grossSince, frequencyLabel, WITHHOLDING_NOTE, type DivEvent } from "@/lib/dividends";
import Note from "./Note";

// Cartera ReadySet: una cartera de referencia armada por el equipo, IGUAL PARA
// TODOS los usuarios. Se muestra con autor, fecha y aviso claro de que no
// considera la situación de cada persona.

export type ModelPosition = {
  weight_pct: number;
  units: number;
  entry_price: number;
  instrument: {
    symbol: string;
    name: string | null;
    type: string | null;
    current_price: number | null;
    previous_close: number | null;
    div_ttm?: number | null;
    div_count_12m?: number | null;
    div_last_date?: string | null;
    div_last_amount?: number | null;
    div_events?: DivEvent[] | null;
  } | null;
};
export type ModelPortfolio = {
  id: string;
  name: string;
  comment: string | null;
  author_name?: string | null;
  reference_amount: number;
  published_at: string;
  active: boolean;
  positions: ModelPosition[];
  history: { as_of_date: string; value: number }[];
};

const TYPE_LABEL: Record<string, string> = {
  accion: "Acciones",
  etf: "ETFs",
  fondo: "Fondos",
  bono: "Bonos",
};
const TYPE_COLOR: Record<string, string> = {
  accion: "var(--cat-accion)",
  etf: "var(--cat-etf)",
  fondo: "var(--cat-fondo)",
  bono: "var(--cat-bono)",
};

function usd(v: number) {
  return v.toLocaleString("es-UY", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}
function signed(v: number, f: (n: number) => string) {
  return `${v > 0.004 ? "+" : v < -0.004 ? "−" : ""}${f(Math.abs(v))}`;
}
function pct(v: number) {
  return `${v > 0.0049 ? "+" : v < -0.0049 ? "−" : ""}${Math.abs(v).toFixed(2)}%`;
}
function tone(v: number) {
  return v > 0.004 ? "delta-up" : v < -0.004 ? "delta-down" : "muted";
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("es-UY", { day: "numeric", month: "long", year: "numeric" });
}

function valueNow(p: ModelPortfolio) {
  const since = p.published_at.slice(0, 10);
  const rows = p.positions.map((pos) => {
    const i = pos.instrument;
    const units = Number(pos.units);
    const divTtm = Number(i?.div_ttm) || 0;
    const price = Number(i?.current_price) || Number(pos.entry_price);
    const prev = i?.previous_close != null ? Number(i.previous_close) : null;
    return {
      symbol: i?.symbol || "—",
      name: i?.name || "",
      type: i?.type || "otro",
      weight: Number(pos.weight_pct),
      entry: Number(pos.entry_price),
      price,
      value: Number(pos.units) * price,
      changePct: ((price - Number(pos.entry_price)) / Number(pos.entry_price)) * 100,
      dayUsd: prev ? Number(pos.units) * (price - prev) : 0,
      divTtm,
      divCount: Number(i?.div_count_12m) || 0,
      divAnnualGross: units * divTtm,
      divSinceGross: units * grossSince(i?.div_events, since),
    };
  });
  return {
    rows,
    value: rows.reduce((s, r) => s + r.value, 0),
    dayUsd: rows.reduce((s, r) => s + r.dayUsd, 0),
    divAnnualGross: rows.reduce((s, r) => s + r.divAnnualGross, 0),
    divSinceGross: rows.reduce((s, r) => s + r.divSinceGross, 0),
  };
}

export function ModelNotice() {
  return (
    <Note
      tone="info"
      more="No tiene en cuenta tu edad, tus objetivos, tu horizonte ni cuánto riesgo podés tomar: usala como un punto de comparación más. Seguimos cómo le iría a US$ 1.000 invertidos el día que se publicó, con precios de mercado y sin comisiones."
    >
      <strong>Cartera de referencia, igual para todos los usuarios:</strong> no es una
      recomendación para tu caso. Quienes la arman pueden tener estos mismos instrumentos.
    </Note>
  );
}

export default function ModelPortfolioView({
  current,
  previous,
}: {
  current: ModelPortfolio | null;
  previous: ModelPortfolio[];
}) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => setNow(Date.now()), []);

  if (!current) {
    return (
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Cartera ReadySet</h2>
        <ModelNotice />
        <p className="muted" style={{ fontSize: 14 }}>
          Todavía no se publicó ninguna Cartera ReadySet. Cuando el equipo la
          publique, vas a verla acá.
        </p>
      </div>
    );
  }

  const ref = Number(current.reference_amount) || 1000;
  const { rows, value, dayUsd, divAnnualGross, divSinceGross } = valueNow(current);
  const k = 1000 / ref; // todo se expresa sobre US$ 1.000
  const divSinceNet = netOf(divSinceGross);
  const totalNet = value - ref + divSinceNet;
  const divYieldGross = value > 0 ? (divAnnualGross / value) * 100 : 0;
  const gain = value - ref;
  const todayNY = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  const closes = [...current.history]
    .filter((h) => h.as_of_date < todayNY)
    .sort((a, b) => a.as_of_date.localeCompare(b.as_of_date))
    .map((h) => Number(h.value));
  const series = [ref, ...closes, value];
  const days = now == null ? null : Math.max(0, Math.floor((now - new Date(current.published_at).getTime()) / 864e5));

  const byType = new Map<string, number>();
  rows.forEach((r) => byType.set(r.type, (byType.get(r.type) || 0) + r.weight));
  const slices: Slice[] = [...byType.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([t, w]) => ({
      label: TYPE_LABEL[t] || "Otros",
      pct: Math.round(w * 10) / 10,
      color: TYPE_COLOR[t] || "var(--cat-otro)",
    }));

  return (
    <>
      <div className="card practice-card">
        <div className="practice-head">
          <div>
            <h2 className="example-title" style={{ fontSize: 20 }}>{current.name}</h2>
            <div className="muted" style={{ fontSize: 13 }}>
              Armada por el Equipo ReadySet · publicada el{" "}
              {fmtDate(current.published_at)}
              {days != null && ` (${days === 0 ? "hoy" : days === 1 ? "hace 1 día" : `hace ${days} días`})`} ·
              la misma para todos los usuarios
            </div>
          </div>
        </div>

        <div style={{ marginTop: 12 }}><ModelNotice /></div>

        {current.comment && (
          <blockquote className="model-comment">
            {current.comment}
            <footer className="muted">— Equipo ReadySet</footer>
          </blockquote>
        )}

        <div className="practice-value-row">
          <div>
            <div className="muted" style={{ fontSize: 13 }}>US$ 1.000 invertidos al publicarse hoy valen</div>
            <div className="hero-value">{usd((value / ref) * 1000)}</div>
            <div className={tone(gain)} style={{ fontSize: 14 }}>
              {pct((gain / ref) * 100)} desde que se publicó
              <span className={tone(dayUsd)}> · hoy {pct((dayUsd / (value - dayUsd || 1)) * 100)}</span>
            </div>
          </div>
          <Sparkline points={series.map((v) => (v / ref) * 1000)} />
        </div>

        <h3 style={{ fontSize: 15, margin: "18px 0 8px" }}>Dividendos</h3>
        {divAnnualGross > 0 ? (
          <div className="dividend-box" style={{ marginTop: 0 }}>
            <div className="dividend-grid">
              <div>
                <div className="stat-label">Rendimiento por dividendos</div>
                <div className="dividend-main">{netOf(divYieldGross).toFixed(2)}% neto al año</div>
                <div className="muted" style={{ fontSize: 12 }}>{divYieldGross.toFixed(2)}% bruto</div>
              </div>
              <div>
                <div className="stat-label">Por año sobre US$ 1.000 (estimado)</div>
                <div style={{ fontSize: 13, lineHeight: 1.6 }}>
                  Bruto {usd(divAnnualGross * k)}<br />
                  Retención 30 %: −{usd(divAnnualGross * DIVIDEND_WITHHOLDING * k)}<br />
                  <strong>Neto {usd(netOf(divAnnualGross) * k)}</strong>
                </div>
              </div>
              <div>
                <div className="stat-label">Cobrados desde que se publicó</div>
                <div className="dividend-main">{usd(divSinceNet * k)} netos</div>
                <div className="muted" style={{ fontSize: 12 }}>{usd(divSinceGross * k)} brutos</div>
              </div>
              <div>
                <div className="stat-label">Resultado total (precio + dividendos netos)</div>
                <div className={`dividend-main ${tone(totalNet)}`}>{pct((totalNet / ref) * 100)}</div>
                <div className="muted" style={{ fontSize: 12 }}>{signed(totalNet * k, usd)} sobre US$ 1.000</div>
              </div>
            </div>
            <Note more={WITHHOLDING_NOTE}>Estimado, neto de la retención del 30 % de Schwab.</Note>
          </div>
        ) : (
          <p className="muted" style={{ fontSize: 13 }}>
            Ningún instrumento de esta cartera paga dividendos actualmente.
          </p>
        )}

        <h3 style={{ fontSize: 15, margin: "18px 0 8px" }}>Cómo está repartida</h3>
        <AllocationBar slices={slices} />

        <div style={{ overflowX: "auto", marginTop: 14 }}>
          <table className="rtable">
            <thead>
              <tr>
                <th>Instrumento</th>
                <th className="right">Peso al publicarse</th>
                <th className="right">Precio al publicarse</th>
                <th className="right">Precio actual</th>
                <th className="right">Variación</th>
                <th className="right">Dividendo anual</th>
              </tr>
            </thead>
            <tbody>
              {[...rows].sort((a, b) => b.weight - a.weight).map((r) => (
                <tr key={r.symbol}>
                  <td data-label="Instrumento">
                    <a className="symbol-link" href={`/mercado?ver=buscar&q=${encodeURIComponent(r.symbol)}`}>{r.symbol}</a>
                    <div className="muted" style={{ fontSize: 12, fontWeight: 400 }}>{r.name}</div>
                  </td>
                  <td data-label="Peso al publicarse" className="right">{r.weight.toLocaleString("es-UY")}%</td>
                  <td data-label="Precio al publicarse" className="right">{usd(r.entry)}</td>
                  <td data-label="Precio actual" className="right">{usd(r.price)}</td>
                  <td data-label="Variación" className={`right ${tone(r.changePct)}`}>{pct(r.changePct)}</td>
                  <td data-label="Dividendo anual" className="right">
                    {r.divTtm > 0 ? (
                      <>
                        {netOf((r.divTtm / r.price) * 100).toFixed(2)}% neto
                        <div className="muted" style={{ fontSize: 12 }}>{frequencyLabel(r.divCount)}</div>
                      </>
                    ) : (
                      <span className="muted">No paga</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Note more="Cotizaciones de Yahoo Finance que pueden tener demora. Rendimientos pasados no garantizan resultados futuros.">
          Rendimiento teórico, sin comisiones.
        </Note>
      </div>

      {previous.length > 0 && (
        <div className="card">
          <h3 style={{ fontSize: 15, marginTop: 0 }}>Versiones anteriores</h3>
          <p className="muted" style={{ fontSize: 13, marginTop: -4 }}>
            Cada vez que el equipo cambia la cartera, la versión anterior queda
            acá con el resultado que tuvo mientras estuvo vigente.
          </p>
          <ul className="model-versions">
            {previous.map((p) => {
              const last = [...p.history].sort((a, b) => b.as_of_date.localeCompare(a.as_of_date))[0];
              const r = Number(p.reference_amount) || 1000;
              const res = last ? ((Number(last.value) - r) / r) * 100 : 0;
              return (
                <li key={p.id}>
                  <span>
                    Publicada el {fmtDate(p.published_at)} · {p.positions.length} instrumentos
                    {last && ` · hasta el ${fmtDate(last.as_of_date + "T12:00:00")}`}
                  </span>
                  <strong className={tone(res)}>{pct(res)}</strong>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </>
  );
}
