import { DIVIDEND_WITHHOLDING, netOf, frequencyLabel, fmtDate, WITHHOLDING_NOTE } from "@/lib/dividends";
import Note from "./Note";

function usd(v: number, d = 2) {
  return v.toLocaleString("es-UY", { style: "currency", currency: "USD", minimumFractionDigits: d, maximumFractionDigits: d > 2 ? d : 2 });
}

// Bloque de dividendos de un instrumento: bruto, retención del 30 % y neto.
export default function DividendSummary({
  price,
  divTtm,
  count,
  lastDate,
  lastAmount,
  units,
}: {
  price: number;
  divTtm: number;
  count: number;
  lastDate: string | null;
  lastAmount: number | null;
  units?: number | null;
}) {
  if (!(divTtm > 0)) {
    return (
      <div className="dividend-box">
        <strong>Dividendos:</strong>{" "}
        <span className="muted">no paga dividendos (no hubo pagos en el último año).</span>
      </div>
    );
  }
  const yieldGross = price > 0 ? (divTtm / price) * 100 : 0;
  const tax = divTtm * DIVIDEND_WITHHOLDING;
  return (
    <div className="dividend-box">
      <div className="dividend-head">
        <strong>Dividendos</strong>
        <span className="muted"> · pago {frequencyLabel(count)}</span>
      </div>
      <div className="dividend-grid">
        <div>
          <div className="stat-label">Rendimiento anual</div>
          <div className="dividend-main">{netOf(yieldGross).toFixed(2)}% neto</div>
          <div className="muted" style={{ fontSize: 12 }}>{yieldGross.toFixed(2)}% bruto</div>
        </div>
        <div>
          <div className="stat-label">Por unidad, por año</div>
          <div style={{ fontSize: 13, lineHeight: 1.6 }}>
            Bruto {usd(divTtm, 4)}<br />
            Retención 30 %: −{usd(tax, 4)}<br />
            <strong>Neto {usd(netOf(divTtm), 4)}</strong>
          </div>
        </div>
        <div>
          <div className="stat-label">Último pago</div>
          <div style={{ fontSize: 13, lineHeight: 1.6 }}>
            {lastAmount != null ? `${usd(Number(lastAmount), 4)} bruto` : "—"}<br />
            <span className="muted">fecha ex-dividendo {fmtDate(lastDate)}</span>
          </div>
        </div>
        {units != null && units > 0 && (
          <div>
            <div className="stat-label">Con tus {units.toLocaleString("es-UY", { maximumFractionDigits: 4 })} unidades</div>
            <div className="dividend-main">{usd(netOf(divTtm) * units)} neto/año</div>
            <div className="muted" style={{ fontSize: 12 }}>estimado</div>
          </div>
        )}
      </div>
      <Note more={WITHHOLDING_NOTE}>Estimado, neto de la retención del 30 % de Schwab.</Note>
    </div>
  );
}
