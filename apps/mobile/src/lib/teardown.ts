/**
 * Registro de limpiezas para la salida rápida. Los módulos pesados (socket,
 * caché) se registran solos, así la salida rápida no los importa ni los carga.
 */
const hooks = new Set<() => void>();

export function onTeardown(fn: () => void) {
  hooks.add(fn);
}

export function runTeardown() {
  for (const fn of hooks) {
    try {
      fn();
    } catch {
      // seguir limpiando
    }
  }
}
