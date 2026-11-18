/** Nativo: Expo Notifications llega en la etapa 4. */
export function pushSupported(): boolean {
  return false;
}
export async function enablePush(_auth: "anon" | "staff"): Promise<boolean> {
  return false;
}
