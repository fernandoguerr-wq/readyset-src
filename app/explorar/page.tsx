import TopBar from "@/components/TopBar";
import PageTabs from "@/components/PageTabs";
import Simulator from "@/components/Simulator";
import ExamplePortfolios from "@/components/ExamplePortfolios";
import PracticePortfolios, { type Quote, type PickOption } from "@/components/PracticePortfolios";
import { loadPageUser } from "@/lib/page-user";

export const dynamic = "force-dynamic";

export default async function ExplorarPage({
  searchParams,
}: {
  searchParams: Promise<{ ver?: string; simbolo?: string }>;
}) {
  const { ver, simbolo } = await searchParams;
  const { supabase, user, isAdmin, userLabel } = await loadPageUser();

  const [
    { data: holdings },
    { data: instruments },
    { data: portfolios },
    { data: trends },
    { data: pquotes },
  ] = await Promise.all([
    supabase
      .from("holdings")
      .select("quantity, avg_cost, first_acquired_at, instrument:instruments(id, symbol, name, type, current_price)")
      .eq("user_id", user.id),
    supabase
      .from("instruments")
      .select("id, symbol, name, type, current_price, previous_close")
      .order("symbol"),
    supabase
      .from("practice_portfolios")
      .select("id, name, initial_amount, created_at, positions:practice_positions(symbol, name, weight_pct, units, entry_price), history:practice_history(as_of_date, value)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true }),
    supabase.from("market_trends").select("symbol, name, price").order("rank"),
    supabase.from("practice_quotes").select("symbol, price, previous_close"),
  ]);

  const quotes: Record<string, Quote> = {};
  ((pquotes as any[]) || []).forEach((q) => {
    if (q.price) quotes[q.symbol] = { price: Number(q.price), previous_close: q.previous_close != null ? Number(q.previous_close) : null };
  });
  ((instruments as any[]) || []).forEach((i) => {
    if (i.current_price) quotes[i.symbol] = { price: Number(i.current_price), previous_close: i.previous_close != null ? Number(i.previous_close) : null };
  });
  const options: PickOption[] = [
    ...((instruments as any[]) || [])
      .filter((i) => Number(i.current_price) > 0)
      .map((i) => ({ symbol: i.symbol, name: i.name, price: Number(i.current_price), group: "catalogo" as const })),
    ...((trends as any[]) || [])
      .filter((t) => Number(t.price) > 0)
      .map((t) => ({ symbol: t.symbol, name: t.name, price: Number(t.price), group: "tendencias" as const })),
  ];

  const h = (holdings as any) || [];
  const inst = (instruments as any) || [];

  return (
    <div>
      <TopBar userLabel={userLabel} isAdmin={isAdmin} />
      <div className="container">
        <PageTabs
          initial={simbolo && !ver ? "simular" : ver}
          tabs={[
            {
              id: "simular",
              label: "Simular",
              content: (
                <div className="card">
                  <Simulator mode="operacion" holdings={h} instruments={inst} initialSymbol={ver === "practica" ? undefined : simbolo} />
                </div>
              ),
            },
            {
              id: "escenarios",
              label: "Escenarios",
              content: (
                <div className="card">
                  <Simulator mode="escenarios" holdings={h} instruments={inst} />
                </div>
              ),
            },
            {
              id: "practica",
              label: "Práctica",
              content: <PracticePortfolios portfolios={(portfolios as any) || []} quotes={quotes} options={options} initialSymbol={ver === "practica" ? simbolo : undefined} />,
            },
            { id: "carteras", label: "Carteras de ejemplo", content: <ExamplePortfolios /> },
          ]}
        />
      </div>
    </div>
  );
}
