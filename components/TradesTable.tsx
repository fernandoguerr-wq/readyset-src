"use client";

import { Fragment, useState, useTransition } from "react";
import { deleteMyTrade, updateMyTrade } from "@/app/actions";

export type TradeRow = {
  id: string;
  instrument_id: string | null;
  operation_type: string;
  quantity: number | null;
  price: number | null;
  amount: number | null;
  realized_gain: number | null;
  executed_at: string;
  source: string;
  locked: boolean;
  edited_at: string | null;
  instrument: { symbol: string; name: string } | null;
};

type Instrument = { id: string; symbol: string; name: string };

const OP_LABEL: Record<string, string> = {
  comprar: "Compra",
  vender: "Venta",
  reinvertir: "Reinversión",
  rescatar: "Rescate",
};

function fmtUSD(v: number) {
  return v.toLocaleString("es-UY", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function EditRow({
  row,
  instruments,
  onDone,
}: {
  row: TradeRow;
  instruments: Instrument[];
  onDone: () => void;
}) {
  const [op, setOp] = useState<"comprar" | "vender">(
    row.operation_type === "vender" ? "vender" : "comprar"
  );
  const [instrumentId, setInstrumentId] = useState(row.instrument_id || "");
  const [quantity, setQuantity] = useState(String(row.quantity ?? ""));
  const [price, setPrice] = useState(String(row.price ?? ""));
  const [date, setDate] = useState(row.executed_at.slice(0, 10));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setError(null);
    const q = Number(quantity);
    const p = Number(price);
    if (!instrumentId) return setError("Elegí un instrumento.");
    if (!Number.isFinite(q) || q <= 0) return setError("La cantidad tiene que ser mayor a 0.");
    if (!Number.isFinite(p) || p <= 0) return setError("El precio tiene que ser mayor a 0.");
    if (!date) return setError("Indicá la fecha.");
    startTransition(async () => {
      try {
        await updateMyTrade({
          id: row.id,
          instrumentId,
          operationType: op,
          quantity: q,
          price: p,
          executedAt: new Date(date + "T12:00:00").toISOString(),
        });
        onDone();
      } catch (e: any) {
        setError(e.message || "No se pudo guardar la corrección.");
      }
    });
  }

  return (
    <tr className="edit-row">
      <td colSpan={8}>
        {error && <div className="error-box">{error}</div>}
        <div className="edit-grid">
          <div className="field">
            <label>Tipo</label>
            <select value={op} onChange={(e) => setOp(e.target.value as any)}>
              <option value="comprar">Compra</option>
              <option value="vender">Venta</option>
            </select>
          </div>
          <div className="field">
            <label>Instrumento</label>
            <select value={instrumentId} onChange={(e) => setInstrumentId(e.target.value)}>
              {instruments.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.symbol} — {i.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Cantidad</label>
            <input type="number" step="0.000001" min="0" value={quantity}
              onChange={(e) => setQuantity(e.target.value)} />
          </div>
          <div className="field">
            <label>Precio (USD)</label>
            <input type="number" step="0.0001" min="0" value={price}
              onChange={(e) => setPrice(e.target.value)} />
          </div>
          <div className="field">
            <label>Fecha</label>
            <input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
        <p className="muted" style={{ fontSize: 12, margin: "4px 0 10px" }}>
          Al guardar se recalculan tu tenencia, el costo promedio y las
          ganancias de las ventas posteriores de ese instrumento.
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={save} disabled={pending}>
            {pending ? "Guardando…" : "Guardar corrección"}
          </button>
          <button type="button" className="secondary-btn" onClick={onDone} disabled={pending}>
            Cancelar
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function TradesTable({
  rows,
  instruments,
}: {
  rows: TradeRow[];
  instruments: Instrument[];
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function remove(r: TradeRow) {
    const label = `${OP_LABEL[r.operation_type] || r.operation_type} de ${r.quantity} ${r.instrument?.symbol || ""} del ${new Date(r.executed_at).toLocaleDateString("es-UY")}`;
    if (!window.confirm(`¿Eliminar la operación "${label}"? Tu cartera se va a recalcular sin ella.`)) return;
    setError(null);
    startTransition(async () => {
      try {
        await deleteMyTrade(r.id);
      } catch (e: any) {
        setError(e.message || "No se pudo eliminar la operación.");
      }
    });
  }

  if (rows.length === 0) {
    return (
      <p className="muted" style={{ fontSize: 13 }}>
        Todavía no registraste ninguna operación. Cuando compres o vendas en tu
        plataforma de trading, cargala acá para que tu cartera quede al día.
      </p>
    );
  }

  return (
    <div>
      {error && <div className="error-box">{error}</div>}
      <div style={{ overflowX: "auto" }}>
        <table className="rtable rtable-titled">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Operación</th>
              <th>Instrumento</th>
              <th className="right">Cantidad</th>
              <th className="right">Precio</th>
              <th className="right">Monto</th>
              <th className="right">Ganancia realizada</th>
              <th className="right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const editable = r.source === "cliente" && !r.locked;
              return (
                <Fragment key={r.id}>
                  <tr>
                    <td data-label="Fecha">
                      {new Date(r.executed_at).toLocaleDateString("es-UY")}
                      {r.edited_at && (
                        <div className="muted" style={{ fontSize: 12 }}>corregida</div>
                      )}
                    </td>
                    <td data-label="Operación">
                      <span
                        className={
                          r.operation_type === "vender" || r.operation_type === "rescatar"
                            ? "delta-down"
                            : "delta-up"
                        }
                      >
                        {OP_LABEL[r.operation_type] || r.operation_type}
                      </span>
                    </td>
                    <td data-label="Instrumento" className="cell-title">
                      {r.instrument?.symbol || "—"}
                      <div className="muted" style={{ fontSize: 12 }}>{r.instrument?.name}</div>
                    </td>
                    <td data-label="Cantidad" className="right">{r.quantity ?? "—"}</td>
                    <td data-label="Precio" className="right">
                      {r.price != null ? `$${Number(r.price).toFixed(2)}` : "—"}
                    </td>
                    <td data-label="Monto" className="right">{r.amount != null ? fmtUSD(Number(r.amount)) : "—"}</td>
                    <td data-label="Ganancia realizada"
                      className={`right ${
                        r.realized_gain == null
                          ? "muted"
                          : Number(r.realized_gain) >= 0
                          ? "delta-up"
                          : "delta-down"
                      }`}
                    >
                      {r.realized_gain == null ? "—" : fmtUSD(Number(r.realized_gain))}
                    </td>
                    <td data-label="Acciones" className="right" style={{ whiteSpace: "nowrap" }}>
                      {editable ? (
                        <>
                          <button type="button" className="link-btn" disabled={pending}
                            onClick={() => setEditingId(editingId === r.id ? null : r.id)}>
                            Corregir
                          </button>
                          <button type="button" className="link-btn link-btn-danger" disabled={pending}
                            onClick={() => remove(r)}>
                            Eliminar
                          </button>
                        </>
                      ) : (
                        <span
                          className="muted"
                          style={{ fontSize: 12 }}
                          title={
                            r.locked
                              ? "Quedó incluida en una carga de cartera posterior."
                              : "Operación histórica cargada antes de que existiera el registro propio."
                          }
                        >
                          {r.locked ? "Consolidada" : "Histórica"}
                        </span>
                      )}
                    </td>
                  </tr>
                  {editingId === r.id && (
                    <EditRow row={r} instruments={instruments} onDone={() => setEditingId(null)} />
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="muted" style={{ fontSize: 12, marginTop: 10, lineHeight: 1.5 }}>
        Podés corregir o eliminar las operaciones que registraste vos. Las
        marcadas como &quot;Histórica&quot; o &quot;Consolidada&quot; forman
        parte de una carga de cartera y no se editan desde acá.
      </p>
    </div>
  );
}
