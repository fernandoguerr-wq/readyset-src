import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAcceptedTerms } from "@/lib/terms";

// Usuario logueado + perfil, con términos aceptados. Uso común en las páginas.
export async function loadPageUser({ adminOnly = false }: { adminOnly?: boolean } = {}) {
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

  const isAdmin = profile?.role === "admin";
  if (adminOnly && !isAdmin) redirect("/dashboard");
  if (!adminOnly) requireAcceptedTerms(profile);

  return {
    supabase,
    user,
    profile,
    isAdmin,
    userLabel: profile?.full_name || profile?.email || user.email || "",
  };
}
