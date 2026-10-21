import { netOf } from "@/lib/dividends";
import Note from "./Note";

export type TrendRow = {
  symbol: string;
  name: string | null;
  exchange: string | null;
  price: number | null;
  change: number | null;
  change_pct: number | null;
  volume: number | null;
  market_cap: number | null;
  div_rate?: number | null;
  div_yield?: number | null;
  rank: number;
  fetched_at: string;
};

function fmtCompact(v: number | null) {
  if (v == null) return "—";
  const n = Number(v);
  const f = (x: number) => x.toLocaleString("es-UY", { maximumFractionDigits: 1 });
  if (n >= 1e12) return `${f(n / 1e12)} billones`;
  if (n >= 1e9) return `${f(n / 1e9)} mil M`;
  if (n >= 1e6) return `${f(n / 1e6)} M`;
  if (n >= 1e3) return `${f(n / 1e3)} mil`;
  return f(n);
}

function fmtPrice(v: number | null) {
  if (v == null) return "—";
  return Number(v).toLocaleString("es-UY", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

export default function MarketTrends({ rows }: { rows: TrendRow[] }) {
  const updated = rows[0]?.fetched_at;

  return (
    <div>
      <Note tone="warn" more="La lista se arma sola, sin selección manual y sin tener en cuenta tu cartera ni tu perfil. Que una acción haya subido hoy no dice nada de lo que va a pasar después.">
        <strong>Dato de mercado, igual para todos.</strong> No es una recomendación.
      </Note>

      {rows.length === 0 ? (
        <p className="muted" style={{ fontSize: 13 }}>
          Todavía no hay datos de mercado disponibles. La lista se actualiza
          cada 15 minutos.
        </p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="rtable rtable-titled">
            <thead>
              <tr>
                <th>#</th>
                <th>Acción</th>
                <th className="right">Precio</th>
                <th className="right">Variación del día</th>
                <th className="right">Volumen</th>
                <th className="right">Capitalización</th>
                <th className="right">Dividendo anual</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.symbol}>
                  <td data-label="#" className="muted hide-mobile">{r.rank}</td>
                  <td data-label="Acción" className="cell-title">
                    <a className="symbol-link" href={`/mercado?ver=buscar&q=${encodeURIComponent(r.symbol)}`}>
                      {r.symbol}
                    </a>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {r.name}
                      {r.exchange ? ` · ${r.exchange}` : ""}
                    </div>
                  </td>
                  <td data-label="Precio" className="right">{fmtPrice(r.price)}</td>
                  <td data-label="Variación del día" className="right delta-up">
                    {r.change_pct != null
                      ? `▲ ${Number(r.change_pct).toFixed(2)}%`
                      : "—"}
                    {r.change != null && (
                      <div style={{ fontSize: 12 }}>
                        +{Number(r.change).toFixed(2)}
                      </div>
                    )}
                  </td>
                  <td data-label="Volumen" className="right">{fmtCompact(r.volume)}</td>
                  <td data-label="Capitalización" className="right">{fmtCompact(r.market_cap)}</td>
                  <td data-label="Dividendo anual" className="right">
                    {r.div_yield && Number(r.div_yield) > 0 ? (
                      <>
                        {(netOf(Number(r.div_yield)) * 100).toFixed(2)}% neto
                        <div className="muted" style={{ fontSize: 12 }}>
                          {(Number(r.div_yield) * 100).toFixed(2)}% bruto
                        </div>
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
      )}

      <Note
        more={
          <>
            Criterio: acciones de EE.UU. con mayor suba porcentual en la jornada (más de 3%,
            precio de US$ 5 o más), según el filtro público &quot;Day Gainers&quot; de Yahoo
            Finance. Dividendo anual: lo pagado en los últimos 12 meses sobre el precio actual;
            el neto descuenta la retención del 30 % que aplica Schwab. Los datos pueden tener
            demora y errores.
          </>
        }
      >
        Fuente: Yahoo Finance
        {updated &&
          ` · actualizado ${new Date(updated).toLocaleString("es-UY", {
            timeZone: "America/Montevideo",
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          })} (hora de Uruguay)`}
      </Note>
    </div>
  );
}
