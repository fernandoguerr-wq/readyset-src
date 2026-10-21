import TopBar from "@/components/TopBar";
import PageTabs from "@/components/PageTabs";
import AdminClientsDashboard, { type ClientRow } from "@/components/AdminClientsDashboard";
import PortfolioImporter from "@/components/PortfolioImporter";
import AdminModelEditor from "@/components/AdminModelEditor";
import ModelPortfolioView from "@/components/ModelPortfolioView";
import type { PickOption } from "@/components/PracticePortfolios";
import { loadPageUser } from "@/lib/page-user";
import { fetchModelPortfolios } from "@/lib/model";

export const dynamic = "force-dynamic";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ ver?: string }>;
}) {
  const { ver } = await searchParams;
  const { supabase, userLabel } = await loadPageUser({ adminOnly: true });

  const [
    { data: summary, error: summaryError },
    { data: holdingsAll },
    { data: clients },
    { data: instruments },
    { data: trends },
    model,
  ] = await Promise.all([
    supabase.rpc("admin_client_summary"),
    supabase
      .from("holdings")
      .select(
        "id, user_id, quantity, avg_cost, auto_reinvest, instrument:instruments(id, symbol, name, type, currency, current_price, previous_close, fifty_two_week_low, fifty_two_week_high)"
      ),
    supabase.from("profiles").select("id, full_name, email").order("full_name"),
    supabase.from("instruments").select("symbol, name, current_price").order("symbol"),
    supabase.from("market_trends").select("symbol, name, price").order("rank"),
    fetchModelPortfolios(supabase),
  ]);

  const rows = ((summary as ClientRow[]) || []).map((r) => ({
    ...r,
    invested: Number(r.invested) || 0,
    current_value: Number(r.current_value) || 0,
    unrealized_gain: Number(r.unrealized_gain) || 0,
    day_change: Number(r.day_change) || 0,
    realized_gain: Number(r.realized_gain) || 0,
  }));

  const options: PickOption[] = [
    ...((instruments as any[]) || []).map((i) => ({
      symbol: i.symbol, name: i.name, price: Number(i.current_price) || 0, group: "catalogo" as const,
    })),
    ...((trends as any[]) || []).map((t) => ({
      symbol: t.symbol, name: t.name, price: Number(t.price) || 0, group: "tendencias" as const,
    })),
  ];

  return (
    <div>
      <TopBar userLabel={userLabel} isAdmin={true} />
      <div className="container">
        <PageTabs
          initial={ver}
          tabs={[
            {
              id: "clientes",
              label: "Clientes",
              content: (
                <>
                  {summaryError && <div className="error-box">{summaryError.message}</div>}
                  <AdminClientsDashboard clients={rows} holdings={(holdingsAll as any) || []} />
                </>
              ),
            },
            {
              id: "importar",
              label: "Importar",
              content: (
                <div className="card">
                  <h2 style={{ fontSize: 16, marginTop: 0 }}>Cargar cartera de un cliente</h2>
                  <p className="muted" style={{ fontSize: 13 }}>
                    Subí el archivo con las tenencias del cliente. Antes de cargar vas a
                    ver cómo se interpretó cada fila.
                  </p>
                  <div className="template-box">
                    <div>
                      <strong>Plantilla de la app</strong>
                      <div className="muted" style={{ fontSize: 12, lineHeight: 1.5 }}>
                        Columnas: <code>symbol</code> (ticker), <code>quantity</code> (cantidad),{" "}
                        <code>avg_cost</code> (costo promedio por unidad, en USD) y{" "}
                        <code>first_acquired_at</code> (fecha de compra AAAA-MM-DD, opcional). Usá
                        punto como separador decimal. Sirve cualquier símbolo de Yahoo Finance en
                        dólares: si no está en el catálogo de la app, se agrega solo al cargar.
                      </div>
                    </div>
                    <a className="btn template-download" href="/plantilla-cartera.csv" download="plantilla-cartera.csv">
                      Descargar plantilla (CSV)
                    </a>
                  </div>
                  <PortfolioImporter
                    clients={clients || []}
                    instruments={((instruments as any[]) || []).map((i) => ({ symbol: i.symbol, name: i.name }))}
                  />
                </div>
              ),
            },
            {
              id: "cartera-readyset",
              label: "Cartera ReadySet",
              content: (
                <>
                  <AdminModelEditor options={options} current={model.current} />
                  {model.current && (
                    <>
                      <h3 style={{ fontSize: 15, margin: "20px 0 8px" }}>Así la ven los usuarios hoy</h3>
                      <ModelPortfolioView current={model.current} previous={model.previous} />
                    </>
                  )}
                </>
              ),
            },
          ]}
        />
      </div>
    </div>
  );
}
