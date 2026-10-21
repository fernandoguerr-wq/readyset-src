"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { bulkLoadPortfolio, loadMyPortfolio, ensureInstruments, type BulkHoldingRow } from "@/app/actions";

type Client = { id: string; full_name: string | null; email: string | null };
type InstrumentInfo = { symbol: string; name: string };

const EXPECTED_HEADERS = ["symbol", "quantity", "avg_cost", "first_acquired_at"];

type RowStatus = "ok" | "new" | "skip" | "error";
type ParsedRow = BulkHoldingRow & { _line: number; _status: RowStatus; _note?: string; _value?: number | null };
type ParseResult = {
  rows: ParsedRow[];
  headerError: string | null;
  format: "plantilla" | "schwab" | null;
  asOf: string | null;
  cash: number | null;
};

// "$1,234.56" / "-$82.23" / "0.62%" / "--" -> número (o NaN)
function num(v: string | undefined): number {
  if (v == null) return NaN;
  const t = v.trim().replace(/[$,%\s]/g, "");
  if (t === "" || t === "--" || t.toUpperCase() === "N/A") return NaN;
  return Number(t);
}

const SCHWAB_TYPES: Record<string, string> = {
  equity: "accion",
  "etfs & closed end funds": "etf",
  "mutual funds": "fondo",
  "fixed income": "bono",
};

// Parser CSV chico y sin dependencias externas: soporta campos entre comillas,
// comas dentro de comillas, comillas escapadas ("") y finales de línea \r\n o \n.
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((v) => v.trim() !== "")) rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    if (row.some((v) => v.trim() !== "")) rows.push(row);
  }
  return rows;
}

function toRows(text: string, validSymbols: Set<string>): ParseResult {
  const table = parseCsv(text.replace(/^\uFEFF/, ""));
  const empty: ParseResult = { rows: [], headerError: null, format: null, asOf: null, cash: null };
  if (table.length === 0) return { ...empty, headerError: "El archivo está vacío." };

  // ---- Formato 1: export de posiciones de Charles Schwab ----
  const schwabIdx = table.findIndex((r) => {
    const h = r.map((c) => c.trim().toLowerCase());
    return h[0] === "symbol" && h.some((c) => c.startsWith("qty")) && h.some((c) => c.startsWith("cost basis"));
  });
  if (schwabIdx >= 0) {
    const header = table[schwabIdx].map((h) => h.trim().toLowerCase());
    const col = (prefix: string) => header.findIndex((h) => h.startsWith(prefix));
    const iSym = 0, iDesc = col("description"), iQty = col("qty"), iPrice = col("price");
    const iChg = col("price chng $"), iCost = col("cost basis"), iType = col("asset type"), iVal = col("mkt val");
    const titleMatch = (table[0][0] || "").match(/as of .*?(\d{4})\/(\d{2})\/(\d{2})/i);
    const asOf = titleMatch ? `${titleMatch[3]}/${titleMatch[2]}/${titleMatch[1]}` : null;
    let cash: number | null = null;

    const rows: ParsedRow[] = [];
    table.slice(schwabIdx + 1).forEach((cols, i) => {
      const line = schwabIdx + i + 2;
      const raw = (cols[iSym] || "").trim();
      const low = raw.toLowerCase();
      if (!raw) return;
      if (low.startsWith("positions total")) return;
      if (low.startsWith("cash")) {
        cash = num(cols[iVal]);
        rows.push({ symbol: raw, quantity: NaN, avg_cost: NaN, _line: line, _status: "skip",
          _note: "Efectivo: no se carga (la app sigue solo instrumentos)", _value: Number.isFinite(cash) ? cash : null });
        return;
      }
      const symbol = raw.toUpperCase();
      const qty = num(cols[iQty]);
      const costBasis = num(cols[iCost]);
      const price = num(cols[iPrice]);
      const chg = num(cols[iChg]);
      const avg = Number.isFinite(qty) && qty > 0 && Number.isFinite(costBasis) ? costBasis / qty : NaN;
      const type = SCHWAB_TYPES[(cols[iType] || "").trim().toLowerCase()] || "otro";
      let status: RowStatus = "ok";
      let note: string | undefined;
      if (!Number.isFinite(qty) || qty <= 0) { status = "error"; note = "Cantidad inválida"; }
      else if (!Number.isFinite(avg) || avg < 0) { status = "error"; note = "Sin costo (Cost Basis)"; }
      else if (!validSymbols.has(symbol)) {
        if (Number.isFinite(price) && price > 0) { status = "new"; note = "se agrega al catálogo"; }
        else { status = "new"; note = "se trae de Yahoo Finance al cargar"; }
      }
      rows.push({
        symbol,
        quantity: qty,
        avg_cost: Number.isFinite(avg) ? Math.round(avg * 10000) / 10000 : NaN,
        first_acquired_at: null,
        name: (cols[iDesc] || "").trim() || null,
        type,
        price: Number.isFinite(price) ? price : null,
        previous_close: Number.isFinite(price) && Number.isFinite(chg) ? Math.round((price - chg) * 10000) / 10000 : null,
        _line: line,
        _status: status,
        _note: note,
        _value: num(cols[iVal]),
      });
    });
    return { rows, headerError: null, format: "schwab", asOf, cash };
  }

  // ---- Formato 2: plantilla de la app ----
  const header = table[0].map((h) => h.trim().toLowerCase());
  const missing = EXPECTED_HEADERS.filter((h) => h !== "first_acquired_at" && !header.includes(h));
  if (missing.length > 0) {
    return {
      ...empty,
      headerError: `No reconozco el formato. Se acepta el export de posiciones de Charles Schwab ("Positions" → Export) o la plantilla de la app con las columnas: ${EXPECTED_HEADERS.join(", ")}.`,
    };
  }
  const idx = (name: string) => header.indexOf(name);
  const iSymbol = idx("symbol"), iQty = idx("quantity"), iCost = idx("avg_cost"), iDate = idx("first_acquired_at");
  const rows: ParsedRow[] = table.slice(1).map((cols, i) => {
    const symbol = (cols[iSymbol] || "").trim().toUpperCase();
    const quantity = Number((cols[iQty] || "").trim().replace(",", "."));
    const avg_cost = Number((cols[iCost] || "").trim().replace(",", "."));
    const dateRaw = iDate >= 0 ? (cols[iDate] || "").trim() : "";
    let status: RowStatus = "ok";
    let note: string | undefined;
    if (!symbol) { status = "error"; note = "Falta el símbolo"; }
    else if (!Number.isFinite(quantity) || quantity <= 0) { status = "error"; note = "Cantidad inválida"; }
    else if (!Number.isFinite(avg_cost) || avg_cost < 0) { status = "error"; note = "Costo promedio inválido"; }
    else if (!validSymbols.has(symbol)) { status = "new"; note = "se trae de Yahoo Finance al cargar"; }
    return { symbol, quantity, avg_cost, first_acquired_at: dateRaw || null, _line: i + 2, _status: status, _note: note };
  });
  return { rows, headerError: null, format: "plantilla", asOf: null, cash: null };
}

function usd(v: number) {
  return v.toLocaleString("es-UY", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}

const STATUS_LABEL: Record<RowStatus, string> = { ok: "OK", new: "Nuevo", skip: "Se omite", error: "Error" };
const STATUS_CLASS: Record<RowStatus, string> = { ok: "delta-up", new: "status-new", skip: "muted", error: "delta-down" };

export default function PortfolioImporter({
  clients,
  instruments,
  mode = "admin",
}: {
  clients: Client[];
  instruments: InstrumentInfo[];
  // "self": el usuario carga su propia cartera (sin elegir cliente).
  mode?: "admin" | "self";
}) {
  const self = mode === "self";
  const [email, setEmail] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [replace, setReplace] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const validSymbols = useMemo(
    () => new Set(instruments.map((i) => i.symbol.toUpperCase())),
    [instruments]
  );

  const rows = parsed?.rows ?? [];
  const loadable = rows.filter((r) => r._status === "ok" || r._status === "new");
  const errors = rows.filter((r) => r._status === "error");
  const newOnes = rows.filter((r) => r._status === "new");
  const totalValue = loadable.reduce((s, r) => s + (Number.isFinite(r._value ?? NaN) ? (r._value as number) : 0), 0);
  const totalCost = loadable.reduce((s, r) => s + r.quantity * r.avg_cost, 0);

  function handleFile(file: File) {
    setSuccess(null);
    setSubmitError(null);
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const result = toRows(String(reader.result || ""), validSymbols);
      if (result.headerError) {
        setParseError(result.headerError);
        setParsed(null);
      } else {
        setParseError(null);
        setParsed(result);
        // Un export de Schwab es la foto completa de la cuenta.
        setReplace(result.format === "schwab");
      }
    };
    reader.onerror = () => setParseError("No se pudo leer el archivo.");
    reader.readAsText(file, "utf-8");
  }

  function handleSubmit() {
    setSubmitError(null);
    setSuccess(null);
    if (!self && !email.trim()) return setSubmitError("Elegí o escribí el email del cliente.");
    if (loadable.length === 0) return setSubmitError("El archivo no tiene filas para cargar.");
    if (errors.length > 0) return setSubmitError("Hay filas con error (en rojo). Corregilas en el archivo y volvé a subirlo.");

    startTransition(async () => {
      try {
        // Instrumentos que no están en el catálogo y no traen precio en el
        // archivo (plantilla): se validan y agregan desde Yahoo Finance.
        // En modo "self" todos los nuevos se validan en Yahoo (el usuario no
        // puede crear instrumentos con datos del archivo).
        const fromYahoo = newOnes.filter((r) => self || !(Number(r.price) > 0)).map((r) => r.symbol);
        if (fromYahoo.length) {
          const ens = await ensureInstruments(fromYahoo);
          if (ens.failed.length) {
            setSubmitError(
              "No encontré en Yahoo Finance: " + ens.failed.map((f) => `${f.symbol} (${f.error})`).join("; ") +
                ". Corregí esos símbolos y volvé a subir el archivo."
            );
            return;
          }
        }
        const payload: BulkHoldingRow[] = loadable.map((r) => ({
          symbol: r.symbol,
          quantity: r.quantity,
          avg_cost: r.avg_cost,
          first_acquired_at: r.first_acquired_at ?? null,
          name: r.name ?? null,
          type: r.type ?? null,
          price: r.price ?? null,
          previous_close: r.previous_close ?? null,
        }));
        const result = self
          ? await loadMyPortfolio(payload, replace)
          : await bulkLoadPortfolio(email.trim(), payload, replace);
        setSuccess(
          `Listo: se cargaron ${payload.length} tenencias${self ? "" : ` para ${email.trim()}`}` +
            (newOnes.length ? ` y se agregaron ${newOnes.length} instrumentos nuevos al catálogo` : "") +
            `. La cartera quedó con ${Array.isArray(result) ? result.length : "?"} instrumentos.`
        );
        setParsed(null);
        setFileName(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      } catch (e: any) {
        setSubmitError(e.message || "No se pudo cargar la cartera.");
      }
    });
  }

  return (
    <div>
      {!self && (
      <div className="field" style={{ maxWidth: 420 }}>
        <label htmlFor="client-email">Cliente</label>
        <input
          id="client-email"
          type="email"
          list="client-emails"
          placeholder="Escribí o elegí el email del cliente"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <datalist id="client-emails">
          {clients.map((c) => (
            <option key={c.id} value={c.email || ""}>
              {c.full_name}
            </option>
          ))}
        </datalist>
        <p className="muted" style={{ fontSize: 12 }}>
          Tiene que ser el email con el que el cliente ya se registró en la app.
        </p>
      </div>
      )}

      <div className="field" style={{ marginTop: 16 }}>
        <label htmlFor="csv-file">Archivo CSV</label>
        <input id="csv-file" ref={fileInputRef} type="file" accept=".csv,text/csv"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        <p className="muted" style={{ fontSize: 12 }}>
          Acepta el export de posiciones de <strong>Charles Schwab</strong> (Accounts → Positions → Export) tal
          cual se descarga, o la plantilla de la app (symbol, quantity, avg_cost, first_acquired_at).
        </p>
      </div>

      {parseError && <div className="error-box">{parseError}</div>}
      {submitError && <div className="error-box">{submitError}</div>}
      {success && (
        <div className="error-box" style={{ background: "rgba(12,163,12,0.1)", borderColor: "var(--status-good)", color: "var(--status-good)" }}>
          {success}
        </div>
      )}

      {parsed && (
        <div className="import-summary">
          <div className="import-summary-title">
            {fileName}
            {parsed.format === "schwab" ? " · export de Schwab" : " · plantilla de la app"}
            {parsed.asOf ? ` · posiciones al ${parsed.asOf}` : ""}
          </div>
          <div className="stat-grid stat-grid-3" style={{ marginBottom: 8 }}>
            <div className="stat-tile">
              <div className="stat-label">Tenencias a cargar</div>
              <div className="stat-value">{loadable.length}</div>
            </div>
            <div className="stat-tile">
              <div className="stat-label">Instrumentos nuevos en el catálogo</div>
              <div className="stat-value">{newOnes.length}</div>
            </div>
            <div className="stat-tile">
              <div className="stat-label">Filas con error</div>
              <div className={`stat-value ${errors.length ? "delta-down" : ""}`}>{errors.length}</div>
            </div>
          </div>
          <p className="muted" style={{ fontSize: 13, margin: "0 0 10px" }}>
            Costo total {usd(totalCost)}
            {parsed.format === "schwab" && totalValue > 0 && ` · valor de mercado según el archivo ${usd(totalValue)}`}
            {parsed.cash != null && Number.isFinite(parsed.cash) && ` · el efectivo (${usd(parsed.cash)}) no se carga`}.
            {parsed.format === "schwab" &&
              " El archivo no trae fechas de compra: si el instrumento ya estaba en la cartera se conserva la fecha anterior; si no, queda sin fecha."}
          </p>
          <label className="checkbox-line" style={{ marginBottom: 12 }}>
            <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
            <span>
              <strong>Reemplazar la cartera completa.</strong> Lo que {self ? "tengas" : "el cliente tenga"} cargado y no esté en este
              archivo queda en cero. Destildalo para solo agregar o actualizar los instrumentos del archivo.
            </span>
          </label>
        </div>
      )}

      {rows.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table className="rtable">
            <thead>
              <tr>
                <th>Símbolo</th>
                <th className="right">Cantidad</th>
                <th className="right">Costo prom.</th>
                <th className="right">Costo total</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r._line} style={r._status === "error" ? { background: "rgba(217,69,61,0.08)" } : undefined}>
                  <td data-label="Símbolo">
                    {r.symbol || "—"}
                    {r.name && <div className="muted" style={{ fontSize: 12, fontWeight: 400 }}>{r.name}</div>}
                  </td>
                  <td data-label="Cantidad" className="right">{Number.isFinite(r.quantity) ? r.quantity.toLocaleString("es-UY", { maximumFractionDigits: 6 }) : "—"}</td>
                  <td data-label="Costo prom." className="right">{Number.isFinite(r.avg_cost) ? usd(r.avg_cost) : "—"}</td>
                  <td data-label="Costo total" className="right">
                    {Number.isFinite(r.avg_cost) && Number.isFinite(r.quantity) ? usd(r.avg_cost * r.quantity) : "—"}
                  </td>
                  <td data-label="Estado" className={STATUS_CLASS[r._status]} style={{ fontSize: 12 }}>
                    {STATUS_LABEL[r._status]}
                    {r._note && r._status !== "ok" && <div style={{ fontSize: 12 }}>{r._note}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <button type="button" onClick={handleSubmit} disabled={pending || loadable.length === 0} style={{ marginTop: 16 }}>
        {pending ? "Cargando…" : `Cargar cartera${loadable.length ? ` (${loadable.length} tenencias)` : ""}`}
      </button>
    </div>
  );
}
