"use client";

import { useState, useTransition } from "react";
import { recordMyTrade } from "@/app/actions";
import Note from "./Note";

type Instrument = {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
};

type Holding = {
  instrument_id: string;
  quantity: number;
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function TradeForm({
  instruments,
  holdings,
  initialSymbol,
}: {
  instruments: Instrument[];
  holdings: Holding[];
  initialSymbol?: string;
}) {
  const [operationType, setOperationType] = useState<"comprar" | "vender">(
    "comprar"
  );
  const [instrumentId, setInstrumentId] = useState(
    instruments.find((i) => i.symbol === initialSymbol?.toUpperCase())?.id || ""
  );
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [executedAt, setExecutedAt] = useState(today());
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const labelOf = (i: Instrument) => `${i.symbol} — ${i.name}`;
  const initialInst = instruments.find((i) => i.id === instrumentId);
  const [query, setQuery] = useState(initialSymbol && initialInst ? labelOf(initialInst) : "");

  // Acepta el texto exacto de la lista o solo el símbolo (ej. "voo").
  function pickInstrument(text: string) {
    setQuery(text);
    const t = text.trim().toUpperCase();
    const hit =
      instruments.find((i) => labelOf(i).toUpperCase() === t) ||
      instruments.find((i) => i.symbol.toUpperCase() === t);
    setInstrumentId(hit ? hit.id : "");
  }

  const holdingForInstrument = holdings.find(
    (h) => h.instrument_id === instrumentId
  );
  const selected = instruments.find((i) => i.id === instrumentId);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const qty = Number(quantity);
    const prc = Number(price);

    if (!instrumentId) return setError("Elegí un instrumento.");
    if (!Number.isFinite(qty) || qty <= 0)
      return setError("La cantidad tiene que ser mayor a 0.");
    if (!Number.isFinite(prc) || prc <= 0)
      return setError("El precio de ejecución tiene que ser mayor a 0.");
    if (!executedAt) return setError("Indicá la fecha de la operación.");

    startTransition(async () => {
      try {
        await recordMyTrade({
          instrumentId,
          operationType,
          quantity: qty,
          price: prc,
          executedAt: new Date(executedAt + "T12:00:00").toISOString(),
        });
        setSuccess(
          `Operación registrada: ${
            operationType === "comprar" ? "compra" : "venta"
          } de ${qty} ${selected?.symbol || ""} a $${prc}. Tu cartera ya quedó actualizada.`
        );
        setQuantity("");
        setPrice("");
      } catch (e: any) {
        setError(e.message || "No se pudo registrar la operación.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="error-box">{error}</div>}
      {success && (
        <div
          className="error-box"
          style={{
            background: "rgba(12,163,12,0.1)",
            borderColor: "var(--status-good)",
            color: "var(--status-good)",
          }}
        >
          {success}
        </div>
      )}

      <div className="form-row">
        <div className="field">
          <label htmlFor="operation_type">Tipo de operación</label>
          <select
            id="operation_type"
            value={operationType}
            onChange={(e) =>
              setOperationType(e.target.value as "comprar" | "vender")
            }
          >
            <option value="comprar">Compra</option>
            <option value="vender">Venta</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="instrument_id">Instrumento</label>
          <input
            id="instrument_id"
            list="trade-instruments"
            autoComplete="off"
            placeholder="Escribí el símbolo o el nombre (ej. VOO, Apple)"
            value={query}
            onChange={(e) => pickInstrument(e.target.value)}
            onFocus={(e) => e.target.select()}
          />
          <datalist id="trade-instruments">
            {instruments.map((inst) => (
              <option key={inst.id} value={labelOf(inst)} />
            ))}
          </datalist>
          {query && !selected && (
            <p className="delta-down" style={{ fontSize: 13, margin: "4px 0 0" }}>
              Elegí un instrumento de la lista.
            </p>
          )}
          <p className="muted" style={{ fontSize: 12, margin: "4px 0 0" }}>
            ¿No está en la lista? Buscalo en{" "}
            <a href="/mercado?ver=buscar">Mercado › Buscar</a> y tocá &quot;Ya lo compré&quot;.
          </p>
        </div>
      </div>

      {operationType === "vender" && (
        <p className="muted" style={{ fontSize: 12, marginTop: -4 }}>
          {holdingForInstrument
            ? `Tenencia registrada: ${holdingForInstrument.quantity} unidades.`
            : "No tenés tenencias registradas de este instrumento."}
        </p>
      )}

      <div className="form-row">
        <div className="field">
          <label htmlFor="quantity">Cantidad de unidades</label>
          <input
            id="quantity"
            type="number"
            step="0.000001"
            min="0"
            placeholder="Ej: 5"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="price">Precio por unidad (USD)</label>
          <input
            id="price"
            type="number"
            step="0.0001"
            min="0"
            placeholder={
              selected ? selected.current_price.toFixed(2) : "Ej: 150.25"
            }
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
          <p className="muted" style={{ fontSize: 12 }}>
            El precio al que efectivamente operaste, no el de mercado de hoy.
          </p>
        </div>
      </div>

      <div className="field">
        <label htmlFor="executed_at">Fecha de la operación</label>
        <input
          id="executed_at"
          type="date"
          value={executedAt}
          max={today()}
          onChange={(e) => setExecutedAt(e.target.value)}
        />
      </div>

      <Note more="La información que cargás no ejecuta ninguna operación ni tiene validez como comprobante. Sos responsable de que los datos sean correctos. Si te equivocás, podés corregir o eliminar la operación en la lista de abajo.">
        Es solo para tu seguimiento: el registro oficial es el de tu bróker.
      </Note>

      <button type="submit" disabled={pending}>
        {pending ? "Registrando…" : "Registrar operación"}
      </button>
    </form>
  );
}
