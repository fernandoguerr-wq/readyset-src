import type { ModelPortfolio } from "@/components/ModelPortfolioView";

// Trae la Cartera ReadySet vigente y hasta 10 versiones anteriores.
export async function fetchModelPortfolios(supabase: any): Promise<{
  current: ModelPortfolio | null;
  previous: ModelPortfolio[];
}> {
  const { data } = await supabase
    .from("model_portfolios")
    .select(
      "id, name, comment, reference_amount, published_at, active, positions:model_positions(weight_pct, units, entry_price, instrument:instruments(symbol, name, type, current_price, previous_close, div_ttm, div_count_12m, div_last_date, div_last_amount, div_events)), history:model_history(as_of_date, value)"
    )
    .order("published_at", { ascending: false })
    .limit(11);
  const list = ((data as any[]) || []) as ModelPortfolio[];
  return {
    current: list.find((p) => p.active) || null,
    previous: list.filter((p) => !p.active).slice(0, 10),
  };
}
