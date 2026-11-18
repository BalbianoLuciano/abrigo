# 05 · Etapa 4 — Apps nativas

**Objetivo:** publicar Abrigo en Play Store y App Store con la misma base de código.

## Qué cambia respecto de la PWA

| Tema | PWA | Nativo |
|---|---|---|
| Push | Web Push (en iOS solo con la PWA instalada, iOS 16.4+) | FCM (Android) y APNs (iOS) vía Expo Notifications |
| Mapas | `@vis.gl/react-google-maps` | `react-native-maps` (proveedor Google) |
| Almacenamiento seguro | IndexedDB | SecureStore / Keychain |
| Salida rápida | Redirige a un sitio neutro | Cierra la app y vuelve al inicio del sistema; pantalla de app recientes protegida |
| Nombre e ícono discretos | Nombre del manifiesto configurable | Íconos alternativos (iOS) / activity-alias (Android), a evaluar |

## Consideraciones de tiendas

- Las apps de salud mental y crisis tienen revisiones más estrictas: deben mostrar líneas de emergencia, términos y política de privacidad visibles, y aclarar que no reemplazan atención médica.
- Declaración de datos (Google Play Data Safety / App Store Privacy Nutrition Labels) coherente con la retención real.
- Builds con EAS Build y publicación con EAS Submit; actualizaciones OTA de JS con EAS Update.

## Criterios de aceptación

- [ ] Paridad funcional con la PWA en los flujos de la etapa 1.
- [ ] Push nativo con p95 < 30 s.
- [ ] Aprobado en ambas tiendas.
