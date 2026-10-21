import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TopBar from "@/components/TopBar";
import { requireAcceptedTerms } from "@/lib/terms";
import { APP_NAME } from "@/lib/brand";

export const dynamic = "force-dynamic";

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="step-block">
      <div className="step-head">
        <span className="step-number">{n}</span>
        <h3 className="step-title">{title}</h3>
      </div>
      <div className="step-body">{children}</div>
    </div>
  );
}

export default async function ComoEmpezarPage({
  searchParams,
}: {
  searchParams: Promise<{ ver?: string }>;
}) {
  const { ver } = await searchParams;
  // Las carteras de ejemplo y la de práctica ahora están en Explorar.
  if (ver === "carteras" || ver === "practica") redirect(`/explorar?ver=${ver}`);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, role, terms_version")
    .eq("id", user.id)
    .single();

  requireAcceptedTerms(profile);

  return (
    <div>
      <TopBar
        userLabel={profile?.full_name || profile?.email || user.email || ""}
        isAdmin={profile?.role === "admin"}
      />
      <div className="container">
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Cómo abrir una cuenta y empezar a invertir</h2>
          <p style={{ fontSize: 14, lineHeight: 1.6 }}>
            ReadySet Investment te ayuda a seguir cómo viene tu cartera, pero no
            es un bróker: las compras y ventas se ejecutan en una plataforma de
            trading, que es la que custodia tu dinero y tus valores. Si todavía no tenés una, acá está el camino
            completo para abrir una cuenta internacional desde Uruguay y hacer
            tu primera operación. Los pasos siguen el proceso de Charles Schwab
            International, que es una de las opciones más usadas desde la
            región.
          </p>
        </div>

        <div className="card">
          <h2 style={{ fontSize: 16, marginTop: 0 }}>Antes de arrancar: qué vas a necesitar</h2>
          <ul className="doc-list">
            <li>
              <strong>Identificación fiscal.</strong> Tu número de
              identificación fiscal del país donde residís (o número de seguro
              social, si tenés).
            </li>
            <li>
              <strong>Pasaporte escaneado.</strong> Copia digital del pasaporte
              completo, incluyendo la página con tus datos biográficos y la de
              la firma. En algunos países se aceptan otros documentos de
              identidad emitidos por el gobierno.
            </li>
            <li>
              <strong>Comprobante de domicilio.</strong> Una factura reciente de
              un servicio a tu nombre —luz, agua, gas, cable o teléfono fijo—
              donde figuren tu nombre completo, la dirección y la fecha de
              emisión. <em>Las facturas de celular no se aceptan.</em>
            </li>
            <li>
              <strong>Datos del empleador</strong> (nombre y dirección postal),
              si estás empleado.
            </li>
            <li>
              <strong>Impresora y escáner</strong>, o una app de escaneo en el
              celular, para subir la documentación en buena calidad.
            </li>
          </ul>
        </div>

        <div className="card">
          <h2 style={{ fontSize: 16, marginTop: 0 }}>El paso a paso</h2>

          <Step n={1} title="Abrir la cuenta">
            <p>
              En el sitio de Schwab International elegís tu país de residencia y
              el sistema te lleva al formulario que corresponde. La solicitud
              online lleva alrededor de <strong>15 minutos</strong>. Al final
              subís los documentos escaneados. Si te falta alguno, podés
              contactarlos antes de empezar: dan soporte en español.
            </p>
          </Step>

          <Step n={2} title="Fondear la cuenta">
            <p>
              Una vez aprobada la cuenta, el primer movimiento es transferir el
              dinero. Dentro de la plataforma se hace desde{" "}
              <strong>Transfer &amp; Pay</strong>: vinculás una cuenta bancaria
              externa y desde ahí iniciás la transferencia de fondos.
            </p>
          </Step>

          <Step n={3} title="Decidir en qué invertir">
            <p>
              Si vas por acciones, la sección <strong>Stock Lists</strong> te
              muestra compañías mejor rankeadas y te deja comparar hasta cinco
              instrumentos a la vez por rendimiento, fundamentos y calificación.
              Si preferís fondos o ETFs —lo más habitual para empezar— están las{" "}
              <strong>Select Lists</strong> y el{" "}
              <strong>Personalized Portfolio Builder</strong>, que te arma una
              propuesta según el tipo de inversión que buscás, tu perfil de
              riesgo y el monto inicial.
            </p>
            <p className="muted" style={{ fontSize: 13 }}>
              En <a href="/explorar?ver=carteras">Explorar › Carteras de
              ejemplo</a> podés ver cómo se arman algunas estrategias conocidas.
              En <a href="/mercado">Mercado</a> ves qué acciones suben en el
              día y la Cartera ReadySet, que es una referencia general, igual
              para todos, y no una recomendación para tu caso: la decisión de
              qué comprar es tuya.
            </p>
          </Step>

          <Step n={4} title="Ejecutar la operación">
            <p>
              Con la decisión tomada, vas a <strong>Trade</strong> y usás el{" "}
              <strong>All-In-One Trade Ticket</strong>. Ahí: escribís el símbolo
              del instrumento, elegís si comprás o vendés, definís si operás por
              cantidad de unidades o por monto en dólares, seleccionás el tipo
              de orden y su vigencia, y revisás el resumen antes de confirmar.
            </p>
          </Step>

          <Step n={5} title="Seguir la inversión y registrarla acá">
            <p>
              En la plataforma podés ver tus posiciones en{" "}
              <strong>Accounts &gt; Positions</strong>, con cantidad, variación
              de precio y ganancia o pérdida, además de configurar alertas de
              precio.
            </p>
            <p>
              Y el último paso, del lado de esta app: entrá a{" "}
              <a href="/dashboard?ver=operaciones">Mi cartera › Operaciones</a> y registrá la operación que acabás de
              hacer (instrumento, cantidad, precio y fecha). Con eso tu cartera,
              tu costo promedio y tu resumen de ganancias quedan actualizados
              automáticamente.
            </p>
          </Step>
        </div>

        <div className="card">
          <h2 style={{ fontSize: 16, marginTop: 0 }}>Antes de decidir</h2>
          <p style={{ fontSize: 14, lineHeight: 1.6 }}>
            Esta guía es informativa y no es una recomendación de bróker: no
            tenemos ninguna relación comercial con Schwab ni recibimos nada por
            mencionarlos. Hay otras plataformas que operan con residentes
            uruguayos y conviene comparar comisiones, monto mínimo y facilidad
            para transferir fondos desde tu banco.
          </p>
          <p style={{ fontSize: 14, lineHeight: 1.6 }}>
            Los requisitos y pasos pueden cambiar sin aviso, así que verificá
            siempre en la fuente antes de arrancar. Tené en cuenta también que
            invertir desde el exterior tiene implicancias impositivas en
            Uruguay: si el monto es relevante, consultá con un contador.
          </p>
          <p style={{ fontSize: 14, lineHeight: 1.6 }}>
            ReadySet Investment no es un intermediario de valores ni un asesor
            de inversión habilitado por el Banco Central del Uruguay. Si
            necesitás una recomendación adaptada a tu situación, consultá con un
            asesor de inversión registrado ante el BCU.
          </p>
          <p style={{ fontSize: 14, lineHeight: 1.6 }}>
            Toda inversión implica riesgo, incluida la posible pérdida del
            capital invertido. Rendimientos pasados no garantizan resultados
            futuros.
          </p>
          <p style={{ fontSize: 13, marginTop: 18 }}>
            Fuentes:{" "}
            <a
              href="https://international.schwab.com/es/como-abrir-una-cuenta"
              target="_blank"
              rel="noopener noreferrer"
            >
              Cómo abrir una cuenta (Schwab International)
            </a>{" "}
            ·{" "}
            <a
              href="https://www.schwab.com/content/how-to-start-investing-schwab"
              target="_blank"
              rel="noopener noreferrer"
            >
              How to start investing at Schwab
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
