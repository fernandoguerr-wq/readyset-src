"use client";

import { useMemo, useRef, useState } from "react";

export type PortfolioPoint = {
  as_of_date: string;
  total_value: number;
};

function formatCurrency(v: number) {
  return v.toLocaleString("es-UY", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function formatDate(d: string) {
  const date = new Date(d + "T00:00:00");
  return date.toLocaleDateString("es-UY", { day: "2-digit", month: "short" });
}

export default function EvolutionChart({ data }: { data: PortfolioPoint[] }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const width = 640;
  const height = 220;
  const padding = { top: 16, right: 16, bottom: 28, left: 16 };

  const { points, minV, maxV } = useMemo(() => {
    if (data.length === 0) return { points: [] as { x: number; y: number }[], minV: 0, maxV: 0 };
    const values = data.map((d) => d.total_value);
    const minV = Math.min(...values);
    const maxV = Math.max(...values);
    const span = maxV - minV || 1;
    const innerW = width - padding.left - padding.right;
    const innerH = height - padding.top - padding.bottom;
    const points = data.map((d, i) => {
      const x =
        padding.left + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
      const y =
        padding.top + innerH - ((d.total_value - minV) / span) * innerH;
      return { x, y };
    });
    return { points, minV, maxV };
  }, [data]);

  if (data.length === 0) {
    return (
      <p className="muted" style={{ fontSize: 13 }}>
        Todavía no hay historial de evolución para graficar.
      </p>
    );
  }

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");

  const areaPath =
    `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${(
      height - padding.bottom
    ).toFixed(1)} L ${points[0].x.toFixed(1)} ${(height - padding.bottom).toFixed(1)} Z`;

  function handleMove(e: React.MouseEvent<SVGSVGElement>) {
    if (!svgRef.current || points.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = width / rect.width;
    const relX = (e.clientX - rect.left) * scaleX;
    let closest = 0;
    let closestDist = Infinity;
    points.forEach((p, i) => {
      const dist = Math.abs(p.x - relX);
      if (dist < closestDist) {
        closestDist = dist;
        closest = i;
      }
    });
    setHoverIdx(closest);
  }

  const gridLines = 3;

  return (
    <div style={{ position: "relative" }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: "100%", height: "auto", display: "block" }}
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverIdx(null)}
        role="img"
        aria-label="Evolución del valor de la cartera"
      >
        {Array.from({ length: gridLines }).map((_, i) => {
          const y =
            padding.top +
            ((height - padding.top - padding.bottom) * i) / (gridLines - 1);
          return (
            <line
              key={i}
              x1={padding.left}
              x2={width - padding.right}
              y1={y}
              y2={y}
              stroke="var(--gridline)"
              strokeWidth={1}
            />
          );
        })}

        <path d={areaPath} fill="var(--series-1)" opacity={0.08} stroke="none" />
        <path
          d={linePath}
          fill="none"
          stroke="var(--series-1)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {hoverIdx !== null && (
          <>
            <line
              x1={points[hoverIdx].x}
              x2={points[hoverIdx].x}
              y1={padding.top}
              y2={height - padding.bottom}
              stroke="var(--baseline)"
              strokeWidth={1}
            />
            <circle
              cx={points[hoverIdx].x}
              cy={points[hoverIdx].y}
              r={4}
              fill="var(--series-1)"
              stroke="var(--card-bg)"
              strokeWidth={2}
            />
          </>
        )}

        <text x={padding.left} y={height - 8} fontSize={11} fill="var(--text-muted)">
          {formatDate(data[0].as_of_date)}
        </text>
        <text
          x={width - padding.right}
          y={height - 8}
          fontSize={11}
          fill="var(--text-muted)"
          textAnchor="end"
        >
          {formatDate(data[data.length - 1].as_of_date)}
        </text>
      </svg>

      {hoverIdx !== null && (
        <div
          style={{
            position: "absolute",
            left: `${(points[hoverIdx].x / width) * 100}%`,
            top: 0,
            transform:
              hoverIdx > points.length / 2
                ? "translate(-100%, 0)"
                : "translate(4px, 0)",
            background: "var(--card-bg)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "6px 10px",
            fontSize: 12,
            pointerEvents: "none",
            boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
          }}
        >
          <div className="muted">{formatDate(data[hoverIdx].as_of_date)}</div>
          <div style={{ fontWeight: 600 }}>
            {formatCurrency(data[hoverIdx].total_value)}
          </div>
        </div>
      )}
    </div>
  );
}
