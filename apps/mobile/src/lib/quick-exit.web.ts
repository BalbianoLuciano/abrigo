import { queryClient } from "./query";
import { runTeardown } from "./teardown";

const NEUTRAL_URL = "https://www.google.com/search?q=pron%C3%B3stico+del+tiempo";

/**
 * Salida rápida: limpia lo visible y reemplaza la entrada de la historia por un
 * sitio neutro. Como la app de la persona usa siempre `replace`, ocupa una sola
 * entrada y "atrás" no vuelve a Abrigo.
 */
export function quickExit() {
  try {
    runTeardown();
    queryClient.clear();
    document.title = "Pronóstico";
    document.body.style.visibility = "hidden";
  } finally {
    window.location.replace(NEUTRAL_URL);
  }
}

/** Escape dos veces (en menos de 1 s) = salida rápida. */
export function installEscapeShortcut(): () => void {
  let last = 0;
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== "Escape") return;
    const now = Date.now();
    if (now - last < 1000) quickExit();
    last = now;
  };
  window.addEventListener("keydown", onKey);
  return () => window.removeEventListener("keydown", onKey);
}
