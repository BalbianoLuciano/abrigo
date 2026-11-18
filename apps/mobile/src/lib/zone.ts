import * as Location from "expo-location";

/**
 * Obtiene la posición y la reduce EN EL DISPOSITIVO a una celda H3 de
 * resolución 6 (~36 km²). Al servidor solo viaja el índice de la celda.
 * h3-js se carga solo cuando la persona elige compartir su zona.
 */
export async function approximateZone(): Promise<string | null> {
  const perm = await Location.requestForegroundPermissionsAsync();
  if (perm.status !== "granted") return null;
  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
  const { latLngToCell } = await import("h3-js");
  return latLngToCell(pos.coords.latitude, pos.coords.longitude, 6);
}
