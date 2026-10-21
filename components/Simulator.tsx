"use client";

import { useMemo, useState } from "react";
import Note from "./Note";

export type SimInstrument = {
  id: string;
  symbol: string;
  name: string;
  type: string;
  current_price: number;
};

export type SimHolding = {
  quantity: number;
  avg_cost: number;
  first_acquired_at: string | null;
  instrument: SimInstrument | null;
};

type Position = { id: string; symbol: string; name: string; qty: number; avg: number; price: number };

const LONG_TERM_DAYS = 365;

function usd(v: number) {
  return v.toLocaleString("es-UY", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}
function usd0(v: number) {
  return v.toLocaleString("es-UY", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}
function signed(v: number, f: (n: number) => string) {
  return `${v > 0.004 ? "+" : v < -0.004 ? "−" : ""}${f(Math.abs(v))}`;
}
function pct(v: number, digits = 1) {
  return `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(digits)}%`;
}
function tone(v: number) {
  return v > 0.004 ? "delta-up" : v < -0.004 ? "delta-down" : "muted";
}
function qtyFmt(v: number) {
  return v.toLocaleString("es-UY", { maximumFractionDigits: 6 });
}

function totals(positions: Position[]) {
  const value = positions.reduce((s, p) => s + p.qty * p.price, 0);
  const invested = positions.reduce((s, p) => s + p.qty * p.avg, 0);
  return { value, invested, gain: value - invested };
}

function Disclaimer() {
  return (
    <Note more="El simulador solo hace cuentas con los datos que elegís y con lo que registraste en tu cartera. No incluye comisiones, impuestos ni tipo de cambio y no garantiza ningún resultado.">
      Resultados hipotéticos: no es una recomendación.
    </Note>
  );
}

/* ------------------------------------------------------------------ */
/* 1. Simular una operación                                            */
/* ------------------------------------------------------------------ */
function TradeSimulation({
  positions,
  instruments,
  acquiredAt,
  initialSymbol,
}: {
  positions: Position[];
  instruments: SimInstrument[];
  acquiredAt: Record<string, string | null>;
  initialSymbol?: string;
}) {
  const [op, setOp] = useState<"comprar" | "vender">("comprar");
  const [instrumentId, setInstrumentId] = useState(
    instruments.find((i) => i.symbol === initialSymbol?.toUpperCase())?.id || ""
  );
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");

  const inst = instruments.find((i) => i.id === instrumentId) || null;
  const held = positions.find((p) => p.id === instrumentId) || null;
  const qty = Number(quantity);
  const prc = price === "" ? inst?.current_price ?? 0 : Number(price);
  const ready = !!inst && Number.isFinite(qty) && qty > 0 && Number.isFinite(prc) && prc > 0;

  let error: string | null = null;
  if (ready && op === "vender") {
    if (!held) error = `No tenés ${inst!.symbol} registrado en tu cartera.`;
    else if (qty > held.qty + 1e-9)
      error = `Querés vender ${qtyFmt(qty)} y tenés ${qtyFmt(held.qty)} ${inst!.symbol} registrados.`;
  }

  const result = useMemo(() => {
    if (!ready || error || !inst) return null;
    const before = positions.map((p) => ({ ...p }));
    let after = positions.map((p) => ({ ...p }));
    let realized: number | null = null;
    let longTerm: boolean | null = null;

    const idx = after.findIndex((p) => p.id === inst.id);
    if (op === "comprar") {
      if (idx === -1) {
        after.push({ id: inst.id, symbol: inst.symbol, name: inst.name, qty, avg: prc, price: inst.current_price });
      } else {
        const p = after[idx];
        const newQty = p.qty + qty;
        after[idx] = { ...p, qty: newQty, avg: (p.qty * p.avg + qty * prc) / newQty };
      }
    } else {
      const p = after[idx];
      realized = qty * (prc - p.avg);
      const acq = acquiredAt[inst.id];
      longTerm = acq ? (Date.now() - new Date(acq).getTime()) / 864e5 >= LONG_TERM_DAYS : null;
      const left = p.qty - qty;
      after = left <= 1e-9 ? after.filter((x) => x.id !== inst.id) : after.map((x) => (x.id === inst.id ? { ...x, qty: left } : x));
    }

    const tb = totals(before);
    const ta = totals(after);
    const ids = Array.from(new Set([...before.map((p) => p.id), ...after.map((p) => p.id)]));
    const weights = ids
      .map((id) => {
        const b = before.find((p) => p.id === id);
        const a = after.find((p) => p.id === id);
        const ref = (a || b)!;
        return {
          id,
          symbol: ref.symbol,
          before: b && tb.value > 0 ? ((b.qty * b.price) / tb.value) * 100 : 0,
          after: a && ta.value > 0 ? ((a.qty * a.price) / ta.value) * 100 : 0,
          highlight: id === inst.id,
        };
      })
      .sort((x, y) => y.after - x.after || y.before - x.before);

    return {
      tb,
      ta,
      weights,
      posBefore: before.find((p) => p.id === inst.id) || null,
      posAfter: after.find((p) => p.id === inst.id) || null,
      realized,
      longTerm,
      cash: qty * prc,
    };
  }, [ready, error, inst, op, qty, prc, positions, acquiredAt]);

  return (
    <div>
      <p className="tag-op" style={{ marginTop: 0 }}>
        Probá una compra o una venta antes de hacerla en tu bróker y mirá cómo
        quedaría tu cartera. No se guarda nada.
      </p>

      <div className="form-row">
        <div className="field">
          <label htmlFor="sim-op">Operación</label>
          <select id="sim-op" value={op} onChange={(e) => setOp(e.target.value as any)}>
            <option value="comprar">Compra</option>
            <option value="vender">Venta</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="sim-inst">Instrumento</label>
          <select
            id="sim-inst"
            value={instrumentId}
            onChange={(e) => {
              setInstrumentId(e.target.value);
              setPrice("");
            }}
          >
            <option value="">Elegí un instrumento…</option>
            {(op === "vender" ? instruments.filter((i) => positions.some((p) => p.id === i.id)) : instruments).map(
              (i) => (
                <option key={i.id} value={i.id}>
                  {i.symbol} — {i.name}
                </option>
              )
            )}
          </select>
          {op === "vender" && held && (
            <p className="muted" style={{ fontSize: 12 }}>
              Tenés {qtyFmt(held.qty)} registrados, a un costo promedio de {usd(held.avg)}.
            </p>
          )}
        </div>
      </div>

      <div className="form-row">
        <div className="field">
          <label htmlFor="sim-qty">Cantidad de unidades</label>
          <input id="sim-qty" type="number" min="0" step="0.000001" placeholder="Ej: 5"
            value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="sim-price">Precio por unidad (USD)</label>
          <input id="sim-price" type="number" min="0" step="0.0001"
            placeholder={inst ? inst.current_price.toFixed(2) : "Elegí un instrumento"}
            value={price} onChange={(e) => setPrice(e.target.value)} />
          <p className="muted" style={{ fontSize: 12 }}>
            Si lo dejás vacío se usa la cotización actual.
          </p>
        </div>
      </div>

      {error && <div className="error-box">{error}</div>}

      {!result && !error && (
        <p className="muted" style={{ fontSize: 13 }}>
          Completá el instrumento y la cantidad para ver el resultado.
        </p>
      )}

      {result && inst && (
        <div className="sim-result">
          <h3 className="sim-result-title">
            Si {op === "comprar" ? "comprás" : "vendés"} {qtyFmt(qty)} {inst.symbol} a {usd(prc)}{" "}
            <span className="muted">({op === "comprar" ? "pagás" : "cobrás"} {usd(result.cash)})</span>
          </h3>

          {op === "vender" && result.realized != null && (
            <div className="sim-highlight">
              <div>
                <div className="stat-label">Ganancia o pérdida que realizarías</div>
                <div className={`stat-value ${tone(result.realized)}`}>{signed(result.realized, usd)}</div>
              </div>
              <div className="muted" style={{ fontSize: 13 }}>
                {result.longTerm == null
                  ? "Sin fecha de compra registrada para estimar el plazo."
                  : result.longTerm
                  ? `Largo plazo (tenencia de ${LONG_TERM_DAYS} días o más, estimado)`
                  : `Corto plazo (menos de ${LONG_TERM_DAYS} días, estimado)`}
              </div>
            </div>
          )}

          <div style={{ overflowX: "auto" }}>
            <table className="rtable">
              <thead>
                <tr>
                  <th></th>
                  <th className="right">Hoy</th>
                  <th className="right">Después</th>
                  <th className="right">Cambio</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td data-label="">{inst.symbol}: unidades</td>
                  <td data-label="Hoy" className="right">{qtyFmt(result.posBefore?.qty ?? 0)}</td>
                  <td data-label="Después" className="right">{qtyFmt(result.posAfter?.qty ?? 0)}</td>
                  <td data-label="Cambio" className="right">
                    {signed((result.posAfter?.qty ?? 0) - (result.posBefore?.qty ?? 0), qtyFmt)}
                  </td>
                </tr>
                <tr>
                  <td data-label="">{inst.symbol}: costo promedio</td>
                  <td data-label="Hoy" className="right">{result.posBefore ? usd(result.posBefore.avg) : "—"}</td>
                  <td data-label="Después" className="right">{result.posAfter ? usd(result.posAfter.avg) : "—"}</td>
                  <td data-label="Cambio" className="right">
                    {result.posBefore && result.posAfter ? signed(result.posAfter.avg - result.posBefore.avg, usd) : "—"}
                  </td>
                </tr>
                <tr>
                  <td data-label="">Valor total de la cartera</td>
                  <td data-label="Hoy" className="right">{usd(result.tb.value)}</td>
                  <td data-label="Después" className="right">{usd(result.ta.value)}</td>
                  <td data-label="Cambio" className="right">{signed(result.ta.value - result.tb.value, usd)}</td>
                </tr>
                <tr>
                  <td data-label="">Invertido (a costo)</td>
                  <td data-label="Hoy" className="right">{usd(result.tb.invested)}</td>
                  <td data-label="Después" className="right">{usd(result.ta.invested)}</td>
                  <td data-label="Cambio" className="right">{signed(result.ta.invested - result.tb.invested, usd)}</td>
                </tr>
                <tr>
                  <td data-label="">Ganancia no realizada</td>
                  <td data-label="Hoy" className={`right ${tone(result.tb.gain)}`}>{signed(result.tb.gain, usd)}</td>
                  <td data-label="Después" className={`right ${tone(result.ta.gain)}`}>{signed(result.ta.gain, usd)}</td>
                  <td data-label="Cambio" className="right">{signed(result.ta.gain - result.tb.gain, usd)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3 className="sim-subtitle">Peso de cada instrumento en tu cartera</h3>
          <div className="weight-list">
            {result.weights.map((w) => (
              <div key={w.id} className={`weight-row ${w.highlight ? "highlight" : ""}`}>
                <div className="weight-symbol">{w.symbol}</div>
                <div className="weight-bars">
                  <div className="weight-bar before" style={{ width: `${Math.min(100, w.before)}%` }} />
                  <div className="weight-bar after" style={{ width: `${Math.min(100, w.after)}%` }} />
                </div>
                <div className="weight-values">
                  <span className="muted">{w.before.toFixed(1)}%</span> → <strong>{w.after.toFixed(1)}%</strong>
                </div>
              </div>
            ))}
            <div className="weight-legend muted">
              <span><i className="swatch before" /> Hoy</span>
              <span><i className="swatch after" /> Después</span>
            </div>
          </div>
          <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>
            Si hacés esta operación en tu bróker, después registrala en{" "}
            <a href="/dashboard">Mi cartera</a> para que quede al día.
          </p>
        </div>
      )}
      <Disclaimer />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 2. Escenarios de mercado                                            */
/* ------------------------------------------------------------------ */
function ScenarioSimulation({ positions }: { positions: Position[] }) {
  const [global, setGlobal] = useState(0);
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  const rows = positions.map((p) => {
    const o = overrides[p.id];
    const change = o !== undefined && o !== "" && Number.isFinite(Number(o)) ? Number(o) : global;
    const newPrice = p.price * (1 + change / 100);
    return { ...p, change, newPrice, valueNow: p.qty * p.price, valueNew: p.qty * newPrice, custom: o !== undefined && o !== "" };
  });
  const now = rows.reduce((s, r) => s + r.valueNow, 0);
  const next = rows.reduce((s, r) => s + r.valueNew, 0);
  const invested = rows.reduce((s, r) => s + r.qty * r.avg, 0);
  const diff = next - now;

  if (positions.length === 0) {
    return (
      <div>
        <p className="muted" style={{ fontSize: 13 }}>
          Para simular escenarios necesitás tener inversiones registradas en{" "}
          <a href="/dashboard">Mi cartera</a>.
        </p>
        <Disclaimer />
      </div>
    );
  }

  return (
    <div>
      <p className="tag-op" style={{ marginTop: 0 }}>
        ¿Cuánto valdría tu cartera si los precios se movieran? Mové el control
        para aplicar el mismo cambio a todo, o cambiá el porcentaje de un
        instrumento en particular.
      </p>

      <div className="scenario-control">
        <label htmlFor="sc-global">
          Cambio para toda la cartera: <strong className={tone(global)}>{pct(global, 0)}</strong>
        </label>
        <input id="sc-global" type="range" min={-50} max={50} step={1} value={global}
          onChange={(e) => setGlobal(Number(e.target.value))} />
        <div className="scenario-presets">
          {[-30, -20, -10, 0, 10, 20].map((v) => (
            <button key={v} type="button" className={`secondary-btn ${global === v ? "active" : ""}`}
              onClick={() => setGlobal(v)}>
              {v === 0 ? "0%" : pct(v, 0)}
            </button>
          ))}
          {Object.keys(overrides).some((k) => overrides[k] !== "") && (
            <button type="button" className="secondary-btn" onClick={() => setOverrides({})}>
              Quitar ajustes individuales
            </button>
          )}
        </div>
      </div>

      <div className="stat-grid stat-grid-3">
        <div className="stat-tile">
          <div className="stat-label">Valor hoy</div>
          <div className="stat-value">{usd0(now)}</div>
        </div>
        <div className="stat-tile">
          <div className="stat-label">Valor en el escenario</div>
          <div className="stat-value">{usd0(next)}</div>
        </div>
        <div className="stat-tile">
          <div className="stat-label">Diferencia</div>
          <div className={`stat-value ${tone(diff)}`}>
            {signed(diff, usd0)} <span style={{ fontSize: 14 }}>({now > 0 ? pct((diff / now) * 100) : "—"})</span>
          </div>
        </div>
      </div>
      <p className="muted" style={{ fontSize: 13, margin: "-4px 0 14px" }}>
        Contra lo invertido ({usd0(invested)}), quedarías en{" "}
        <strong className={tone(next - invested)}>{signed(next - invested, usd0)}</strong>
        {invested > 0 && ` (${pct(((next - invested) / invested) * 100)})`}.
      </p>

      <div style={{ overflowX: "auto" }}>
        <table className="rtable">
          <thead>
            <tr>
              <th>Instrumento</th>
              <th className="right">Cambio de precio</th>
              <th className="right">Precio hoy → escenario</th>
              <th className="right">Valor hoy</th>
              <th className="right">Valor en el escenario</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td data-label="Instrumento">
                  <strong>{r.symbol}</strong>
                  <div className="muted" style={{ fontSize: 12, fontWeight: 400 }}>{r.name}</div>
                </td>
                <td data-label="Cambio de precio" className="right">
                  <span className="pct-input">
                    <input type="number" step="1" aria-label={`Cambio de precio de ${r.symbol}`}
                      placeholder={String(global)} value={overrides[r.id] ?? ""}
                      onChange={(e) => setOverrides((o) => ({ ...o, [r.id]: e.target.value }))} />
                    %
                  </span>
                </td>
                <td data-label="Precio" className="right">
                  {usd(r.price)} → <span className={tone(r.change)}>{usd(r.newPrice)}</span>
                </td>
                <td data-label="Valor hoy" className="right">{usd(r.valueNow)}</td>
                <td data-label="Valor en el escenario" className={`right ${tone(r.valueNew - r.valueNow)}`}>
                  {usd(r.valueNew)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Disclaimer />
    </div>
  );
}

export default function Simulator({
  holdings,
  instruments,
  mode,
  initialSymbol,
}: {
  holdings: SimHolding[];
  instruments: SimInstrument[];
  mode?: "operacion" | "escenarios";
  initialSymbol?: string;
}) {
  const [tab, setTab] = useState<"operacion" | "escenarios">(mode ?? "operacion");

  const positions: Position[] = holdings
    .filter((h) => h.instrument && h.quantity > 0)
    .map((h) => ({
      id: h.instrument!.id,
      symbol: h.instrument!.symbol,
      name: h.instrument!.name,
      qty: Number(h.quantity),
      avg: Number(h.avg_cost),
      price: Number(h.instrument!.current_price),
    }))
    .sort((a, b) => b.qty * b.price - a.qty * a.price);
  const acquiredAt: Record<string, string | null> = {};
  holdings.forEach((h) => {
    if (h.instrument) acquiredAt[h.instrument.id] = h.first_acquired_at;
  });

  if (mode === "operacion")
    return <TradeSimulation positions={positions} instruments={instruments} acquiredAt={acquiredAt} initialSymbol={initialSymbol} />;
  if (mode === "escenarios") return <ScenarioSimulation positions={positions} />;

  return (
    <div>
      <div className="tabs" role="tablist" aria-label="Tipo de simulación">
        <button type="button" role="tab" aria-selected={tab === "operacion"}
          className={tab === "operacion" ? "active" : ""} onClick={() => setTab("operacion")}>
          Simular una operación
        </button>
        <button type="button" role="tab" aria-selected={tab === "escenarios"}
          className={tab === "escenarios" ? "active" : ""} onClick={() => setTab("escenarios")}>
          Escenarios de mercado
        </button>
      </div>
      {tab === "operacion" ? (
        <TradeSimulation positions={positions} instruments={instruments} acquiredAt={acquiredAt} />
      ) : (
        <ScenarioSimulation positions={positions} />
      )}
    </div>
  );
}
