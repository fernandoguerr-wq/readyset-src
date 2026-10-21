"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { searchMarket, addInstrumentFromSearch, type SearchResult } from "@/app/actions";
import { Sparkline } from "./PracticePortfolios";
import { RangeBar } from "./HoldingsTable";
import DividendSummary from "./DividendSummary";
import Note from "./Note";

const TYPE_LABEL: Record<string, string> = { accion: "Acción", etf: "ETF", fondo: "Fondo", otro: "Otro" };

function usd(v: number) {
  return v.toLocaleString("es-UY", { style: "currency", currency: "USD", maximumFractionDigits: v < 1 ? 4 : 2 });
}
function pct(v: number | null) {
  if (v == null) return "—";
  return `${v > 0.0049 ? "+" : v < -0.0049 ? "−" : ""}${Math.abs(v).toFixed(2)}%`;
}
function tone(v: number | null) {
  return v == null ? "muted" : v > 0.004 ? "delta-up" : v < -0.004 ? "delta-down" : "muted";
}

export function ResultCard({
  r,
  held,
  inModel,
}: {
  r: SearchResult;
  held: number | null;
  inModel: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // Antes de ir a otra sección, el instrumento se agrega al catálogo de la app
  // (si no estaba) para que se pueda registrar, simular o usar en práctica.
  function go(target: string, label: string) {
    setError(null);
    setBusy(label);
    startTransition(async () => {
      try {
        await addInstrumentFromSearch(r.symbol);
        router.push(target);
      } catch (e: any) {
        setError(e.message || "No se pudo continuar.");
        setBusy(null);
      }
    });
  }

  const s = encodeURIComponent(r.symbol);

  return (
    <div className="search-result">
      <div className="search-result-head">
        <div>
          <h3 className="example-title">
            {r.symbol} <span className="muted" style={{ fontSize: 13, fontWeight: 400 }}>· {TYPE_LABEL[r.type] || r.type}{r.exchange ? ` · ${r.exchange}` : ""}</span>
          </h3>
          <div className="muted" style={{ fontSize: 13 }}>{r.name}</div>
        </div>
        <div className="search-price">
          <div className="hero-value">{usd(r.price)}</div>
          <div className={tone(r.day_pct)} style={{ fontSize: 14 }}>{pct(r.day_pct)} hoy</div>
        </div>
      </div>

      {(held != null || inModel) && (
        <div className="search-tags">
          {held != null && <span className="search-tag">En tu cartera: {held.toLocaleString("es-UY", { maximumFractionDigits: 4 })} unidades</span>}
          {inModel && <span className="search-tag">Forma parte de la Cartera ReadySet</span>}
        </div>
      )}

      <div className="search-body">
        <div>
          <div className="stat-grid stat-grid-3" style={{ marginBottom: 10 }}>
            <div className="stat-tile">
              <div className="stat-label">Último mes</div>
              <div className={`stat-value ${tone(r.chg_1m)}`} style={{ fontSize: 16 }}>{pct(r.chg_1m)}</div>
            </div>
            <div className="stat-tile">
              <div className="stat-label">En el año</div>
              <div className={`stat-value ${tone(r.chg_ytd)}`} style={{ fontSize: 16 }}>{pct(r.chg_ytd)}</div>
            </div>
            <div className="stat-tile">
              <div className="stat-label">12 meses</div>
              <div className={`stat-value ${tone(r.chg_1y)}`} style={{ fontSize: 16 }}>{pct(r.chg_1y)}</div>
            </div>
          </div>
          <div className="stat-label muted" style={{ fontSize: 12, marginBottom: 4 }}>Rango de las últimas 52 semanas</div>
          <RangeBar price={r.price} low={r.low52} high={r.high52} />
        </div>
        <div>
          <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>Precio en los últimos 12 meses</div>
          <Sparkline points={r.closes} />
        </div>
      </div>

      {r.div_ttm !== undefined && (
        <DividendSummary
          price={r.price}
          divTtm={Number(r.div_ttm) || 0}
          count={r.div_count_12m ?? 0}
          lastDate={r.div_last_date ?? null}
          lastAmount={r.div_last_amount ?? null}
          units={held}
        />
      )}

      {error && <div className="error-box">{error}</div>}
      <div className="search-actions">
        <button type="button" className="secondary-btn" disabled={pending}
          onClick={() => go(`/explorar?simbolo=${s}`, "sim")}>
          {busy === "sim" ? "Abriendo…" : "Simular en mi cartera"}
        </button>
        <button type="button" className="secondary-btn" disabled={pending}
          onClick={() => go(`/explorar?ver=practica&simbolo=${s}`, "prac")}>
          {busy === "prac" ? "Abriendo…" : "Usar en una cartera de práctica"}
        </button>
        <button type="button" className="secondary-btn" disabled={pending}
          onClick={() => go(`/dashboard?ver=operaciones&simbolo=${s}`, "reg")}>
          {busy === "reg" ? "Abriendo…" : "Ya lo compré: registrarlo"}
        </button>
      </div>
    </div>
  );
}

export default function MarketSearch({
  initialQuery,
  held,
  modelSymbols,
  suggestions,
}: {
  initialQuery?: string;
  held: Record<string, number>;
  modelSymbols: string[];
  suggestions: string[];
}) {
  const [q, setQ] = useState(initialQuery || "");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const ran = useRef(false);

  function run(query: string) {
    const term = query.trim();
    if (!term) return;
    setError(null);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("ver", "buscar");
      url.searchParams.set("q", term);
      window.history.replaceState(null, "", url.toString());
    } catch {}
    startTransition(async () => {
      try {
        setResults(await searchMarket(term));
      } catch (e: any) {
        setError(e.message || "No se pudo buscar.");
        setResults(null);
      }
    });
  }

  useEffect(() => {
    if (initialQuery && !ran.current) {
      ran.current = true;
      run(initialQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery]);

  return (
    <div className="card">
      <h2>Buscar una acción, ETF o fondo</h2>
      <p className="tag-op" style={{ marginTop: -8 }}>
        Cualquier instrumento que cotice en EE.UU. en dólares, aunque no esté en
        la lista de los que más suben. Buscá por símbolo (VOO) o por nombre
        (Microsoft).
      </p>
      <form className="search-form" onSubmit={(e) => { e.preventDefault(); run(q); }}>
        <input type="search" value={q} maxLength={40} placeholder="Ej.: MSFT, Coca-Cola, S&P 500"
          aria-label="Buscar instrumento" onChange={(e) => setQ(e.target.value)} />
        <button type="submit" disabled={pending || !q.trim()}>{pending ? "Buscando…" : "Buscar"}</button>
      </form>

      {results == null && !pending && suggestions.length > 0 && (
        <div className="search-suggest">
          <span className="muted">Tus instrumentos:</span>
          {suggestions.slice(0, 8).map((s) => (
            <button key={s} type="button" className="secondary-btn" style={{ padding: "3px 10px", fontSize: 13 }}
              onClick={() => { setQ(s); run(s); }}>
              {s}
            </button>
          ))}
        </div>
      )}

      {error && <div className="error-box">{error}</div>}
      {pending && <p className="muted" style={{ fontSize: 13 }}>Buscando cotizaciones…</p>}
      {!pending && results && results.length === 0 && (
        <p className="muted" style={{ fontSize: 13 }}>
          No encontré instrumentos en dólares de EE.UU. con &quot;{q}&quot;. Probá con el símbolo exacto.
        </p>
      )}
      {!pending && results?.map((r) => (
        <ResultCard key={r.symbol} r={r} held={held[r.symbol] ?? null} inModel={modelSymbols.includes(r.symbol)} />
      ))}

      <Note more="Que un instrumento aparezca en el buscador no es una recomendación: es la misma información para todos. Rendimientos pasados no garantizan resultados futuros.">
        Datos de Yahoo Finance, con posible demora.
      </Note>
    </div>
  );
}
