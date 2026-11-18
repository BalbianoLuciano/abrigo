import { TURNSTILE_SITE_KEY } from "./config";

interface Turnstile {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  execute: (id: string) => void;
  remove: (id: string) => void;
}

declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

let loading: Promise<void> | null = null;

function load(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("turnstile"));
    document.head.appendChild(s);
  });
  return loading;
}

/** Captcha invisible de Cloudflare. Si falla, el envío sigue (el servidor decide). */
export async function getCaptchaToken(): Promise<string | undefined> {
  if (!TURNSTILE_SITE_KEY) return undefined;
  try {
    await load();
    const ts = window.turnstile;
    if (!ts) return undefined;
    const host = document.createElement("div");
    host.style.display = "none";
    document.body.appendChild(host);
    return await new Promise<string | undefined>((resolve) => {
      const timer = setTimeout(() => resolve(undefined), 8000);
      const id = ts.render(host, {
        sitekey: TURNSTILE_SITE_KEY,
        size: "invisible",
        execution: "execute",
        callback: (token: string) => {
          clearTimeout(timer);
          resolve(token);
          ts.remove(id);
          host.remove();
        },
        "error-callback": () => {
          clearTimeout(timer);
          resolve(undefined);
        },
      });
      ts.execute(id);
    });
  } catch {
    return undefined;
  }
}
