import { BackHandler } from "react-native";
import { queryClient } from "./query";
import { runTeardown } from "./teardown";

/** Nativo: cierra la app (la pantalla de recientes se protege en la etapa 4). */
export function quickExit() {
  runTeardown();
  queryClient.clear();
  BackHandler.exitApp();
}

export function installEscapeShortcut(): () => void {
  return () => undefined;
}
