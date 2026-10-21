"use client";

import { useMemo, useRef, useState } from "react";

export type RealizedTx = {
  id: string;
  executed_at: string;
  symbol: string;
  name: string;
  amount: number;
  cost_basis: number;
  realized_gain: number;
  acquired_at: string | null;
};

function fmtUSD(v: number) {
  return v.toLocaleString("es-UY", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

function fmtPct(v: number) {
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("es-UY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function plazoOf(tx: RealizedTx): "corto" | "largo" {
  if (!tx.acquired_at) return "corto";
  const days =
    (new Date(tx.executed_at).getTime() - new Date(tx.acquired_at).getTime()) /
    (1000 * 60 * 60 * 24);
  return days >= 365 ? "largo" : "corto";
}

function Gauge({ ratioPct }: { ratioPct: number | null }) {
  const size = 160;
  const cx = size / 2;
  const cy = size / 2;
  const r = 60;
  const strokeWidth = 14;
  const circumference = 2 * Math.PI * r;
  const f = ratioPct == null ? 0 : Math.min(1, Math.max(0, ratioPct / 100));
  const dashOffset = circumference * (1 - f);
  const color =
    ratioPct == null
      ? "var(--text-muted)"
      : ratioPct >= 50
      ? "var(--status-good)"
      : "var(--status-critical)";

  return (
    <div className="gauge-wrap">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        style={{ width: "100%", maxWidth: 180, height: "auto", display: "block" }}
        role="img"
        aria-label="Relación ganancia/pérdida"
      >
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="var(--gridline)"
          strokeWidth={strokeWidth}
        />
        {ratioPct != null && (
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            transform={`rotate(-90 ${cx} ${cy})`}
          />
        )}
        <text x={cx} y={cy + 7} textAnchor="middle" className="gauge-value">
          {ratioPct == null ? "—" : `${ratioPct.toFixed(2)}%`}
        </text>
      </svg>
      <div className="gauge-label">Ganancias sobre pérdidas</div>
    </div>
  );
}

function BubbleChart({ rows }: { rows: RealizedTx[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const width = 640;
  const height = 260;
  const padding = { top: 20, right: 20, bottom: 28, left: 44 };

  const { points, minY, maxY } = useMemo(() => {
    if (rows.length === 0) return { points: [], minY: 0, maxY: 0 };
    const pcts = rows.map((r) =>
      r.cost_basis > 0 ? (r.realized_gain / r.cost_basis) * 100 : 0
    );
    const amounts = rows.map((r) => Math.abs(r.amount));
    const maxAmount = Math.max(...amounts, 1);
    let minY = Math.min(0, ...pcts);
    let maxY = Math.max(0, ...pcts);
    if (minY === maxY) {
      minY -= 1;
      maxY += 1;
    }
    const spanY = maxY - minY;
    const innerW = width - padding.left - padding.right;
    const innerH = height - padding.top - padding.bottom;
    const points = rows.map((r, i) => {
      const pct = pcts[i];
      const x =
        padding.left +
        (rows.length === 1 ? innerW / 2 : (i / (rows.length - 1)) * innerW);
      const y = padding.top + innerH - ((pct - minY) / spanY) * innerH;
      const radius = 4 + (Math.abs(r.amount) / maxAmount) * 14;
      return { x, y, pct, radius, tx: r };
    });
    return { points, minY, maxY };
  }, [rows]);

  if (rows.length === 0) {
    return (
      <p className="muted" style={{ fontSize: 13 }}>
        Todavía no hay ventas o rescates ejecutados para graficar.
      </p>
    );
  }

  const zeroY =
    padding.top +
    (height - padding.top - padding.bottom) -
    ((0 - minY) / (maxY - minY)) * (height - padding.top - padding.bottom);

  return (
    <div style={{ position: "relative" }}>
      <p className="tag-op" style={{ marginTop: 0 }}>
        Gráfico basado en {rows.length} registro{rows.length === 1 ? "" : "s"}. El
        tamaño de cada burbuja representa el monto de la operación.
      </p>
      <div style={{ display: "flex", gap: 16, marginBottom: 8, fontSize: 12 }}>
        <span>
          <span
            className="legend-dot"
            style={{ background: "var(--status-good)" }}
          />
          Ganancia
        </span>
        <span>
          <span
            className="legend-dot"
            style={{ background: "var(--status-critical)" }}
          />
          Pérdida
        </span>
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: "100%", height: "auto", display: "block" }}
        role="img"
        aria-label="Ganancias y pérdidas realizadas por operación"
        onMouseLeave={() => setHover(null)}
      >
        <line
          x1={padding.left}
          x2={width - padding.right}
          y1={zeroY}
          y2={zeroY}
          stroke="var(--baseline)"
          strokeWidth={1}
        />
        <text
          x={padding.left - 6}
          y={zeroY + 4}
          textAnchor="end"
          fontSize={10}
          fill="var(--text-muted)"
        >
          0%
        </text>
        <text x={padding.left - 6} y={padding.top + 4} textAnchor="end" fontSize={10} fill="var(--text-muted)">
          {maxY.toFixed(0)}%
        </text>
        <text
          x={padding.left - 6}
          y={height - padding.bottom}
          textAnchor="end"
          fontSize={10}
          fill="var(--text-muted)"
        >
          {minY.toFixed(0)}%
        </text>

        {points.map((p, i) => (
          <circle
            key={p.tx.id}
            cx={p.x}
            cy={p.y}
            r={p.radius}
            fill={p.tx.realized_gain >= 0 ? "var(--status-good)" : "var(--status-critical)"}
            opacity={hover === null || hover === i ? 0.75 : 0.3}
            stroke="var(--card-bg)"
            strokeWidth={1}
            onMouseEnter={() => setHover(i)}
          />
        ))}
      </svg>

      {hover !== null && (
        <div
          className="chart-tooltip"
          style={{
            left: `${(points[hover].x / width) * 100}%`,
            top: `${(points[hover].y / height) * 100}%`,
            transform: "translate(-50%, -120%)",
          }}
        >
          <div style={{ fontWeight: 600 }}>{points[hover].tx.symbol}</div>
          <div className="muted">{fmtDate(points[hover].tx.executed_at)}</div>
          <div>
            {fmtUSD(points[hover].tx.realized_gain)} ({fmtPct(points[hover].pct)})
          </div>
        </div>
      )}
    </div>
  );
}

export default function RealizedGainLoss({ rows }: { rows: RealizedTx[] }) {
  const [view, setView] = useState<"chart" | "detalle">("chart");

  const stats = useMemo(() => {
    const totalProceeds = rows.reduce((s, r) => s + r.amount, 0);
    const totalCostBasis = rows.reduce((s, r) => s + r.cost_basis, 0);
    const totalGains = rows
      .filter((r) => r.realized_gain > 0)
      .reduce((s, r) => s + r.realized_gain, 0);
    const totalLosses = rows
      .filter((r) => r.realized_gain < 0)
      .reduce((s, r) => s + r.realized_gain, 0);
    const netGain = totalGains + totalLosses;
    const netGainPct = totalCostBasis > 0 ? (netGain / totalCostBasis) * 100 : 0;

    const corto = rows.filter((r) => plazoOf(r) === "corto");
    const largo = rows.filter((r) => plazoOf(r) === "largo");
    const cortoGain = corto.reduce((s, r) => s + r.realized_gain, 0);
    const cortoCost = corto.reduce((s, r) => s + r.cost_basis, 0);
    const largoGain = largo.reduce((s, r) => s + r.realized_gain, 0);
    const largoCost = largo.reduce((s, r) => s + r.cost_basis, 0);

    const denom = totalGains + Math.abs(totalLosses);
    const gainLossRatio = rows.length > 0 && denom > 0 ? (totalGains / denom) * 100 : null;

    const dates = rows.map((r) => new Date(r.executed_at).getTime());
    const periodStart = dates.length ? new Date(Math.min(...dates)) : null;
    const periodEnd = dates.length ? new Date(Math.max(...dates)) : null;

    return {
      totalProceeds,
      totalCostBasis,
      totalGains,
      totalLosses,
      netGain,
      netGainPct,
      cortoGain,
      cortoPct: cortoCost > 0 ? (cortoGain / cortoCost) * 100 : 0,
      largoGain,
      largoPct: largoCost > 0 ? (largoGain / largoCost) * 100 : 0,
      gainLossRatio,
      periodStart,
      periodEnd,
    };
  }, [rows]);

  return (
    <div>
      <div className="summary-grid" style={{ marginBottom: 16 }}>
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="summary-block-title">Período del reporte</div>
          <div style={{ fontSize: 14 }}>
            {stats.periodStart && stats.periodEnd
              ? `${fmtDate(stats.periodStart.toISOString())} — ${fmtDate(
                  stats.periodEnd.toISOString()
                )}`
              : "Sin operaciones realizadas todavía"}
          </div>
          <div className="summary-line" style={{ marginTop: 10 }}>
            <span className="muted">Total cobrado por ventas</span>
            <span className="summary-line-value">{fmtUSD(stats.totalProceeds)}</span>
          </div>
          <div className="summary-line">
            <span className="muted">Costo de lo vendido</span>
            <span className="summary-line-value">{fmtUSD(stats.totalCostBasis)}</span>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 0 }}>
          <div className="summary-block-title">Resultado por plazo</div>
          <div className="summary-line">
            <span className="muted">Largo plazo (≥ 365 días)</span>
            <span
              className={`summary-line-value ${
                stats.largoGain >= 0 ? "delta-up" : "delta-down"
              }`}
            >
              {fmtUSD(stats.largoGain)} ({fmtPct(stats.largoPct)})
            </span>
          </div>
          <div className="summary-line">
            <span className="muted">Corto plazo (&lt; 365 días)</span>
            <span
              className={`summary-line-value ${
                stats.cortoGain >= 0 ? "delta-up" : "delta-down"
              }`}
            >
              {fmtUSD(stats.cortoGain)} ({fmtPct(stats.cortoPct)})
            </span>
          </div>
          <div className="summary-line">
            <span className="muted">Resultado neto</span>
            <span
              className={`summary-line-value ${
                stats.netGain >= 0 ? "delta-up" : "delta-down"
              }`}
            >
              {fmtUSD(stats.netGain)} ({fmtPct(stats.netGainPct)})
            </span>
          </div>
        </div>

        <div
          className="card"
          style={{
            marginBottom: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div className="summary-block-title" style={{ alignSelf: "flex-start" }}>
            Ganancias y pérdidas
          </div>
          <div style={{ width: "100%", marginBottom: 8 }}>
            <div className="summary-line">
              <span className="muted">Suma de ganancias</span>
              <span className="summary-line-value delta-up">
                {fmtUSD(stats.totalGains)}
              </span>
            </div>
            <div className="summary-line">
              <span className="muted">Suma de pérdidas</span>
              <span className="summary-line-value delta-down">
                {fmtUSD(stats.totalLosses)}
              </span>
            </div>
          </div>
          <Gauge ratioPct={stats.gainLossRatio} />
        </div>
      </div>

      <div className="card" style={{ marginBottom: 0 }}>
        <h2 style={{ fontSize: 14 }}>Detalle de cada venta</h2>
        <div className="tabs">
          <button
            className={view === "chart" ? "active" : ""}
            onClick={() => setView("chart")}
            type="button"
          >
            Gráfico
          </button>
          <button
            className={view === "detalle" ? "active" : ""}
            onClick={() => setView("detalle")}
            type="button"
          >
            Detalle
          </button>
        </div>

        {view === "chart" ? (
          <BubbleChart rows={rows} />
        ) : rows.length === 0 ? (
          <p className="muted" style={{ fontSize: 13 }}>
            Todavía no hay ventas o rescates ejecutados.
          </p>
        ) : (
          <table className="rtable rtable-titled">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Instrumento</th>
                <th className="right">Monto</th>
                <th className="right">Costo base</th>
                <th className="right">Ganancia/Pérdida</th>
                <th className="right">%</th>
                <th>Plazo</th>
              </tr>
            </thead>
            <tbody>
              {[...rows].reverse().map((r) => {
                const pct = r.cost_basis > 0 ? (r.realized_gain / r.cost_basis) * 100 : 0;
                return (
                  <tr key={r.id}>
                    <td data-label="Fecha">{fmtDate(r.executed_at)}</td>
                    <td data-label="Instrumento" className="cell-title">
                      {r.symbol}
                      <div className="muted" style={{ fontSize: 12 }}>
                        {r.name}
                      </div>
                    </td>
                    <td data-label="Monto" className="right">{fmtUSD(r.amount)}</td>
                    <td data-label="Costo base" className="right">{fmtUSD(r.cost_basis)}</td>
                    <td data-label="Ganancia/Pérdida" className={`right ${r.realized_gain >= 0 ? "delta-up" : "delta-down"}`}>
                      {fmtUSD(r.realized_gain)}
                    </td>
                    <td data-label="%" className={`right ${pct >= 0 ? "delta-up" : "delta-down"}`}>
                      {fmtPct(pct)}
                    </td>
                    <td data-label="Plazo" className="muted">
                      {plazoOf(r) === "largo" ? "Largo plazo" : "Corto plazo"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
