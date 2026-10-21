import { createClient } from "@/lib/supabase/server";
import TopBar from "@/components/TopBar";
import AcceptTermsButton from "@/components/AcceptTermsButton";
import { APP_NAME, CONTACT_EMAIL, TERMS_VERSION } from "@/lib/brand";

export const dynamic = "force-dynamic";

export default async function TerminosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profile: any = null;
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("full_name, email, role, terms_version, terms_accepted_at")
      .eq("id", user.id)
      .single();
    profile = data;
  }

  const needsAcceptance = !!user && profile?.terms_version !== TERMS_VERSION;
  const version = new Date(TERMS_VERSION + "T12:00:00").toLocaleDateString("es-UY", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div>
      {user ? (
        <TopBar
          title={`${APP_NAME} — Términos`}
          userLabel={profile?.full_name || profile?.email || user.email || ""}
          isAdmin={profile?.role === "admin"}
        />
      ) : (
        <div className="topbar">
          <div className="topbar-title">{APP_NAME}</div>
          <div className="topbar-nav">
            <a href="/login">Ingresar</a>
          </div>
        </div>
      )}

      <div className="container legal-page">
        {needsAcceptance && (
          <div className="trend-notice" role="note">
            {profile?.terms_version
              ? "Actualizamos los términos y condiciones. "
              : "Antes de entrar a tu cartera, "}
            leé los términos y aceptalos al final de la página.
          </div>
        )}

        <div className="card">
          <h2 style={{ marginTop: 0 }}>Términos, condiciones y avisos legales</h2>
          <p className="muted" style={{ fontSize: 13 }}>Versión vigente desde el {version}.</p>

          <h3>1. Qué es {APP_NAME}</h3>
          <p>
            {APP_NAME} es una herramienta de <strong>seguimiento personal</strong>:
            te permite registrar las inversiones que hacés por tu cuenta en otras
            plataformas y ver cómo evoluciona su valor, con cotizaciones de
            mercado de referencia. No es una plataforma de inversión.
          </p>

          <h3>2. No somos bróker ni asesor de inversión</h3>
          <p>
            En Uruguay, quienes intermedian en la compra y venta de valores
            (corredores de bolsa y agentes de valores) y quienes asesoran a
            terceros sobre inversiones deben estar autorizados y registrados
            ante el Banco Central del Uruguay (BCU), de acuerdo con la Ley N.º
            18.627 de Mercado de Valores y su reglamentación.
          </p>
          <p>
            <strong>{APP_NAME} no está registrada ni supervisada por el BCU</strong>
            {" "}y no presta ninguno de esos servicios. En concreto:
          </p>
          <ul className="doc-list">
            <li>No ejecuta, transmite ni recibe órdenes de compra o venta.</li>
            <li>No recibe, custodia ni administra dinero ni valores de ningún usuario.</li>
            <li>
              No brinda asesoramiento de inversión personalizado: nada de lo que
              muestra la app tiene en cuenta tu situación, tus objetivos ni tu
              perfil de riesgo.
            </li>
            <li>No tiene relación comercial con ningún bróker ni cobra comisiones por operaciones.</li>
          </ul>
          <p>
            Podés verificar en el sitio del BCU (bcu.gub.uy) qué entidades y
            personas están habilitadas. Si necesitás asesoramiento adaptado a tu
            situación, consultá con un asesor de inversión registrado.
          </p>

          <h3>3. Las tendencias de mercado no son recomendaciones</h3>
          <p>
            La pestaña &quot;En alza hoy&quot; de la sección Mercado muestra las acciones de
            EE.UU. con mayor suba porcentual en la jornada, según un filtro
            público de Yahoo Finance. La lista es la misma para todos los
            usuarios, se genera automáticamente y no tiene en cuenta tu cartera,
            tus objetivos ni tu perfil de riesgo. Es información general de
            mercado: <strong>no es una invitación ni una sugerencia para comprar
            o vender</strong>. Una suba reciente no anticipa el comportamiento
            futuro de una acción. Lo mismo vale para el buscador de Mercado: muestra
            datos de cualquier instrumento que consultes y no implica que lo
            recomendemos.
          </p>

          <h3>4. La Cartera ReadySet es una referencia general</h3>
          <p>
            En Mercado se publica la &quot;Cartera ReadySet&quot;: una cartera
            de referencia que arma el Equipo ReadySet y que se muestra con su
            fecha de publicación. Es{" "}
            <strong>la misma para todos los usuarios</strong> y no se adapta a
            nadie en particular: no considera tu edad, tus ingresos, tus
            objetivos, tu horizonte ni tu tolerancia al riesgo, por lo que{" "}
            <strong>no es una recomendación para tu caso</strong> ni sustituye
            el asesoramiento de un asesor de inversión registrado ante el BCU.
          </p>
          <p>
            El rendimiento que se muestra es teórico (US$ 1.000 invertidos al
            publicarse, con precios de mercado, sin comisiones ni impuestos) y
            no garantiza resultados futuros. Las versiones anteriores quedan
            visibles con su resultado. Quienes preparan la cartera pueden tener
            en sus carteras personales los mismos instrumentos que la integran.
            Cualquier decisión de invertir es exclusivamente tuya.
          </p>

          <h3>5. La información que cargás es tuya y es informativa</h3>
          <p>
            Las operaciones y tenencias que registrás en {APP_NAME} las cargás
            vos (o el administrador, a tu pedido, mediante una importación). Esa
            información es <strong>meramente informativa</strong>, sirve solo
            para tu seguimiento personal y no tiene validez como comprobante,
            estado de cuenta ni declaración ante terceros.
          </p>
          <p>
            <strong>Cada usuario es el único responsable</strong> de la
            exactitud, integridad y actualización de la información que carga.
            El registro válido de tus operaciones es siempre el que emite tu
            bróker o entidad custodia. Si detectás un error, podés corregir o
            eliminar tus operaciones desde Mi cartera › Operaciones; los valores, costos promedio y resultados que
            muestra la app se calculan a partir de lo que cargaste y pueden no
            coincidir con los de tu bróker.
          </p>

          <h3>6. Datos de mercado de terceros</h3>
          <p>
            Las cotizaciones provienen de fuentes públicas de terceros (Yahoo
            Finance) y se actualizan aproximadamente cada 15 minutos. Pueden
            tener demoras, interrupciones o errores. Se muestran &quot;tal
            cual&quot;, sin garantía de exactitud ni de disponibilidad, y no
            deben usarse como referencia para ejecutar operaciones.
          </p>

          <h3>7. Riesgos de invertir</h3>
          <p>
            Toda inversión implica riesgo, incluida la pérdida parcial o total
            del capital. Los rendimientos pasados no garantizan resultados
            futuros. Invertir en el exterior puede implicar además riesgo
            cambiario, costos y obligaciones tributarias: consultá con un
            contador sobre tu situación particular.
          </p>

          <h3>8. Datos personales</h3>
          <p>
            Tratamos tus datos (nombre, email y la información que cargás) solo
            para prestarte el servicio, de acuerdo con la Ley N.º 18.331 de
            Protección de Datos Personales. Los datos se alojan en servidores de
            proveedores de infraestructura en la nube (Supabase y Vercel), que
            pueden estar ubicados fuera de Uruguay. No vendemos ni compartimos
            tus datos con terceros con fines comerciales. Podés pedir acceso,
            rectificación o eliminación de tus datos escribiendo a{" "}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
          </p>

          <h3>9. Seguridad de tu cuenta</h3>
          <p>
            Sos responsable de mantener la confidencialidad de tu contraseña.
            Usá una contraseña única y avisanos de inmediato si sospechás un
            acceso no autorizado.
          </p>

          <h3>10. Limitación de responsabilidad</h3>
          <p>
            En la máxima medida permitida por la ley, {APP_NAME} y sus
            responsables no son responsables por decisiones de inversión que
            tomes, ni por pérdidas derivadas del uso de la información que
            muestra la app, de errores en los datos de terceros o en los datos
            que cargaste, o de interrupciones del servicio.
          </p>

          <h3>11. Cambios y ley aplicable</h3>
          <p>
            Podemos actualizar estos términos; si hay cambios, te vamos a pedir
            que los aceptes de nuevo antes de seguir usando la app. Estos
            términos se rigen por las leyes de la República Oriental del
            Uruguay.
          </p>

          {needsAcceptance && <AcceptTermsButton version={TERMS_VERSION} />}
          {user && !needsAcceptance && profile?.terms_accepted_at && (
            <p className="muted" style={{ fontSize: 13, marginTop: 20 }}>
              Aceptaste esta versión el{" "}
              {new Date(profile.terms_accepted_at).toLocaleDateString("es-UY")}.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
