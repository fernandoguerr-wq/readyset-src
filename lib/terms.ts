import { redirect } from "next/navigation";
import { TERMS_VERSION } from "@/lib/brand";

// Si el usuario no aceptó la versión vigente de los términos, lo manda a
// /terminos antes de mostrarle su cartera.
export function requireAcceptedTerms(profile: { terms_version?: string | null } | null) {
  if (!profile || profile.terms_version !== TERMS_VERSION) {
    redirect("/terminos?aceptar=1");
  }
}
