// Aviso compacto: una línea visible y el detalle desplegable ("Más info").
// Reemplaza los párrafos legales repetidos en cada tarjeta; el aviso general
// (no somos bróker ni asesor) ya está al pie de todas las páginas.
export default function Note({
  children,
  more,
  tone = "plain",
}: {
  children: React.ReactNode;
  more?: React.ReactNode;
  tone?: "plain" | "info" | "warn";
}) {
  return (
    <div className={`note note-${tone}`} role="note">
      <span className="note-icon" aria-hidden="true">ⓘ</span>
      <div className="note-body">
        <div>{children}</div>
        {more && (
          <details className="note-more">
            <summary>Más info</summary>
            <div className="note-more-body">
              {more}{" "}
              <a href="/terminos">Ver avisos legales</a>.
            </div>
          </details>
        )}
      </div>
    </div>
  );
}
