import Note from "./Note";
// Carteras de ejemplo conocidas: contenido EDUCATIVO sobre estrategias públicas
// creadas por terceros. No las arma ReadySet, no se personalizan, no nombran
// productos concretos y no muestran rendimientos como gancho.

export type Slice = { label: string; pct: number; color: string };

type Portfolio = {
  id: string;
  name: string;
  origin: string;
  idea: string;
  slices: Slice[];
  sliceNote?: string;
  goodFor: string;
  weakSpots: string[];
};

const C = {
  usStocks: "var(--cat-accion)",
  intlStocks: "var(--cat-otro)",
  bonds: "var(--cat-fondo)",
  bondsMid: "color-mix(in srgb, var(--cat-fondo) 55%, var(--card-bg))",
  cash: "var(--baseline)",
  gold: "var(--cat-bono)",
  commodities: "var(--cat-etf)",
};

const PORTFOLIOS: Portfolio[] = [
  {
    id: "6040",
    name: "Cartera 60/40",
    origin: "La cartera \"balanceada\" clásica, usada durante décadas como referencia por fondos y asesores de todo el mundo.",
    idea: "Combinar acciones, que buscan crecimiento, con bonos, que suelen amortiguar las caídas. Se rebalancea periódicamente para volver a las proporciones originales.",
    slices: [
      { label: "Acciones", pct: 60, color: C.usStocks },
      { label: "Bonos", pct: 40, color: C.bonds },
    ],
    goodFor: "Se pensó como punto medio entre crecimiento y estabilidad, para plazos largos.",
    weakSpots: [
      "Si acciones y bonos caen a la vez, la protección desaparece. Pasó en 2022, cuando las acciones de EE.UU. cayeron alrededor de 19% y los bonos alrededor de 13%: fue su peor año desde la crisis de 2008.",
      "En épocas de inflación alta los bonos pierden valor real.",
    ],
  },
  {
    id: "3fondos",
    name: "Cartera de tres fondos",
    origin: "Popularizada por Taylor Larimore y la comunidad \"Bogleheads\", basada en las ideas de John Bogle, fundador de Vanguard.",
    idea: "Tener todo el mercado con solo tres fondos indexados de bajo costo: acciones de EE.UU., acciones del resto del mundo y bonos. Simple, muy diversificada y barata de mantener.",
    slices: [
      { label: "Acciones EE.UU.", pct: 42, color: C.usStocks },
      { label: "Acciones internacionales", pct: 18, color: C.intlStocks },
      { label: "Bonos", pct: 40, color: C.bonds },
    ],
    sliceNote: "Proporciones ilustrativas: la estrategia no fija porcentajes, cada inversor los define según su plazo y tolerancia al riesgo.",
    goodFor: "Se pensó para quien quiere invertir a largo plazo sin elegir acciones individuales ni seguir el mercado día a día.",
    weakSpots: [
      "Cae junto con los mercados: no busca evitar las bajas, sino no perderse las subas a largo plazo.",
      "Elegir las proporciones es la decisión más importante y queda del lado del inversor.",
    ],
  },
  {
    id: "permanente",
    name: "Cartera permanente",
    origin: "Diseñada por Harry Browne y explicada en su libro \"Fail-Safe Investing\" (1999).",
    idea: "Partes iguales en cuatro activos, cada uno pensado para un escenario económico distinto: prosperidad (acciones), deflación (bonos largos), inflación (oro) y recesión (efectivo). Se rebalancea una vez por año.",
    slices: [
      { label: "Acciones", pct: 25, color: C.usStocks },
      { label: "Bonos de largo plazo", pct: 25, color: C.bonds },
      { label: "Oro", pct: 25, color: C.gold },
      { label: "Efectivo / letras cortas", pct: 25, color: C.cash },
    ],
    goodFor: "Se pensó para priorizar la estabilidad y caídas más moderadas, aceptando crecer menos.",
    weakSpots: [
      "En los períodos largos de suba de la bolsa suele quedar bastante por detrás de las carteras con más acciones.",
      "La mitad de la cartera (oro y efectivo) no genera intereses ni dividendos relevantes.",
    ],
  },
  {
    id: "allweather",
    name: "Cartera \"todo clima\" (All Weather)",
    origin: "Versión simplificada, divulgada por Tony Robbins en su libro \"Money: Master the Game\" (2014), de las ideas de Ray Dalio y su firma Bridgewater.",
    idea: "Repartir el riesgo para que la cartera se comporte de forma parecida con crecimiento, recesión, inflación o deflación. Por eso tiene muchos bonos y una parte en oro y materias primas.",
    slices: [
      { label: "Acciones", pct: 30, color: C.usStocks },
      { label: "Bonos de largo plazo", pct: 40, color: C.bonds },
      { label: "Bonos de plazo intermedio", pct: 15, color: C.bondsMid },
      { label: "Oro", pct: 7.5, color: C.gold },
      { label: "Materias primas", pct: 7.5, color: C.commodities },
    ],
    goodFor: "Se pensó para reducir la volatilidad y las caídas fuertes.",
    weakSpots: [
      "Depende mucho de los bonos de largo plazo, que caen fuerte cuando suben las tasas de interés, como en 2022.",
      "Con solo 30% en acciones, a largo plazo suele crecer menos.",
    ],
  },
  {
    id: "buffett",
    name: "Cartera 90/10 de Buffett",
    origin: "Warren Buffett la describió en su carta anual a los accionistas de Berkshire Hathaway de 2013, como instrucción para el fideicomiso que dejará a su esposa.",
    idea: "Casi todo en un fondo indexado de muy bajo costo del S&P 500 y un 10% en bonos del gobierno de corto plazo.",
    slices: [
      { label: "Índice S&P 500", pct: 90, color: C.usStocks },
      { label: "Bonos cortos del gobierno", pct: 10, color: C.cash },
    ],
    goodFor: "Buffett la planteó para un patrimonio grande y de muy largo plazo, no como consejo general.",
    weakSpots: [
      "Con 90% en acciones, en caídas fuertes de la bolsa (como 2008) baja casi tanto como el mercado.",
      "Solo tiene acciones de EE.UU.: no diversifica en otros países.",
    ],
  },
];

export function AllocationBar({ slices }: { slices: Slice[] }) {
  return (
    <div>
      <div className="alloc-bar" role="img"
        aria-label={slices.map((s) => `${s.label} ${s.pct}%`).join(", ")}>
        {slices.map((s) => (
          <div key={s.label} className="alloc-seg" style={{ width: `${s.pct}%`, background: s.color }} />
        ))}
      </div>
      <ul className="alloc-legend">
        {slices.map((s) => (
          <li key={s.label}>
            <i style={{ background: s.color }} />
            {s.label} <strong>{s.pct.toLocaleString("es-UY")}%</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function ExamplePortfolios() {
  return (
    <div>
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Carteras de ejemplo conocidas</h2>
        <p style={{ fontSize: 14, lineHeight: 1.6 }}>
          Estas son algunas estrategias famosas y públicas, creadas por
          inversores y autores reconocidos. Te las mostramos para que entiendas
          cómo se piensa una cartera: cómo se reparte entre distintos tipos de
          activos, para qué se diseñó cada una y en qué situaciones les fue mal.
        </p>
        <Note tone="warn" more="No las armamos nosotros, no tienen en cuenta tu situación y no hay una &quot;mejor&quot;. Cuál tiene sentido depende del plazo, los ingresos, los objetivos y cuánta caída puede tolerar cada persona. Antes de decidir, informate o consultá a un asesor habilitado por el BCU.">
          <strong>Son ejemplos educativos,</strong> no recomendaciones.
        </Note>
      </div>

      {PORTFOLIOS.map((p) => (
        <div key={p.id} className="card example-portfolio">
          <h3 className="example-title">{p.name}</h3>
          <p className="muted example-origin">{p.origin}</p>
          <p className="example-idea">{p.idea}</p>
          <AllocationBar slices={p.slices} />
          {p.sliceNote && <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>{p.sliceNote}</p>}
          <div className="example-cols">
            <div>
              <div className="example-label">Para qué se pensó</div>
              <p>{p.goodFor}</p>
            </div>
            <div>
              <div className="example-label">Puntos débiles</div>
              <ul>
                {p.weakSpots.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ))}

      <div className="card">
        <h2 style={{ fontSize: 16, marginTop: 0 }}>Antes de decidir</h2>
        <ul className="doc-list">
          <li>
            Estas carteras se describen por <strong>tipo de activo</strong>. Se
            pueden armar de muchas maneras (fondos indexados, ETFs u otros
            instrumentos), con costos e impuestos distintos. No nombramos
            productos a propósito.
          </li>
          <li>
            Todas se <strong>rebalancean</strong>: cada cierto tiempo se vuelve a
            las proporciones originales, vendiendo lo que subió y comprando lo que
            bajó.
          </li>
          <li>
            Los resultados pasados no garantizan resultados futuros. Toda
            inversión implica riesgo, incluida la pérdida del capital.
          </li>
          <li>
            Invertir desde Uruguay en el exterior tiene implicancias impositivas.
            Si el monto es relevante, consultá con un contador.
          </li>
        </ul>
        <p className="muted" style={{ fontSize: 12, marginTop: 14, lineHeight: 1.6 }}>
          Fuentes:{" "}
          <a href="https://www.morningstar.com/portfolios/why-naysayers-were-wrong-6040-portfolio" target="_blank" rel="noopener noreferrer">Morningstar (60/40 en 2022)</a>{" · "}
          <a href="https://www.bogleheads.org/wiki/Three-fund_portfolio" target="_blank" rel="noopener noreferrer">Bogleheads (tres fondos)</a>{" · "}
          <a href="https://en.wikipedia.org/wiki/Fail-Safe_Investing" target="_blank" rel="noopener noreferrer">Fail-Safe Investing (cartera permanente)</a>{" · "}
          <a href="https://www.optimizedportfolio.com/all-weather-portfolio/" target="_blank" rel="noopener noreferrer">All Weather</a>{" · "}
          <a href="https://www.berkshirehathaway.com/letters/2013ltr.pdf" target="_blank" rel="noopener noreferrer">Carta de Berkshire Hathaway 2013</a>.

        </p>
      </div>
    </div>
  );
}
