import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Buscador de acciones, ETFs y fondos de EE.UU. (Yahoo Finance) para usuarios
// logueados. Acciones:
//   { action: "search", q }     -> hasta 5 resultados con cotización e historia de 1 año
//   { action: "add", symbol }   -> agrega el instrumento al catálogo de la app
//   { action: "suggest", q }    -> sugerencias rápidas (símbolo, nombre, tipo), sin cotización
//   { action: "ensure", symbols } -> agrega al catálogo los que falten (valida cada uno en Yahoo)

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET");
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

const TYPE: Record<string, string> = { EQUITY: "accion", ETF: "etf", MUTUALFUND: "fondo" };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

async function chart(symbol: string, range: string, extra = "") {
  const res = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=${range}${extra}`,
    { headers: { "User-Agent": UA } }
  );
  if (!res.ok) return null;
  const r = (await res.json())?.chart?.result?.[0];
  if (!r?.meta || typeof r.meta.regularMarketPrice !== "number") return null;
  return r;
}

// Estima el dividendo anual a partir del historial: la frecuencia sale del
// intervalo típico entre pagos (mensual, trimestral, etc.) y el monto anual es
// la suma de los últimos pagos de un año "típico". Así una acción trimestral
// no queda con 3 pagos por cómo caen las fechas en la ventana de 12 meses.
function annualize(events: { t: number; a: number }[]) {
  if (!events.length) return { ttm: 0, freq: 0 };
  const nowS = Date.now() / 1000;
  const last = events[events.length - 1];
  if (nowS - last.t > 400 * 86400) return { ttm: 0, freq: 0 }; // dejó de pagar
  let freq = 1;
  if (events.length >= 2) {
    const gaps = events.slice(1).map((e, i) => (e.t - events[i].t) / 86400).filter((g) => g > 3).sort((a, b) => a - b);
    const med = gaps.length ? gaps[Math.floor(gaps.length / 2)] : 365;
    // Se ajusta a la frecuencia estándar más cercana (anual, semestral,
    // trimestral, mensual o semanal): 28 o 31 días entre pagos = mensual.
    const raw = 365 / med;
    freq = [1, 2, 4, 12, 52].reduce((best, c) => (Math.abs(Math.log(raw / c)) < Math.abs(Math.log(raw / best)) ? c : best), 1);
  }
  const lastN = events.slice(-freq);
  return { ttm: Math.round(lastN.reduce((s, e) => s + e.a, 0) * 1e6) / 1e6, freq };
}

async function chartDivs(symbol: string) {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1mo&range=2y&events=div`,
      { headers: { "User-Agent": UA } }
    );
    if (!res.ok) return null;
    return (await res.json())?.chart?.result?.[0] ?? null;
  } catch {
    return null;
  }
}

function pctFrom(base: number | undefined | null, price: number) {
  return base && base > 0 ? ((price - base) / base) * 100 : null;
}

async function detail(symbol: string, name: string, quoteType: string, exchange: string | null) {
  const [r, rd] = await Promise.all([chart(symbol, "1y"), chartDivs(symbol)]);
  if (!r) return null;
  const meta = r.meta;
  // Dividendos (montos brutos por acción/cuota), historial de 2 años.
  const divs = Object.values((rd?.events?.dividends ?? {}) as Record<string, { date: number; amount: number }>)
    .filter((d) => typeof d?.amount === "number" && d.amount > 0)
    .sort((a, b) => a.date - b.date);
  const est = annualize(divs.map((d) => ({ t: d.date, a: d.amount })));
  const lastDiv = divs[divs.length - 1];
  if ((meta.currency ?? "USD") !== "USD") return null;
  const ts: number[] = r.timestamp ?? [];
  const raw: (number | null)[] = r.indicators?.quote?.[0]?.close ?? [];
  const pts = ts
    .map((t, i) => ({ t, c: raw[i] }))
    .filter((p) => typeof p.c === "number") as { t: number; c: number }[];
  const price = meta.regularMarketPrice as number;
  const dayPct: number | null =
    typeof meta.regularMarketChangePercent === "number"
      ? meta.regularMarketChangePercent
      : pts.length >= 2
      ? pctFrom(pts[pts.length - 2].c, price)
      : null;
  const prev = dayPct != null ? price / (1 + dayPct / 100) : null;
  const now = pts.length ? pts[pts.length - 1].t : Date.now() / 1000;
  const at = (secsAgo: number) => pts.find((x) => x.t >= now - secsAgo)?.c;
  const year = new Date(now * 1000).getUTCFullYear();
  const ytdBase = [...pts].reverse().find((p) => new Date(p.t * 1000).getUTCFullYear() < year)?.c;
  const step = Math.max(1, Math.ceil(pts.length / 80));
  const closes = pts
    .filter((_, i) => i % step === 0 || i === pts.length - 1)
    .map((p) => Math.round(p.c * 100) / 100);
  return {
    symbol,
    name,
    type: TYPE[quoteType] ?? "otro",
    exchange,
    price,
    previous_close: prev,
    day_pct: dayPct,
    low52: meta.fiftyTwoWeekLow ?? (pts.length ? Math.min(...pts.map((p) => p.c)) : null),
    high52: meta.fiftyTwoWeekHigh ?? (pts.length ? Math.max(...pts.map((p) => p.c)) : null),
    chg_1m: pctFrom(at(30 * 86400), price),
    chg_ytd: pctFrom(ytdBase, price),
    chg_1y: pts.length > 200 ? pctFrom(pts[0].c, price) : null,
    closes,
    div_ttm: est.ttm,
    div_count_12m: est.freq,
    div_last_date: lastDiv ? new Date(lastDiv.date * 1000).toISOString().slice(0, 10) : null,
    div_last_amount: lastDiv ? lastDiv.amount : null,
  };
}

async function yahooSearch(q: string, count: number) {
  const res = await fetch(
    `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=${count}&newsCount=0&listsCount=0`,
    { headers: { "User-Agent": UA } }
  );
  if (!res.ok) throw new Error(`La fuente de datos respondió ${res.status}. Probá de nuevo en un rato.`);
  return ((await res.json())?.quotes ?? []) as any[];
}

async function search(q: string) {
  const quotes = await yahooSearch(q, 10);
  // Solo EE.UU.: los símbolos con punto (TSLA.TO, etc.) son de otras bolsas.
  const candidates = quotes
    .filter((x) => x?.symbol && TYPE[x.quoteType] && !String(x.symbol).includes("."))
    .slice(0, 6);
  const out = await Promise.all(
    candidates.map((x) =>
      detail(String(x.symbol), x.longname ?? x.shortname ?? x.symbol, x.quoteType, x.exchDisp ?? x.exchange ?? null).catch(
        () => null
      )
    )
  );
  return out.filter(Boolean).slice(0, 5);
}

async function suggest(q: string) {
  const quotes = await yahooSearch(q, 10);
  return quotes
    .filter((x) => x?.symbol && TYPE[x.quoteType] && !String(x.symbol).includes("."))
    .slice(0, 8)
    .map((x) => ({
      symbol: String(x.symbol),
      name: x.longname ?? x.shortname ?? x.symbol,
      type: TYPE[x.quoteType],
      exchange: x.exchDisp ?? x.exchange ?? null,
    }));
}

async function ensure(symbols: string[]) {
  const added: string[] = [];
  const existing: string[] = [];
  const failed: { symbol: string; error: string }[] = [];
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { data } = await admin.from("instruments").select("symbol").in("symbol", symbols);
  const have = new Set((data ?? []).map((d: any) => d.symbol));
  const missing = symbols.filter((s) => !have.has(s));
  existing.push(...symbols.filter((s) => have.has(s)));
  for (let i = 0; i < missing.length; i += 6) {
    await Promise.all(
      missing.slice(i, i + 6).map(async (sym) => {
        try {
          await add(sym);
          added.push(sym);
        } catch (e) {
          failed.push({ symbol: sym, error: e instanceof Error ? e.message : String(e) });
        }
      })
    );
  }
  return { added, existing, failed };
}

async function add(symbol: string) {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { data: existing } = await admin.from("instruments").select("id, symbol").eq("symbol", symbol).maybeSingle();
  if (existing) return existing;

  // Se valida contra la fuente: solo entran instrumentos reales, en USD.
  const hit = (await yahooSearch(symbol, 10)).find((x: any) => x?.symbol === symbol);
  const r = await chart(symbol, "1d");
  if (!r) throw new Error(`${symbol} no existe en Yahoo Finance.`);
  const m = r.meta;
  // Si la búsqueda no lo devuelve, el tipo sale de la cotización.
  const quoteType = hit?.quoteType ?? m.instrumentType;
  if (!TYPE[quoteType]) throw new Error(`${symbol} no es una acción, ETF ni fondo.`);
  if ((m.currency ?? "USD") !== "USD") throw new Error(`${symbol} no cotiza en dólares.`);
  const { data, error } = await admin
    .from("instruments")
    .insert({
      symbol,
      name: hit?.longname ?? hit?.shortname ?? m.longName ?? m.shortName ?? symbol,
      type: TYPE[quoteType],
      currency: "USD",
      current_price: m.regularMarketPrice,
      previous_close: m.chartPreviousClose ?? m.previousClose ?? m.regularMarketPrice,
      fifty_two_week_low: m.fiftyTwoWeekLow ?? null,
      fifty_two_week_high: m.fiftyTwoWeekHigh ?? null,
    })
    .select("id, symbol")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method !== "POST") return json({ error: "method" }, 405);

    // Usuario logueado, o llamada interna con el secreto del cron (pruebas).
    const internal = !!CRON_SECRET && req.headers.get("x-cron-secret") === CRON_SECRET;
    if (!internal) {
      const auth = req.headers.get("Authorization") ?? "";
      const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
      const {
        data: { user },
      } = await userClient.auth.getUser(auth.replace(/^Bearer\s+/i, ""));
      if (!user) return json({ error: "Tenés que iniciar sesión." }, 401);
    }

    const body = await req.json().catch(() => ({}));
    if (body.action === "search") {
      const q = String(body.q ?? "").trim().slice(0, 40);
      if (q.length < 1) return json({ results: [] });
      return json({ results: await search(q) });
    }
    if (body.action === "add") {
      const symbol = String(body.symbol ?? "").trim().toUpperCase();
      if (!/^[A-Z0-9\-]{1,12}$/.test(symbol)) return json({ error: "Símbolo inválido." }, 400);
      return json({ instrument: await add(symbol) });
    }
    if (body.action === "suggest") {
      const q = String(body.q ?? "").trim().slice(0, 40);
      if (!q) return json({ results: [] });
      return json({ results: await suggest(q) });
    }
    if (body.action === "ensure") {
      const list = Array.isArray(body.symbols) ? body.symbols : [];
      const symbols = [...new Set(list.map((x: unknown) => String(x ?? "").trim().toUpperCase()))]
        .filter((x) => /^[A-Z0-9\-]{1,12}$/.test(x as string))
        .slice(0, 80) as string[];
      return json(await ensure(symbols));
    }
    return json({ error: "Acción desconocida." }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
