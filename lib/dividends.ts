// Dividendos: los montos de Yahoo Finance son BRUTOS. Schwab retiene el 30 %
// (retención de EE.UU. a inversores no residentes sin tratado), así que en la
// app se muestran bruto, retención y neto.
export const DIVIDEND_WITHHOLDING = 0.3;

export type DivEvent = { d: string; a: number };
export type DivInfo = {
  div_ttm?: number | null;
  div_count_12m?: number | null; // pagos por año (frecuencia estimada)
  div_last_date?: string | null;
  div_last_amount?: number | null;
  div_events?: DivEvent[] | null;
};

export function netOf(gross: number) {
  return gross * (1 - DIVIDEND_WITHHOLDING);
}

export function frequencyLabel(perYear: number | null | undefined) {
  const n = Number(perYear) || 0;
  if (n === 0) return "sin pagos recientes";
  const names: Record<number, string> = { 1: "anual", 2: "semestral", 4: "trimestral", 12: "mensual", 52: "semanal" };
  return names[n] || `${n} pagos al año`;
}

export function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d + "T12:00:00").toLocaleDateString("es-UY", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// Dividendos (brutos por unidad) con fecha ex-dividendo posterior a `since`.
export function grossSince(events: DivEvent[] | null | undefined, since: string) {
  return (events || []).filter((e) => e.d > since).reduce((s, e) => s + Number(e.a), 0);
}

export const WITHHOLDING_NOTE =
  "Neto = bruto menos la retención del 30 % que Schwab aplica a los dividendos de EE.UU. para inversores no residentes. " +
  "Es una estimación con los pagos del último año: los dividendos futuros pueden cambiar o suspenderse, " +
  "y en algunos fondos de bonos la retención real puede ser menor.";
