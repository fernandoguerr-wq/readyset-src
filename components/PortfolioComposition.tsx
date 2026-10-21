"use client";

import { useMemo, useState } from "react";

export type CompositionSlice = {
  type: string;
  label: string;
  value: number;
  colorVar: string;
};

function formatUSD(v: number) {
  return v.toLocaleString("es-UY", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export default function PortfolioComposition({
  slices,
  selectedType = null,
  onSelectType,
}: {
  slices: CompositionSlice[];
  selectedType?: string | null;
  onSelectType?: (type: string | null) => void;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const total = slices.reduce((s, x) => s + x.value, 0);
  const clickable = !!onSelectType;

  function toggle(type: string) {
    if (!onSelectType) return;
    onSelectType(selectedType === type ? null : type);
  }

  const arcs = useMemo(() => {
    if (total <= 0) return [];
    let acc = 0;
    const r = 70;
    const cx = 90;
    const cy = 90;
    const strokeWidth = 26;
    return slices.map((s, i) => {
      const fraction = s.value / total;
      const startAngle = acc * 2 * Math.PI - Math.PI / 2;
      acc += fraction;
      const endAngle = acc * 2 * Math.PI - Math.PI / 2;
      const largeArc = fraction > 0.5 ? 1 : 0;
      const x1 = cx + r * Math.cos(startAngle);
      const y1 = cy + r * Math.sin(startAngle);
      const x2 = cx + r * Math.cos(endAngle);
      const y2 = cy + r * Math.sin(endAngle);
      const path =
        fraction >= 0.9999
          ? `M ${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx + r} ${cy} A ${r} ${r} 0 1 1 ${
              cx - r
            } ${cy}`
          : `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${x2.toFixed(
              2
            )} ${y2.toFixed(2)}`;
      return { path, fraction, index: i, strokeWidth, cx, cy, r };
    });
  }, [slices, total]);

  if (total <= 0) {
    return (
      <p className="muted" style={{ fontSize: 13 }}>
        Todavía no hay tenencias para mostrar la composición.
      </p>
    );
  }

  const activeIndex =
    hover !== null
      ? hover
      : selectedType
      ? slices.findIndex((s) => s.type === selectedType)
      : -1;
  const active = activeIndex >= 0 ? activeIndex : null;

  return (
    <div className="composition-row">
      <svg
        viewBox="0 0 180 180"
        width={180}
        height={180}
        role="img"
        aria-label="Composición de la cartera por tipo de instrumento"
        onMouseLeave={() => setHover(null)}
      >
        {arcs.map((a) => {
          const isSelected = selectedType === slices[a.index].type;
          const isDimmed =
            selectedType !== null && !isSelected && hover !== a.index;
          return (
            <path
              key={a.index}
              d={a.path}
              fill="none"
              stroke={`var(${slices[a.index].colorVar})`}
              strokeWidth={
                hover === a.index || isSelected
                  ? a.strokeWidth + 6
                  : a.strokeWidth
              }
              opacity={isDimmed ? 0.4 : 1}
              style={{
                transition: "stroke-width 120ms ease, opacity 120ms ease",
                cursor: clickable ? "pointer" : "default",
              }}
              onMouseEnter={() => setHover(a.index)}
              onClick={() => toggle(slices[a.index].type)}
            />
          );
        })}
        <text
          x={90}
          y={85}
          textAnchor="middle"
          fontSize={11}
          fill="var(--text-muted)"
        >
          {active !== null ? slices[active].label : "Total"}
        </text>
        <text
          x={90}
          y={104}
          textAnchor="middle"
          fontSize={15}
          fontWeight={600}
          fill="var(--text-primary)"
        >
          {active !== null
            ? `${((slices[active].value / total) * 100).toFixed(0)}%`
            : formatUSD(total)}
        </text>
      </svg>

      <div className="legend-list">
        {slices.map((s, i) => {
          const isSelected = selectedType === s.type;
          return (
            <div
              key={s.type}
              className={`legend-item${isSelected ? " legend-item-selected" : ""}`}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onClick={() => toggle(s.type)}
              style={{
                opacity:
                  selectedType === null
                    ? hover === null || hover === i
                      ? 1
                      : 0.5
                    : isSelected || hover === i
                    ? 1
                    : 0.5,
                cursor: clickable ? "pointer" : "default",
              }}
            >
              <span
                className="legend-swatch"
                style={{ background: `var(${s.colorVar})` }}
              />
              <span className="legend-name">{s.label}</span>
              <span className="legend-value">
                {formatUSD(s.value)} · {((s.value / total) * 100).toFixed(0)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
