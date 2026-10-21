"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { APP_NAME, APP_TAGLINE } from "@/lib/brand";
import TurnstileWidget, {
  TURNSTILE_SITE_KEY,
  type TurnstileHandle,
} from "@/components/TurnstileWidget";

// Traduce los errores más comunes de Supabase Auth (vienen en inglés).
function authErrorMessage(err: { message?: string; code?: string; status?: number }) {
  const m = (err.message || "").toLowerCase();
  const code = err.code || "";
  if (err.status === 429 || code.includes("rate_limit") || m.includes("rate limit"))
    return "Hubo demasiados intentos. Esperá unos minutos y probá de nuevo.";
  if (code.includes("captcha") || m.includes("captcha"))
    return "No se pudo verificar que no sos un robot. Completá la verificación y probá de nuevo.";
  if (code === "invalid_credentials" || m.includes("invalid login credentials"))
    return "Email o contraseña incorrectos.";
  if (code === "email_not_confirmed" || m.includes("email not confirmed"))
    return "Todavía no confirmaste tu email. Revisá tu correo (y la carpeta de spam).";
  if (code === "weak_password" || m.includes("password should"))
    return "La contraseña no cumple los requisitos: al menos 10 caracteres, con mayúsculas, minúsculas y números.";
  if (code === "user_already_exists" || m.includes("already registered"))
    return "Ya existe una cuenta con ese email. Iniciá sesión.";
  return err.message || "Ocurrió un error. Probá de nuevo.";
}

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captcha = useRef<TurnstileHandle>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (TURNSTILE_SITE_KEY && !captchaToken) {
      setError("Completá la verificación de seguridad antes de continuar.");
      return;
    }
    setLoading(true);
    const captchaOpt = captchaToken ? { captchaToken } : {};

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
        options: captchaOpt,
      });
      captcha.current?.reset(); // cada token sirve para un solo intento
      setLoading(false);
      if (error) {
        setError(authErrorMessage(error));
        return;
      }
      router.replace("/");
      router.refresh();
    } else {
      if (
        password.length < 10 ||
        !/[a-z]/.test(password) ||
        !/[A-Z]/.test(password) ||
        !/[0-9]/.test(password)
      ) {
        setLoading(false);
        setError("La contraseña tiene que tener al menos 10 caracteres, con mayúsculas, minúsculas y números.");
        return;
      }
      if (!acceptedTerms) {
        setLoading(false);
        setError("Para crear la cuenta tenés que aceptar los términos y condiciones.");
        return;
      }
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName }, ...captchaOpt },
      });
      captcha.current?.reset();
      setLoading(false);
      if (error) {
        setError(authErrorMessage(error));
        return;
      }
      if (data.session) {
        // Confirmación de email desactivada: entra directo (y acepta los
        // términos en /terminos, donde queda registrada la fecha).
        router.replace("/");
        router.refresh();
        return;
      }
      setInfo(
        "Cuenta creada. Te enviamos un email para confirmar tu dirección: abrí el link y después iniciá sesión."
      );
      setMode("login");
    }
  }

  return (
    <div className="center-page">
      <div className="card auth-card">
        <h1>{APP_NAME}</h1>
        <p className="secondary" style={{ marginTop: 0, marginBottom: 16 }}>
          {APP_TAGLINE}
        </p>

        {error && <div className="error-box">{error}</div>}
        {info && (
          <div
            className="error-box"
            style={{
              background: "rgba(12,163,12,0.1)",
              borderColor: "var(--status-good)",
              color: "var(--status-good)",
            }}
          >
            {info}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {mode === "signup" && (
            <div className="field">
              <label htmlFor="fullName">Nombre completo</label>
              <input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
          )}
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="password">Contraseña</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={mode === "signup" ? 10 : undefined}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              required
            />
            {mode === "signup" && (
              <p className="muted" style={{ fontSize: 12 }}>
                Mínimo 10 caracteres, con mayúsculas, minúsculas y números. Usá
                una contraseña que no uses en otros sitios.
              </p>
            )}
          </div>
          {mode === "signup" && (
            <label className="checkbox-line" style={{ marginBottom: 14 }}>
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
              />
              <span>
                Leí y acepto los{" "}
                <a href="/terminos" target="_blank" rel="noopener noreferrer">
                  términos y condiciones
                </a>
                . Entiendo que {APP_NAME} no es un bróker ni un asesor de
                inversión.
              </span>
            </label>
          )}
          <TurnstileWidget ref={captcha} onToken={setCaptchaToken} />
          <button type="submit" disabled={loading} style={{ width: "100%" }}>
            {loading
              ? "Procesando…"
              : mode === "login"
              ? "Ingresar"
              : "Crear cuenta"}
          </button>
        </form>

        <p style={{ fontSize: 13, marginTop: 14 }}>
          {mode === "login" ? (
            <>
              ¿No tenés cuenta?{" "}
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  setError(null);
                  setInfo(null);
                  setMode("signup");
                }}
              >
                Registrate
              </a>
            </>
          ) : (
            <>
              ¿Ya tenés cuenta?{" "}
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  setError(null);
                  setInfo(null);
                  setMode("login");
                }}
              >
                Iniciá sesión
              </a>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
