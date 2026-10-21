import { APP_NAME, SHORT_DISCLAIMER } from "@/lib/brand";

export default function LegalFooter() {
  return (
    <footer className="legal-footer">
      <p>{SHORT_DISCLAIMER}</p>
      <p>
        © {new Date().getFullYear()} {APP_NAME} ·{" "}
        <a href="/terminos">Términos, condiciones y avisos legales</a>
      </p>
    </footer>
  );
}
