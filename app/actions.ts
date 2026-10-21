"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function updateInstrumentPrice(
  instrumentId: string,
  newPrice: number
) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_instrument_price", {
    p_instrument_id: instrumentId,
    p_new_price: newPrice,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
  revalidatePath("/dashboard");
}

export type BulkHoldingRow = {
  symbol: string;
  quantity: number;
  avg_cost: number;
  first_acquired_at?: string | null;
  auto_reinvest?: boolean;
  // Solo se usan si el símbolo todavía no está en el catálogo: con esto se
  // agrega automáticamente (por ejemplo, desde un export de Schwab).
  name?: string | null;
  type?: string | null;
  price?: number | null;
  previous_close?: number | null;
};

export async function bulkLoadPortfolio(
  clientEmail: string,
  rows: BulkHoldingRow[],
  replace = false
) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_bulk_load_portfolio", {
    p_client_email: clientEmail,
    p_holdings: rows,
    p_replace: replace,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
  revalidatePath("/dashboard");
  return data;
}

// Cada usuario carga su propia cartera (export de Schwab o plantilla).
export async function loadMyPortfolio(rows: BulkHoldingRow[], replace = false) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("load_my_portfolio", {
    p_holdings: rows.map((r) => ({
      symbol: r.symbol,
      quantity: r.quantity,
      avg_cost: r.avg_cost,
      first_acquired_at: r.first_acquired_at ?? null,
    })),
    p_replace: replace,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
  return data;
}

// El cliente registra una operación que ya ejecutó en su propia plataforma
// de trading. La app no ejecuta nada: solo lleva el registro y actualiza la
// cartera en consecuencia.
export async function recordMyTrade(input: {
  instrumentId: string;
  operationType: "comprar" | "vender";
  quantity: number;
  price: number;
  executedAt: string;
  notes?: string | null;
}) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("record_my_trade", {
    p_instrument_id: input.instrumentId,
    p_operation_type: input.operationType,
    p_quantity: input.quantity,
    p_price: input.price,
    p_executed_at: input.executedAt,
    p_notes: input.notes || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
}

// Corrige una operación que el propio cliente registró. La base recalcula la
// posición completa (cantidad, costo promedio y ganancias realizadas).
export async function updateMyTrade(input: {
  id: string;
  instrumentId: string;
  operationType: "comprar" | "vender";
  quantity: number;
  price: number;
  executedAt: string;
}) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_my_trade", {
    p_tx_id: input.id,
    p_instrument_id: input.instrumentId,
    p_operation_type: input.operationType,
    p_quantity: input.quantity,
    p_price: input.price,
    p_executed_at: input.executedAt,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
}

export async function deleteMyTrade(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_my_trade", { p_tx_id: id });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
}

export async function acceptTerms(version: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_terms", { p_version: version });
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}

// Carteras de práctica (plata ficticia): las arma el usuario y la app las
// sigue con las cotizaciones reales. No se ejecuta nada.
export async function createPracticePortfolio(input: {
  name: string;
  amount: number;
  positions: { symbol: string; weight: number }[];
}) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_practice_portfolio", {
    p_name: input.name,
    p_amount: input.amount,
    p_positions: input.positions,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/explorar");
}

export async function deletePracticePortfolio(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_practice_portfolio", { p_id: id });
  if (error) throw new Error(error.message);
  revalidatePath("/explorar");
}

// Cartera ReadySet: la publica un administrador y la ven todos los usuarios.
export async function publishModelPortfolio(input: {
  comment: string;
  positions: { symbol: string; weight: number }[];
}) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_publish_model_portfolio", {
    p_comment: input.comment,
    p_positions: input.positions,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/mercado");
  revalidatePath("/admin");
}

// Buscador de Mercado: consulta la Edge Function market-search con la sesión
// del usuario.
export type SearchResult = {
  symbol: string;
  name: string;
  type: string;
  exchange: string | null;
  price: number;
  previous_close: number | null;
  day_pct: number | null;
  low52: number | null;
  high52: number | null;
  chg_1m: number | null;
  chg_ytd: number | null;
  chg_1y: number | null;
  closes: number[];
  div_ttm?: number;
  div_count_12m?: number;
  div_last_date?: string | null;
  div_last_amount?: number | null;
};

export async function searchMarket(q: string): Promise<SearchResult[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.functions.invoke("market-search", {
    body: { action: "search", q: q.slice(0, 40) },
  });
  if (error) throw new Error("No se pudo buscar en este momento. Probá de nuevo en un rato.");
  if (data?.error) throw new Error(data.error);
  return (data?.results as SearchResult[]) || [];
}

// Agrega al catálogo un instrumento encontrado en el buscador, para poder
// registrarlo, simularlo o usarlo en una cartera de práctica.
export async function addInstrumentFromSearch(symbol: string): Promise<{ id: string; symbol: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.functions.invoke("market-search", {
    body: { action: "add", symbol },
  });
  if (error) throw new Error("No se pudo agregar el instrumento. Probá de nuevo en un rato.");
  if (data?.error) throw new Error(data.error);
  revalidatePath("/dashboard");
  revalidatePath("/explorar");
  return data.instrument;
}

// ---- Catálogo ampliado a Yahoo Finance ----
export type Suggestion = { symbol: string; name: string; type: string; exchange: string | null };

async function invokeMarket(body: Record<string, unknown>) {
  const supabase = await createClient();
  const { data, error } = await supabase.functions.invoke("market-search", { body });
  if (error) {
    // La función devuelve 400 con { error } para acciones que todavía no conoce.
    let msg = "";
    try {
      msg = (await (error as any).context?.json())?.error || "";
    } catch {}
    return { data: null, error: msg || "No se pudo consultar Yahoo Finance." };
  }
  if (data?.error) return { data: null, error: String(data.error) };
  return { data, error: null as string | null };
}

// Sugerencias rápidas para el autocompletado (símbolo + nombre).
export async function suggestInstruments(q: string): Promise<Suggestion[]> {
  const term = q.trim().slice(0, 40);
  if (!term) return [];
  const r = await invokeMarket({ action: "suggest", q: term });
  if (!r.error) return (r.data?.results as Suggestion[]) || [];
  // Compatibilidad con una versión anterior de la función: usa la búsqueda completa.
  const full = await invokeMarket({ action: "search", q: term });
  if (full.error) throw new Error(full.error);
  return ((full.data?.results as any[]) || []).map((x) => ({
    symbol: x.symbol, name: x.name, type: x.type, exchange: x.exchange,
  }));
}

// Se asegura de que los símbolos estén en el catálogo, trayéndolos de Yahoo
// Finance si hace falta. Devuelve los que no se pudieron agregar.
export async function ensureInstruments(
  symbols: string[]
): Promise<{ added: string[]; failed: { symbol: string; error: string }[] }> {
  const list = [...new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean))].slice(0, 80);
  if (!list.length) return { added: [], failed: [] };
  let result: { added: string[]; failed: { symbol: string; error: string }[] };
  const r = await invokeMarket({ action: "ensure", symbols: list });
  if (!r.error) {
    result = { added: r.data.added || [], failed: r.data.failed || [] };
  } else {
    // Compatibilidad: de a uno con la acción "add".
    result = { added: [], failed: [] };
    for (const s of list) {
      const one = await invokeMarket({ action: "add", symbol: s });
      if (one.error) result.failed.push({ symbol: s, error: one.error });
      else result.added.push(s);
    }
  }
  revalidatePath("/admin");
  revalidatePath("/dashboard");
  revalidatePath("/explorar");
  return result;
}
