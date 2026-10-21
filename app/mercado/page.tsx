import { redirect } from "next/navigation";
import TopBar from "@/components/TopBar";
import PageTabs from "@/components/PageTabs";
import MarketTrends from "@/components/MarketTrends";
import MarketSearch from "@/components/MarketSearch";
import ModelPortfolioView from "@/components/ModelPortfolioView";
import { loadPageUser } from "@/lib/page-user";
import { fetchModelPortfolios } from "@/lib/model";

export const dynamic = "force-dynamic";

export default async function MercadoPage({
  searchParams,
}: {
  searchParams: Promise<{ ver?: string; q?: string }>;
}) {
  const { ver, q } = await searchParams;
  // "Mis inversiones hoy" se integró en Mi cartera (columna "Hoy").
  if (ver === "mis-inversiones") redirect("/dashboard");

  const { supabase, user, isAdmin, userLabel } = await loadPageUser();

  const [{ data: trends }, { data: holdings }, model] = await Promise.all([
    supabase
      .from("market_trends")
      .select("symbol, name, exchange, price, change, change_pct, volume, market_cap, div_rate, div_yield, rank, fetched_at")
      .order("rank", { ascending: true })
      .limit(10),
    supabase
      .from("holdings")
      .select("quantity, instrument:instruments(symbol)")
      .eq("user_id", user.id)
      .gt("quantity", 0),
    fetchModelPortfolios(supabase),
  ]);

  const held: Record<string, number> = {};
  ((holdings as any[]) || []).forEach((h) => {
    if (h.instrument?.symbol) held[h.instrument.symbol] = Number(h.quantity);
  });
  const modelSymbols = (model.current?.positions || [])
    .map((p) => p.instrument?.symbol)
    .filter(Boolean) as string[];

  return (
    <div>
      <TopBar userLabel={userLabel} isAdmin={isAdmin} />
      <div className="container">
        <PageTabs
          initial={ver || (q ? "buscar" : undefined)}
          tabs={[
            {
              id: "en-alza",
              label: "En alza hoy",
              content: (
                <div className="card">
                  <h2>En alza en el mercado</h2>
                  <p className="tag-op" style={{ marginTop: -8 }}>
                    Las acciones de EE.UU. que más suben hoy, la misma lista para todos.
                    Tocá un símbolo para ver cómo le fue en el último año. Para ver cómo
                    se mueven hoy tus propias inversiones, andá a{" "}
                    <a href="/dashboard">Mi cartera</a>.
                  </p>
                  <MarketTrends rows={(trends as any) || []} />
                </div>
              ),
            },
            {
              id: "buscar",
              label: "Buscar",
              content: (
                <MarketSearch
                  initialQuery={q}
                  held={held}
                  modelSymbols={modelSymbols}
                  suggestions={Object.keys(held).sort()}
                />
              ),
            },
            {
              id: "cartera-readyset",
              label: "Cartera ReadySet",
              content: <ModelPortfolioView current={model.current} previous={model.previous} />,
            },
          ]}
        />
      </div>
    </div>
  );
}
