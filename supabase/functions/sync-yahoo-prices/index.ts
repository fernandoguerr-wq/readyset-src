import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Secreto leído desde los secrets de la Edge Function (Dashboard → Edge
// Functions → Secrets), nunca hardcodeado en el código.
const CRON_SECRET = Deno.env.get("CRON_SECRET");

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
const CONCURRENCY = 8;
// Dividendos: se refrescan una vez por día por instrumento, de a tandas.
const DIV_REFRESH_HOURS = 20;
const DIV_BATCH = 25;

// Ejecuta tareas de a grupos para no hacer 60 pedidos en fila (ni todos juntos).
async function inChunks<T>(items: T[], fn: (item: T) => Promise<void>) {
  for (let i = 0; i < items.length; i += CONCURRENCY) {
    await Promise.all(items.slice(i, i + CONCURRENCY).map(fn));
  }
}

async function fetchMeta(symbol: string) {
  const res = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`,
    { headers: { "User-Agent": UA } }
  );
  if (!res.ok) return { error: `http_${res.status}` } as const;
  const json = await res.json();
  const meta = json?.chart?.result?.[0]?.meta;
  if (!meta || typeof meta.regularMarketPrice !== "number") return { error: "no_data" } as const;
  return { meta } as const;
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

// Historial de dividendos de 24 meses (montos brutos por acción/cuota).
async function fetchDividends(symbol: string) {
  const res = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1mo&range=2y&events=div`,
    { headers: { "User-Agent": UA } }
  );
  if (!res.ok) return null;
  const json = await res.json();
  const divs = json?.chart?.result?.[0]?.events?.dividends ?? {};
  const events = Object.values(divs as Record<string, { date: number; amount: number }>)
    .filter((d) => typeof d?.amount === "number" && d.amount > 0 && typeof d?.date === "number")
    .sort((a, b) => a.date - b.date)
    .map((d) => ({ d: new Date(d.date * 1000).toISOString().slice(0, 10), a: Math.round(d.amount * 1e6) / 1e6 }));
  const est = annualize(events.map((e) => ({ t: Date.parse(e.d + "T12:00:00Z") / 1000, a: e.a })));
  const last = events[events.length - 1];
  return {
    div_ttm: est.ttm,
    div_count_12m: est.freq,
    div_last_date: last?.d ?? null,
    div_last_amount: last?.a ?? null,
    div_events: events,
    div_updated_at: new Date().toISOString(),
  };
}

async function syncDividends(supabase: ReturnType<typeof createClient>) {
  const cutoff = new Date(Date.now() - DIV_REFRESH_HOURS * 3600e3).toISOString();
  const { data } = await supabase
    .from("instruments")
    .select("id, symbol")
    .or(`div_updated_at.is.null,div_updated_at.lt.${cutoff}`)
    .order("div_updated_at", { ascending: true, nullsFirst: true })
    .limit(DIV_BATCH);
  const out: Record<string, string> = {};
  await inChunks(data ?? [], async (inst: any) => {
    try {
      const d = await fetchDividends(inst.symbol);
      if (!d) { out[inst.symbol] = "no_data"; return; }
      const { error } = await supabase.from("instruments").update(d).eq("id", inst.id);
      out[inst.symbol] = error ? `update_error:${error.message}` : `ok_${d.div_count_12m}`;
    } catch (e) {
      out[inst.symbol] = `error:${String(e)}`;
    }
  });
  return out;
}

// Tendencias de mercado: las acciones de EE.UU. con mayor suba porcentual del
// día según el filtro predefinido "Day Gainers" de Yahoo Finance.
async function syncMarketTrends(supabase: ReturnType<typeof createClient>) {
  const res = await fetch(
    "https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?scrIds=day_gainers&count=10",
    { headers: { "User-Agent": UA } }
  );
  if (!res.ok) return `http_${res.status}`;
  const json = await res.json();
  const quotes: any[] = json?.finance?.result?.[0]?.quotes ?? [];
  const rows = quotes
    .filter((q) => q?.symbol && typeof q.regularMarketPrice === "number" && q.quoteType === "EQUITY")
    .slice(0, 10)
    .map((q, i) => ({
      symbol: String(q.symbol),
      name: q.longName ?? q.shortName ?? q.displayName ?? q.symbol,
      exchange: q.fullExchangeName ?? q.exchange ?? null,
      currency: q.currency ?? "USD",
      price: q.regularMarketPrice,
      change: q.regularMarketChange ?? null,
      change_pct: q.regularMarketChangePercent ?? null,
      volume: typeof q.regularMarketVolume === "number" ? Math.round(q.regularMarketVolume) : null,
      market_cap: q.marketCap ?? null,
      fifty_two_week_low: q.fiftyTwoWeekLow ?? null,
      fifty_two_week_high: q.fiftyTwoWeekHigh ?? null,
      div_rate: typeof q.trailingAnnualDividendRate === "number" ? q.trailingAnnualDividendRate : null,
      div_yield: typeof q.trailingAnnualDividendYield === "number" ? q.trailingAnnualDividendYield : null,
      rank: i + 1,
      fetched_at: new Date().toISOString(),
    }));
  if (rows.length === 0) return "no_data";
  const { error: delErr } = await supabase.from("market_trends").delete().gte("rank", 0);
  if (delErr) return `delete_error:${delErr.message}`;
  const { error: insErr } = await supabase.from("market_trends").insert(rows);
  return insErr ? `insert_error:${insErr.message}` : `ok_${rows.length}`;
}

// Carteras de práctica: cotizaciones de los símbolos que NO están en el catálogo.
async function syncPracticeQuotes(supabase: ReturnType<typeof createClient>) {
  const [{ data: positions }, { data: quotes }] = await Promise.all([
    supabase.from("practice_positions").select("symbol"),
    supabase.from("practice_quotes").select("symbol"),
  ]);
  const used = new Set((positions ?? []).map((p: any) => p.symbol));
  const out: Record<string, string> = {};
  await inChunks(quotes ?? [], async (q: any) => {
    if (!used.has(q.symbol)) {
      await supabase.from("practice_quotes").delete().eq("symbol", q.symbol);
      out[q.symbol] = "removed_unused";
      return;
    }
    try {
      const r = await fetchMeta(q.symbol);
      if ("error" in r) { out[q.symbol] = r.error; return; }
      const { error } = await supabase.from("practice_quotes").update({
        price: r.meta.regularMarketPrice,
        previous_close: r.meta.chartPreviousClose ?? r.meta.previousClose ?? null,
        updated_at: new Date().toISOString(),
      }).eq("symbol", q.symbol);
      out[q.symbol] = error ? `update_error:${error.message}` : "ok";
    } catch (e) {
      out[q.symbol] = `error:${String(e)}`;
    }
  });
  return out;
}

Deno.serve(async (req: Request) => {
  try {
    if (!CRON_SECRET) {
      console.error("CRON_SECRET no está configurado como secreto de la función");
      return new Response(JSON.stringify({ error: "CRON_SECRET no configurado" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (req.headers.get("x-cron-secret") !== CRON_SECRET) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: instruments, error } = await supabase
      .from("instruments")
      .select("id, symbol, previous_close");
    if (error) throw error;

    const results: Record<string, string> = {};

    await inChunks(instruments ?? [], async (inst: any) => {
      try {
        const r = await fetchMeta(inst.symbol);
        if ("error" in r) { results[inst.symbol] = r.error; return; }
        const meta = r.meta;
        const update: Record<string, unknown> = {
          current_price: meta.regularMarketPrice,
          previous_close: meta.chartPreviousClose ?? meta.previousClose ?? inst.previous_close,
          updated_at: new Date().toISOString(),
        };
        if (typeof meta.fiftyTwoWeekLow === "number") update.fifty_two_week_low = meta.fiftyTwoWeekLow;
        if (typeof meta.fiftyTwoWeekHigh === "number") update.fifty_two_week_high = meta.fiftyTwoWeekHigh;
        const { error: updErr } = await supabase.from("instruments").update(update).eq("id", inst.id);
        results[inst.symbol] = updErr ? `update_error:${updErr.message}` : "ok";
      } catch (e) {
        results[inst.symbol] = `error:${String(e)}`;
      }
    });

    let trends = "skipped";
    try {
      trends = await syncMarketTrends(supabase);
    } catch (e) {
      trends = `error:${String(e)}`;
    }
    let practice: Record<string, string> | string = "skipped";
    try {
      practice = await syncPracticeQuotes(supabase);
    } catch (e) {
      practice = `error:${String(e)}`;
    }
    let dividends: Record<string, string> | string = "skipped";
    try {
      dividends = await syncDividends(supabase);
    } catch (e) {
      dividends = `error:${String(e)}`;
    }

    return new Response(JSON.stringify({ ok: true, results, trends, practice, dividends }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
