import * as Location from "expo-location";

export interface Coverage {
  circle: { lat: number; lng: number; radiusKm: number } | null;
  regionCodes: string[];
  acceptsRemoteAnywhere: boolean;
}

export interface NotificationPrefs {
  webPush: boolean;
  email: boolean;
  telegram: boolean;
  quietStartMin: number | null;
  quietEndMin: number | null;
  telegramLinked: boolean;
  telegramAvailable: boolean;
}

/**
 * Centro de la zona de cobertura del ayudante. Se redondea a ~1 km: alcanza
 * para saber qué recursos conoce y no expone su domicilio.
 */
export async function coverageCenter(): Promise<{ lat: number; lng: number } | null> {
  const perm = await Location.requestForegroundPermissionsAsync();
  if (perm.status !== "granted") return null;
  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  const round = (n: number) => Math.round(n * 100) / 100;
  return { lat: round(pos.coords.latitude), lng: round(pos.coords.longitude) };
}

export function formatMinute(min: number) {
  const h = String(Math.floor(min / 60)).padStart(2, "0");
  const m = String(min % 60).padStart(2, "0");
  return `${h}:${m}`;
}

/** Vuelve al panel sin dejar una copia del panel debajo en el stack. */
export async function backToDashboard() {
  const { router } = await import("expo-router");
  if (router.canGoBack()) router.back();
  else router.replace("/ayudante");
}
