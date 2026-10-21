"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { publishModelPortfolio, suggestInstruments, ensureInstruments, type Suggestion } from "@/app/actions";
import type { PickOption } from "./PracticePortfolios";
import type { ModelPortfolio } from "./ModelPortfolioView";

const MAX = 30;

type Row = { symbol: string; weight: string };
type Lookup = { state: "checking" | "yahoo" | "missing" | "unknown"; name?: string };

function parseCsv(text: string): Row[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return [];
  const sep = lines[0].includes(";") ? ";" : ",";
  const head = lines[0].toLowerCase().split(sep).map((h) => h.replace(/"/g, "").trim());
  const si = head.findIndex((h) => ["symbol", "simbolo", "símbolo", "ticker"].includes(h));
  const wi = head.findIndex((h) => ["weight", "peso", "pct", "%"].includes(h));
  const hasHeader = si >= 0 && wi >= 0;
  const s = hasHeader ? si : 0;
  const w = hasHeader ? wi : 1;
  return lines.slice(hasHeader ? 1 : 0).map((l) => {
    const c = l.split(sep).map((x) => x.replace(/"/g, "").trim());
    return { symbol: (c[s] || "").toUpperCase(), weight: (c[w] || "").replace("%", "").replace(",", ".") };
  });
}

export default function AdminModelEditor({
  options,
  current,
}: {
  options: PickOption[];
  current: ModelPortfolio | null;
}) {
  const initialRows: Row[] = current
    ? current.positions
        .filter((p) => p.instrument)
        .map((p) => ({ symbol: p.instrument!.symbol, weight: String(Number(p.weight_pct)) }))
    : [{ symbol: "", weight: "" }];
  const [rows, setRows] = useState<Row[]>(initialRows);
  const [comment, setComment] = useState(current?.comment || "");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const known = new Set(options.map((o) => o.symbol));
  const nameOf = new Map(options.map((o) => [o.symbol, o.name]));
  // Símbolos que no están en el catálogo: se verifican en Yahoo Finance.
  const [lookup, setLookup] = useState<Record<string, Lookup>>({});
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [focusQuery, setFocusQuery] = useState("");
  const lookupRef = useRef(lookup);
  lookupRef.current = lookup;

  const pendingSymbols = [...new Set(rows.map((r) => r.symbol.trim()).filter((x) => x && !known.has(x)))]
    .filter((x) => !lookup[x]).join(",");
  useEffect(() => {
    if (!pendingSymbols) return;
    const t = setTimeout(() => {
      pendingSymbols.split(",").forEach(async (sym) => {
        if (lookupRef.current[sym]) return;
        setLookup((l) => ({ ...l, [sym]: { state: "checking" } }));
        try {
          const res = await suggestInstruments(sym);
          const hit = res.find((x) => x.symbol === sym);
          setLookup((l) => ({ ...l, [sym]: hit ? { state: "yahoo", name: hit.name } : { state: "missing" } }));
        } catch {
          setLookup((l) => ({ ...l, [sym]: { state: "unknown" } }));
        }
      });
    }, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingSymbols]);

  // Autocompletado: sugerencias de Yahoo para lo que se está escribiendo (símbolo o nombre).
  useEffect(() => {
    const q = focusQuery.trim();
    if (q.length < 2) return;
    const t = setTimeout(async () => {
      try {
        setSuggestions(await suggestInstruments(q));
      } catch {}
    }, 600);
    return () => clearTimeout(t);
  }, [focusQuery]);
  const total = rows.reduce((s, r) => s + (Number(r.weight) || 0), 0);
  const filled = rows.filter((r) => r.symbol.trim());

  function update(i: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }
  function equalSplit() {
    const n = filled.length;
    if (!n) return;
    const base = Math.floor((100 / n) * 100) / 100;
    const rest = Math.round((100 - base * n) * 100) / 100;
    setRows(filled.map((r, i) => ({ ...r, weight: String(i === 0 ? Math.round((base + rest) * 100) / 100 : base) })));
  }
  async function loadCsv(file: File) {
    const parsed = parseCsv(await file.text()).filter((r) => r.symbol);
    if (!parsed.length) {
      setError("No encontré filas con símbolo y peso en el archivo.");
      return;
    }
    setError(null);
    setRows(parsed.slice(0, MAX));
  }

  function publish() {
    setError(null);
    setOk(null);
    const positions = filled.map((r) => ({ symbol: r.symbol.trim().toUpperCase(), weight: Number(r.weight) }));
    if (!positions.length) return setError("Agregá al menos un instrumento.");
    if (positions.some((p) => !(p.weight > 0))) return setError("Cada instrumento necesita un peso mayor a 0.");
    if (Math.abs(total - 100) > 0.05) return setError(`Los pesos tienen que sumar 100% (ahora suman ${total.toFixed(2)}%).`);
    if (!window.confirm("¿Publicar esta Cartera ReadySet? La van a ver todos los usuarios y reemplaza a la versión actual, que queda en el historial.")) return;
    const missing = positions.map((p) => p.symbol).filter((x) => !known.has(x));
    const notFound = missing.filter((x) => lookup[x]?.state === "missing");
    if (notFound.length) return setError(`No encontré en Yahoo Finance: ${notFound.join(", ")}. Revisá esos símbolos.`);
    startTransition(async () => {
      try {
        if (missing.length) {
          const r = await ensureInstruments(missing);
          if (r.failed.length) {
            setError("No se pudieron agregar al catálogo: " + r.failed.map((f) => `${f.symbol} (${f.error})`).join("; "));
            return;
          }
        }
        await publishModelPortfolio({ comment: comment.trim(), positions });
        setOk("Publicada. Los usuarios ya la ven en Mercado › Cartera ReadySet.");
      } catch (e: any) {
        setError(e.message || "No se pudo publicar.");
      }
    });
  }

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Publicar la Cartera ReadySet</h2>
      <p className="muted" style={{ fontSize: 13, lineHeight: 1.5 }}>
        Es una sola cartera, la misma para todos los usuarios. Al publicarla se
        congelan los precios de hoy como punto de partida (US$ 1.000 de
        referencia) y la versión anterior pasa al historial. En la app aparece
        firmada por &quot;Equipo ReadySet&quot; (no con tu nombre), con la fecha y un aviso de que no considera la situación de
        cada usuario.
      </p>
      {current && (
        <p style={{ fontSize: 13 }}>
          Versión vigente: publicada el {new Date(current.published_at).toLocaleDateString("es-UY")} con{" "}
          {current.positions.length} instrumentos. Abajo la podés editar como base de la nueva versión.
        </p>
      )}

      <div className="template-box">
        <div className="muted" style={{ fontSize: 12, lineHeight: 1.5 }}>
          Podés usar cualquier acción, ETF o fondo de Yahoo Finance que cotice en
          dólares: si no está en el catálogo de la app, se agrega solo al publicar.
          También podés subir un CSV con dos columnas: <code>symbol</code> y{" "}
          <code>weight</code> (porcentaje). Hasta {MAX} instrumentos.
        </div>
        <label className="btn template-download" style={{ cursor: "pointer" }}>
          Subir CSV
          <input type="file" accept=".csv,text/csv" hidden
            onChange={(e) => { const f = e.target.files?.[0]; if (f) loadCsv(f); e.target.value = ""; }} />
        </label>
      </div>

      <datalist id="model-symbols">
        {suggestions.filter((x) => !known.has(x.symbol)).map((x) => (
          <option key={"y" + x.symbol} value={x.symbol}>{x.name} · Yahoo</option>
        ))}
        {options.map((o) => (
          <option key={o.symbol + o.group} value={o.symbol}>{o.name}</option>
        ))}
      </datalist>

      <div className="weight-list">
        {rows.map((r, i) => (
          <div className="practice-row model-row" key={i}>
            <input list="model-symbols" placeholder="Símbolo o nombre (ej. VOO, Microsoft)" value={r.symbol}
              aria-label={`Símbolo ${i + 1}`}
              onChange={(e) => { const v = e.target.value.toUpperCase().trim(); update(i, { symbol: v }); setFocusQuery(v); }} />
            <span className="pct-input">
              <input inputMode="decimal" placeholder="%" value={r.weight} aria-label={`Peso ${i + 1}`}
                onChange={(e) => update(i, { weight: e.target.value.replace(",", ".") })} />
              %
            </span>
            <span className="practice-row-amount model-row-status">
              {!r.symbol ? "" : known.has(r.symbol) ? (
                <span className="muted" title={nameOf.get(r.symbol)}>{nameOf.get(r.symbol)}</span>
              ) : lookup[r.symbol]?.state === "yahoo" ? (
                <span className="delta-up" title={lookup[r.symbol]?.name}>✓ {lookup[r.symbol]?.name}<br /><small className="muted">se agrega de Yahoo</small></span>
              ) : lookup[r.symbol]?.state === "missing" ? (
                <span className="delta-down">No existe en Yahoo</span>
              ) : lookup[r.symbol]?.state === "unknown" ? (
                <span className="muted">Se verifica al publicar</span>
              ) : (
                <span className="muted">Buscando…</span>
              )}
            </span>
            <button type="button" className="link-btn link-btn-danger" aria-label="Quitar"
              onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((_, j) => j !== i) : [{ symbol: "", weight: "" }]))}>
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className="practice-form-actions" style={{ flexWrap: "wrap" }}>
        <button type="button" className="secondary-btn" disabled={rows.length >= MAX}
          onClick={() => setRows((rs) => [...rs, { symbol: "", weight: "" }])}>
          + Agregar instrumento
        </button>
        <button type="button" className="secondary-btn" onClick={equalSplit} disabled={!filled.length}>
          Repartir en partes iguales
        </button>
        <span className={Math.abs(total - 100) <= 0.05 ? "delta-up" : "muted"} style={{ fontSize: 14 }}>
          Total: {total.toFixed(2)}%
        </span>
      </div>

      <label htmlFor="model-comment" style={{ marginTop: 14 }}>Comentario para los usuarios (opcional)</label>
      <textarea id="model-comment" rows={3} maxLength={600} value={comment}
          placeholder="Ej.: por qué se armó así o qué cambió respecto de la versión anterior."
          onChange={(e) => setComment(e.target.value)} style={{ width: "100%" }} />

      {error && <div className="error-box">{error}</div>}
      {ok && <div className="trend-notice trend-notice-info">{ok}</div>}

      <button type="button" className="btn" onClick={publish} disabled={pending} style={{ marginTop: 12 }}>
        {pending ? "Publicando…" : "Publicar para todos los usuarios"}
      </button>
    </div>
  );
}
