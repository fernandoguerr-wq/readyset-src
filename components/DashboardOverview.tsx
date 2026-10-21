"use client";

import { useMemo, useState } from "react";
import PortfolioComposition, {
  type CompositionSlice,
} from "./PortfolioComposition";
import HoldingsTable, { type HoldingRow } from "./HoldingsTable";
import { DIVIDEND_WITHHOLDING, netOf } from "@/lib/dividends";

const TYPE_LABEL: Record<string, string> = {
  accion: "Acciones",
  etf: "ETFs",
  fondo: "Fondos",
  bono: "Bonos",
  otro: "Otros",
};
const TYPE_ORDER = ["accion", "etf", "fondo", "bono", "otro"];
const TYPE_COLOR: Record<string, string> = {
  accion: "--cat-accion",
  etf: "--cat-etf",
  fondo: "--cat-fondo",
  bono: "--cat-bono",
  otro: "--cat-otro",
};

function fmtUSD0(v: number) {
  return v.toLocaleString("es-UY", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export default function DashboardOverview({
  holdings,
  realizedTotal,
}: {
  holdings: HoldingRow[];
  realizedTotal: number;
}) {
  const [selectedType, setSelectedType] = useState<string | null>(null);

  // La composición siempre se calcula con la cartera completa, para que el
  // gráfico de anillos muestre siempre el desglose total y se pueda hacer
  // clic en cualquier porción, esté o no seleccionada.
  const compositionSlices: CompositionSlice[] = useMemo(() => {
    const valueByType = new Map<string, number>();
    holdings.forEach((h) => {
      const t = h.instrument?.type || "otro";
      const v = h.quantity * (h.instrument?.current_price || 0);
      valueByType.set(t, (valueByType.get(t) || 0) + v);
    });
    return TYPE_ORDER.filter((t) => valueByType.has(t)).map((t) => ({
      type: t,
      label: TYPE_LABEL[t],
      value: valueByType.get(t) || 0,
      colorVar: TYPE_COLOR[t],
    }));
  }, [holdings]);

  const filteredHoldings = useMemo(
    () =>
      selectedType
        ? holdings.filter((h) => (h.instrument?.type || "otro") === selectedType)
        : holdings,
    [holdings, selectedType]
  );

  const currentValue = filteredHoldings.reduce(
    (sum, h) => sum + h.quantity * (h.instrument?.current_price || 0),
    0
  );
  const investedValue = filteredHoldings.reduce(
    (sum, h) => sum + h.quantity * h.avg_cost,
    0
  );
  const gain = currentValue - investedValue;
  const gainPct = investedValue > 0 ? (gain / investedValue) * 100 : 0;
  const instrumentCount = filteredHoldings.length;
  // Movimiento de hoy respecto del cierre anterior.
  let dayUsd = 0, prevValue = 0, up = 0, down = 0;
  filteredHoldings.forEach((h) => {
    const p = Number(h.instrument?.current_price) || 0;
    const prev = Number(h.instrument?.previous_close) || 0;
    if (prev > 0) {
      dayUsd += (p - prev) * h.quantity;
      prevValue += prev * h.quantity;
      if (p > prev) up++;
      else if (p < prev) down++;
    }
  });
  const dayPct = prevValue > 0 ? (dayUsd / prevValue) * 100 : 0;
  // Dividendos estimados para los próximos 12 meses (según los últimos 12).
  const divGross = filteredHoldings.reduce(
    (s, h) => s + h.quantity * (Number(h.instrument?.div_ttm) || 0),
    0
  );
  const payers = filteredHoldings.filter((h) => Number(h.instrument?.div_ttm) > 0).length;
  const selectedLabel = selectedType ? TYPE_LABEL[selectedType] : null;

  if (holdings.length === 0) {
    return (
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Tu cartera todavía está vacía</h2>
        <p style={{ fontSize: 14, lineHeight: 1.6 }}>
          ReadySet sigue las inversiones que hacés en tu bróker. Para empezar:
        </p>
        <ol className="first-steps">
          <li>
            <strong>¿Todavía no tenés cuenta en un bróker?</strong>{" "}
            <a href="/como-empezar">Mirá cómo abrir una</a>.
          </li>
          <li>
            <strong>¿Ya invertiste en Schwab?</strong> Subí el archivo de posiciones y
            en un minuto ves el valor, la ganancia y los dividendos de tu cartera.
            <div style={{ margin: "8px 0 4px" }}>
              <a className="btn" href="/dashboard?ver=importar">Subir mi archivo de Schwab</a>
            </div>
            <span className="muted" style={{ fontSize: 13 }}>
              ¿Otro bróker? <a href="/dashboard?ver=operaciones">Registrá tus compras a mano</a>.
            </span>
          </li>
          <li>
            <strong>¿Querés practicar primero?</strong> Armá una{" "}
            <a href="/explorar?ver=practica">cartera de práctica</a> con dinero ficticio.
          </li>
        </ol>
      </div>
    );
  }

  return (
    <>
      {selectedLabel && (
        <div className="filter-banner">
          Mostrando solo <strong>{selectedLabel}</strong> — los indicadores y
          la tabla de tenencias están filtrados.
          <button className="filter-clear-btn" onClick={() => setSelectedType(null)}>
            Quitar filtro ✕
          </button>
        </div>
      )}

      <div className="card">
        <div className="hero-head">
          <h2 className="muted" style={{ margin: 0 }}>
            {selectedLabel
              ? `Valor actual — ${selectedLabel}`
              : "Valor actual de la cartera"}
          </h2>
          <a className="secondary-btn hero-action" href="/dashboard?ver=importar">Actualizar cartera</a>
        </div>
        <div className="hero-value">{fmtUSD0(currentValue)}</div>
        <p
          style={{
            margin: 0,
            fontSize: 14,
            color: gain >= 0 ? "var(--status-good)" : "var(--status-critical)",
          }}
        >
          {gain >= 0 ? "+" : ""}
          {fmtUSD0(gain)} ({gainPct >= 0 ? "+" : ""}
          {gainPct.toFixed(1)}%) desde el costo de compra
        </p>
        {prevValue > 0 && (
          <p style={{ margin: "4px 0 0", fontSize: 14 }}>
            <span className={dayUsd > 0 ? "delta-up" : dayUsd < 0 ? "delta-down" : "muted"}>
              Hoy {dayUsd >= 0 ? "+" : "−"}
              {fmtUSD0(Math.abs(dayUsd))} ({dayPct >= 0 ? "+" : "−"}
              {Math.abs(dayPct).toFixed(2)}%)
            </span>
            <span className="muted"> · {up} en alza · {down} en baja</span>
          </p>
        )}
      </div>

      <div className="stat-grid stat-grid-3">
        <div className="stat-tile">
          <div className="stat-label">Invertido</div>
          <div className="stat-value">{fmtUSD0(investedValue)}</div>
        </div>
        <div className="stat-tile" title={`Bruto ${fmtUSD0(divGross)} − retención 30 % (${fmtUSD0(divGross * DIVIDEND_WITHHOLDING)}). Estimado con los pagos del último año.`}>
          <div className="stat-label">Dividendos por año (netos)</div>
          <div className={`stat-value ${divGross > 0 ? "delta-up" : ""}`}>{fmtUSD0(netOf(divGross))}</div>
          <div className="stat-foot">
            {divGross > 0
              ? `${currentValue > 0 ? ((netOf(divGross) / currentValue) * 100).toFixed(2) : "0"}% neto · ${payers} de ${instrumentCount} pagan`
              : "ningún instrumento paga dividendos"}
          </div>
        </div>
        <a className="stat-tile stat-tile-link" href="/dashboard?ver=ganancias">
          <div className="stat-label">Ganancia realizada</div>
          <div className={`stat-value ${realizedTotal > 0 ? "delta-up" : realizedTotal < 0 ? "delta-down" : ""}`}>
            {realizedTotal >= 0 ? "" : "−"}
            {fmtUSD0(Math.abs(realizedTotal))}
          </div>
          <div className="stat-foot">de tus ventas · ver detalle</div>
        </a>
      </div>

      <div className="card">
        <h2>Composición de la cartera</h2>
        <p className="tag-op" style={{ marginTop: -8 }}>
          Hacé clic en una porción o en la leyenda para filtrar el resto de
          la página por ese tipo de instrumento.
        </p>
        <PortfolioComposition
          slices={compositionSlices}
          selectedType={selectedType}
          onSelectType={setSelectedType}
        />
      </div>

      <div className="card">
        <h2>Mis tenencias{selectedLabel ? ` — ${selectedLabel}` : ""} <span className="muted" style={{ fontWeight: 400 }}>({instrumentCount})</span></h2>
        <HoldingsTable rows={filteredHoldings} />
      </div>
    </>
  );
}
