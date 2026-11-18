import { request } from "./api";

export function pushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Pide permiso y registra la suscripción Web Push en el servidor. */
export async function enablePush(auth: "anon" | "staff"): Promise<boolean> {
  if (!pushSupported()) return false;
  const { key } = await request<{ key: string | null }>("GET", "/v1/push/vapid-public-key");
  if (!key) return false;
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return false;
  const registration = await navigator.serviceWorker.ready;
  const sub =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key),
    }));
  const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
  await request("POST", "/v1/push/subscriptions", {
    auth,
    body: { endpoint: json.endpoint, keys: json.keys },
  });
  return true;
}
