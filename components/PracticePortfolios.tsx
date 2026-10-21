"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { createPracticePortfolio, deletePracticePortfolio } from "@/app/actions";
import Note from "./Note";

export type PracticePosition = {
  symbol: string;
  name: string | null;
  weight_pct: number;
  units: number;
  entry_price: number;
};
export type PracticePortfolio = {
  id: string;
  name: string;
  initial_amount: number;
  created_at: string;
  positions: PracticePosition[];
  history: { as_of_date: string; value: number }[];
};
export type Quote = { price: number; previous_close: number | null };
export type PickOption = { symbol: string; name: string; price: number; group: "catalogo" | "tendencias" };

const MAX_POSITIONS = 10;
const MAX_PORTFOLIOS = 5;

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

export function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2) {
    return <div className="muted sparkline-empty">El gráfico aparece a partir del segundo día de seguimiento.</div>;
  }
  const w = 320, h = 64, pad = 4;
  const min = Math.min(...points), max = Math.max(...points);
  const span = max - min || 1;
  const xy = points.map((p, i) => [
    pad + (i * (w - 2 * pad)) / (points.length - 1),
    h - pad - ((p - min) / span) * (h - 2 * pad),
  ]);
  const up = points[points.length - 1] >= points[0];
  const color = up ? "var(--status-good)" : "var(--status-critical)";
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="sparkline" role="img"
      aria-label={`Evolución: de ${usd(points[0])} a ${usd(points[points.length - 1])}`}>
      <polyline points={xy.map((p) => p.join(",")).join(" ")} fill="none" stroke={color} strokeWidth="2"
        strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function PortfolioCard({
  p,
  quotes,
  now,
}: {
  p: PracticePortfolio;
  quotes: Record<string, Quote>;
  now: number | null;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const rows = p.positions.map((pos) => {
    const q = quotes[pos.symbol];
    const price = q?.price ?? pos.entry_price;
    const prev = q?.previous_close ?? null;
    return {
      ...pos,
      price,
      value: pos.units * price,
      changePct: ((price - pos.entry_price) / pos.entry_price) * 100,
      dayUsd: prev ? pos.units * (price - prev) : 0,
    };
  });
  const value = rows.reduce((s, r) => s + r.value, 0);
  const gain = value - p.initial_amount;
  const gainPct = (gain / p.initial_amount) * 100;
  const dayUsd = rows.reduce((s, r) => s + r.dayUsd, 0);

  // Serie: monto inicial → cierres de días anteriores → valor de ahora.
  const todayNY = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  const closes = [...p.history]
    .filter((h) => h.as_of_date < todayNY)
    .sort((a, b) => a.as_of_date.localeCompare(b.as_of_date))
    .map((h) => Number(h.value));
  const series = [Number(p.initial_amount), ...closes, value];
  const daily = series.slice(1).map((v, i) => ((v - series[i]) / series[i]) * 100);
  const best = daily.length ? Math.max(...daily) : null;
  const worst = daily.length ? Math.min(...daily) : null;
  const days = now == null ? null : Math.max(0, Math.floor((now - new Date(p.created_at).getTime()) / 864e5));

  function remove() {
    if (!window.confirm(`¿Eliminar la cartera de práctica "${p.name}"? Se pierde su historial.`)) return;
    setError(null);
    startTransition(async () => {
      try {
        await deletePracticePortfolio(p.id);
      } catch (e: any) {
        setError(e.message || "No se pudo eliminar.");
      }
    });
  }

  return (
    <div className="card practice-card">
      <div className="practice-head">
        <div>
          <h3 className="example-title">{p.name}</h3>
          <div className="muted" style={{ fontSize: 13 }}>
            Empezó con {usd(p.initial_amount)}
            {now != null && ` el ${new Date(p.created_at).toLocaleDateString("es-UY")} · ${days === 0 ? "hoy" : days === 1 ? "hace 1 día" : `hace ${days} días`}`}
          </div>
        </div>
        <button type="button" className="link-btn link-btn-danger" onClick={remove} disabled={pending}>
          {pending ? "Eliminando…" : "Eliminar"}
        </button>
      </div>
      {error && <div className="error-box">{error}</div>}

      <div className="practice-value-row">
        <div>
          <div className="hero-value">{usd(value)}</div>
          <div className={tone(gain)} style={{ fontSize: 14 }}>
            {signed(gain, usd)} ({pct(gainPct)}) desde el inicio
            <span className={tone(dayUsd)}> · hoy {signed(dayUsd, usd)}</span>
          </div>
        </div>
        <Sparkline points={series} />
      </div>

      <div className="stat-grid stat-grid-3" style={{ marginTop: 12 }}>
        <div className="stat-tile">
          <div className="stat-label">Mejor día</div>
          <div className={`stat-value ${best != null ? tone(best) : "muted"}`}>{best != null ? pct(best) : "—"}</div>
        </div>
        <div className="stat-tile">
          <div className="stat-label">Peor día</div>
          <div className={`stat-value ${worst != null ? tone(worst) : "muted"}`}>{worst != null ? pct(worst) : "—"}</div>
        </div>
        <div className="stat-tile">
          <div className="stat-label">Cierres registrados</div>
          <div className="stat-value">{closes.length}</div>
        </div>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table className="rtable">
          <thead>
            <tr>
              <th>Instrumento</th>
              <th className="right">Peso inicial</th>
              <th className="right">Precio de entrada</th>
              <th className="right">Precio actual</th>
              <th className="right">Variación</th>
              <th className="right">Valor</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.symbol}>
                <td data-label="Instrumento">
                  <strong>{r.symbol}</strong>
                  <div className="muted" style={{ fontSize: 12, fontWeight: 400 }}>{r.name}</div>
                </td>
                <td data-label="Peso inicial" className="right">{Number(r.weight_pct).toLocaleString("es-UY")}%</td>
                <td data-label="Precio de entrada" className="right">{usd(Number(r.entry_price))}</td>
                <td data-label="Precio actual" className="right">{usd(r.price)}</td>
                <td data-label="Variación" className={`right ${tone(r.changePct)}`}>{pct(r.changePct)}</td>
                <td data-label="Valor" className="right">{usd(r.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function NewPortfolioForm({ options, disabled, initialSymbol }: { options: PickOption[]; disabled: boolean; initialSymbol?: string }) {
  const preset = options.some((o) => o.symbol === initialSymbol?.toUpperCase()) ? initialSymbol!.toUpperCase() : "";
  const [open, setOpen] = useState(!!preset && !disabled);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("1000");
  const [rows, setRows] = useState<{ symbol: string; weight: string }[]>([{ symbol: preset, weight: "" }]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const total = rows.reduce((s, r) => s + (Number(r.weight) || 0), 0);
  const catalog = options.filter((o) => o.group === "catalogo");
  const trends = options.filter((o) => o.group === "tendencias" && !catalog.some((c) => c.symbol === o.symbol));

  function update(i: number, patch: Partial<{ symbol: string; weight: string }>) {
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }
  function equalize() {
    const n = rows.length;
    const base = Math.floor((100 / n) * 100) / 100;
    setRows((rs) => rs.map((r, i) => ({ ...r, weight: String(i === n - 1 ? +(100 - base * (n - 1)).toFixed(2) : base) })));
  }
  function submit() {
    setError(null);
    const amt = Number(amount);
    const clean = rows.filter((r) => r.symbol);
    if (!name.trim()) return setError("Ponele un nombre a la cartera.");
    if (!Number.isFinite(amt) || amt < 100) return setError("El monto tiene que ser de al menos US$ 100.");
    if (clean.length === 0) return setError("Elegí al menos un instrumento.");
    if (new Set(clean.map((r) => r.symbol)).size !== clean.length) return setError("Hay instrumentos repetidos.");
    if (clean.some((r) => !(Number(r.weight) > 0))) return setError("Cada instrumento necesita un porcentaje mayor a 0.");
    const sum = clean.reduce((s, r) => s + Number(r.weight), 0);
    if (Math.abs(sum - 100) > 0.05) return setError(`Los porcentajes tienen que sumar 100% (ahora suman ${sum.toFixed(2)}%).`);
    startTransition(async () => {
      try {
        await createPracticePortfolio({
          name: name.trim(),
          amount: amt,
          positions: clean.map((r) => ({ symbol: r.symbol, weight: Number(r.weight) })),
        });
        setOpen(false);
        setName("");
        setAmount("1000");
        setRows([{ symbol: "", weight: "" }]);
      } catch (e: any) {
        setError(e.message || "No se pudo crear la cartera.");
      }
    });
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} disabled={disabled}>
        + Armar una cartera de práctica
      </button>
    );
  }

  return (
    <div className="card practice-form">
      <h3 className="example-title">Nueva cartera de práctica</h3>
      <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
        Elegí los instrumentos y qué porcentaje del monto va a cada uno. Se
        &quot;compran&quot; al precio de este momento y desde ahí la app los sigue
        todos los días.
      </p>
      {error && <div className="error-box">{error}</div>}
      <div className="form-row">
        <div className="field">
          <label htmlFor="pp-name">Nombre</label>
          <input id="pp-name" maxLength={60} placeholder="Ej: Mi prueba prudente" value={name}
            onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="pp-amount">Monto ficticio (USD)</label>
          <input id="pp-amount" type="number" min="100" step="100" value={amount}
            onChange={(e) => setAmount(e.target.value)} />
        </div>
      </div>
      <p className="muted" style={{ fontSize: 12, margin: "0 0 8px" }}>
        ¿No está el instrumento que querés? Buscalo en{" "}
        <a href="/mercado?ver=buscar">Mercado › Buscar</a> (cualquier acción, ETF o fondo
        de Yahoo Finance) y tocá &quot;Usar en una cartera de práctica&quot;.
      </p>

      {rows.map((r, i) => {
        const opt = options.find((o) => o.symbol === r.symbol);
        return (
          <div key={i} className="practice-row">
            <select aria-label={`Instrumento ${i + 1}`} value={r.symbol} onChange={(e) => update(i, { symbol: e.target.value })}>
              <option value="">Elegí un instrumento…</option>
              {catalog.length > 0 && (
                <optgroup label="Catálogo de la app">
                  {catalog.map((o) => (
                    <option key={o.symbol} value={o.symbol}>{o.symbol} — {o.name} ({usd(o.price)})</option>
                  ))}
                </optgroup>
              )}
              {trends.length > 0 && (
                <optgroup label="En alza hoy (suelen ser muy volátiles)">
                  {trends.map((o) => (
                    <option key={o.symbol} value={o.symbol}>{o.symbol} — {o.name} ({usd(o.price)})</option>
                  ))}
                </optgroup>
              )}
            </select>
            <span className="pct-input">
              <input type="number" min="0" max="100" step="1" aria-label={`Porcentaje ${i + 1}`} placeholder="%"
                value={r.weight} onChange={(e) => update(i, { weight: e.target.value })} />
              %
            </span>
            <span className="muted practice-row-amount">
              {opt && Number(r.weight) > 0 ? usd((Number(amount) || 0) * Number(r.weight) / 100) : ""}
            </span>
            {rows.length > 1 && (
              <button type="button" className="link-btn link-btn-danger" aria-label="Quitar"
                onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}>✕</button>
            )}
          </div>
        );
      })}

      <div className="practice-form-actions">
        {rows.length < MAX_POSITIONS && (
          <button type="button" className="secondary-btn" onClick={() => setRows((rs) => [...rs, { symbol: "", weight: "" }])}>
            + Agregar instrumento
          </button>
        )}
        <button type="button" className="secondary-btn" onClick={equalize}>Repartir en partes iguales</button>
        <span className={Math.abs(total - 100) <= 0.05 ? "delta-up" : "muted"} style={{ fontSize: 13 }}>
          Total: {total.toLocaleString("es-UY", { maximumFractionDigits: 2 })}%
        </span>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button type="button" onClick={submit} disabled={pending}>{pending ? "Creando…" : "Crear cartera de práctica"}</button>
        <button type="button" className="secondary-btn" onClick={() => setOpen(false)} disabled={pending}>Cancelar</button>
      </div>
    </div>
  );
}

export default function PracticePortfolios({
  portfolios,
  quotes,
  options,
  initialSymbol,
}: {
  portfolios: PracticePortfolio[];
  quotes: Record<string, Quote>;
  options: PickOption[];
  initialSymbol?: string;
}) {
  // Fechas relativas solo en el cliente (evita diferencias con el HTML del servidor).
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => setNow(Date.now()), []);

  const comparison = useMemo(
    () =>
      portfolios
        .map((p) => {
          const value = p.positions.reduce((s, pos) => s + pos.units * (quotes[pos.symbol]?.price ?? pos.entry_price), 0);
          return { id: p.id, name: p.name, value, ret: ((value - p.initial_amount) / p.initial_amount) * 100 };
        })
        .sort((a, b) => b.ret - a.ret),
    [portfolios, quotes]
  );

  return (
    <div>
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Cartera de práctica</h2>
        <p style={{ fontSize: 14, lineHeight: 1.6 }}>
          Armá una cartera con <strong>plata ficticia</strong> (por ejemplo, US$
          1.000), elegí vos los instrumentos y los porcentajes, y mirá día a día
          cómo le va con las cotizaciones reales. Podés tener hasta{" "}
          {MAX_PORTFOLIOS} y compararlas; por ejemplo, una más prudente y otra
          más arriesgada, según tu propio criterio.
        </p>
        <Note tone="warn" more="No se compra ni se vende nada de verdad y las carteras las armás vos: la app no elige instrumentos ni porcentajes. Las acciones &quot;en alza hoy&quot; suelen moverse mucho en los dos sentidos. Lo que pase en la práctica no garantiza nada en el futuro.">
          <strong>Es un ejercicio con plata ficticia,</strong> no una recomendación.
        </Note>
        <NewPortfolioForm options={options} disabled={portfolios.length >= MAX_PORTFOLIOS} initialSymbol={initialSymbol} />
        {portfolios.length >= MAX_PORTFOLIOS && (
          <p className="muted" style={{ fontSize: 13 }}>
            Llegaste al máximo de {MAX_PORTFOLIOS} carteras. Eliminá alguna para crear otra.
          </p>
        )}
      </div>

      {portfolios.length === 0 && (
        <p className="muted" style={{ fontSize: 13, margin: "0 4px 16px" }}>
          Todavía no armaste ninguna cartera de práctica.
        </p>
      )}

      {comparison.length >= 2 && (
        <div className="card">
          <h3 className="example-title">Comparación</h3>
          <div className="weight-list" style={{ marginTop: 10 }}>
            {comparison.map((c) => (
              <div key={c.id} className="compare-row">
                <div className="compare-name">{c.name}</div>
                <div className="compare-value">{usd(c.value)}</div>
                <div className={`compare-ret ${tone(c.ret)}`}>{pct(c.ret)}</div>
              </div>
            ))}
          </div>
          <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
            Rendimiento de cada cartera desde que la creaste. Si empezaron en
            fechas distintas, no son directamente comparables.
          </p>
        </div>
      )}

      {portfolios.map((p) => (
        <PortfolioCard key={p.id} p={p} quotes={quotes} now={now} />
      ))}

      <Note more="El valor de cada día se guarda al cierre del mercado de EE.UU. No incluye comisiones, impuestos ni dividendos.">
        Cotizaciones de Yahoo Finance, actualizadas cada 15 minutos.
      </Note>
    </div>
  );
}
