import TopBar from "@/components/TopBar";
import EvolutionChart from "@/components/EvolutionChart";
import TradeForm from "@/components/TradeForm";
import TradesTable from "@/components/TradesTable";
import InstallAppBanner from "@/components/InstallAppBanner";
import DashboardOverview from "@/components/DashboardOverview";
import PageTabs from "@/components/PageTabs";
import RealizedGainLoss, { type RealizedTx } from "@/components/RealizedGainLoss";
import PortfolioImporter from "@/components/PortfolioImporter";
import { loadPageUser } from "@/lib/page-user";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ ver?: string; simbolo?: string }>;
}) {
  const { ver, simbolo } = await searchParams;
  const { supabase, user, isAdmin, userLabel } = await loadPageUser();

  const [
    { data: holdings },
    { data: history },
    { data: instruments },
    { data: trades },
    { data: realized },
  ] = await Promise.all([
    supabase
      .from("holdings")
      .select(
        "id, quantity, avg_cost, auto_reinvest, instrument:instruments(id, symbol, name, type, currency, current_price, previous_close, fifty_two_week_low, fifty_two_week_high, div_ttm, div_count_12m)"
      )
      .eq("user_id", user.id),
    supabase
      .from("portfolio_value_history")
      .select("as_of_date, total_value")
      .eq("user_id", user.id)
      .order("as_of_date", { ascending: true }),
    supabase
      .from("instruments")
      .select("id, symbol, name, type, currency, current_price, previous_close")
      .order("symbol"),
    supabase
      .from("transactions")
      .select(
        "id, instrument_id, operation_type, quantity, price, amount, realized_gain, executed_at, source, locked, edited_at, instrument:instruments(symbol, name)"
      )
      .eq("user_id", user.id)
      .order("executed_at", { ascending: false })
      .limit(50),
    supabase
      .from("transactions")
      .select(
        "id, executed_at, amount, cost_basis, realized_gain, acquired_at, instrument:instruments(symbol, name)"
      )
      .eq("user_id", user.id)
      .in("operation_type", ["vender", "rescatar"])
      .not("realized_gain", "is", null)
      .order("executed_at", { ascending: true }),
  ]);

  const holdingsList = (holdings || []) as any[];
  const realizedRows: RealizedTx[] = ((realized as any[]) || []).map((r) => ({
    id: r.id,
    executed_at: r.executed_at,
    symbol: r.instrument?.symbol || "—",
    name: r.instrument?.name || "",
    amount: Number(r.amount) || 0,
    cost_basis: Number(r.cost_basis) || 0,
    realized_gain: Number(r.realized_gain) || 0,
    acquired_at: r.acquired_at,
  }));

  return (
    <div>
      <TopBar userLabel={userLabel} isAdmin={isAdmin} />
      <div className="container">
        <InstallAppBanner />
        <PageTabs
          initial={ver}
          tabs={[
            {
              id: "resumen",
              label: "Resumen",
              content: (
                <>
                  <DashboardOverview holdings={holdingsList} realizedTotal={realizedRows.reduce((a, r) => a + r.realized_gain, 0)} />
                  {holdingsList.length > 0 && (
                    <div className="card">
                      <h2>Evolución de la cartera</h2>
                      <EvolutionChart data={(history as any) || []} />
                    </div>
                  )}
                </>
              ),
            },
            {
              id: "importar",
              label: "Importar",
              content: (
                <div className="card">
                  <h2>Actualizar tu cartera con el archivo de Schwab</h2>
                  <ol className="first-steps" style={{ marginBottom: 14 }}>
                    <li>En Schwab entrá a <strong>Accounts → Positions</strong>.</li>
                    <li>Tocá <strong>Export</strong> (ícono de descarga, arriba a la derecha) y guardá el CSV.</li>
                    <li>Subilo acá. Antes de guardar vas a ver cómo se leyó cada fila.</li>
                  </ol>
                  <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
                    Hacelo una vez por mes (o después de comprar o vender) y tu cartera
                    queda al día sin cargar operaciones a mano. También sirve la{" "}
                    <a href="/plantilla-cartera.csv" download>plantilla de la app</a>.
                  </p>
                  <PortfolioImporter
                    mode="self"
                    clients={[]}
                    instruments={((instruments as any[]) || []).map((i) => ({ symbol: i.symbol, name: i.name }))}
                  />
                </div>
              ),
            },
            {
              id: "operaciones",
              label: "Operaciones",
              content: (
                <>
                  <div className="card">
                    <h2>Registrar una operación</h2>
                    <p className="tag-op" style={{ marginTop: -8 }}>
                      Cargá acá las compras y ventas que ya ejecutaste en tu plataforma de
                      trading. Tu cartera, el costo promedio y las ganancias se
                      actualizan solos.
                    </p>
                    <TradeForm
                      initialSymbol={simbolo}
                      instruments={(instruments as any) || []}
                      holdings={holdingsList.map((h) => ({
                        instrument_id: h.instrument?.id,
                        quantity: h.quantity,
                      }))}
                    />
                  </div>
                  <div className="card">
                    <h2>Mis operaciones registradas</h2>
                    <TradesTable rows={(trades as any) || []} instruments={(instruments as any) || []} />
                  </div>
                </>
              ),
            },
            {
              id: "ganancias",
              label: "Ganancias",
              content: (
                <div className="card">
                  <h2>Ganancias y pérdidas realizadas</h2>
                  <p className="tag-op" style={{ marginTop: -8 }}>
                    Se calculan a partir de tus ventas y rescates ya ejecutados. La
                    clasificación en corto/largo plazo es una estimación (largo plazo =
                    365 días o más entre la compra y la venta).
                  </p>
                  <RealizedGainLoss rows={realizedRows} />
                </div>
              ),
            },
          ]}
        />
      </div>
    </div>
  );
}
