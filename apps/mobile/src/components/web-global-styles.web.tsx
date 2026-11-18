import { useTheme } from "@abrigo/ui";
import { useEffect } from "react";

/** Foco visible y respeto por el movimiento reducido en web. */
export function WebGlobalStyles() {
  const { colors } = useTheme();
  useEffect(() => {
    const id = "abrigo-global";
    let el = document.getElementById(id) as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement("style");
      el.id = id;
      document.head.appendChild(el);
    }
    el.textContent = `
      html, body { background: ${colors.canvas}; }
      :focus-visible { outline: 3px solid ${colors.focusRing} !important; outline-offset: 2px; }
      @media (prefers-reduced-motion: reduce) {
        *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
      }
    `;
    document.documentElement.lang = "es-AR";
  }, [colors]);
  return null;
}
