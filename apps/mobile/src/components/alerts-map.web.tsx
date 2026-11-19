import { useTheme } from "@abrigo/ui";
import { createElement, useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { GOOGLE_MAPS_KEY } from "@/lib/config";
import type { AlertsMapProps } from "./alerts-map.types";

/* Tipos mínimos de la Maps JavaScript API que usamos (se carga en runtime). */
interface GLatLng {
  lat: number;
  lng: number;
}
interface GOverlay {
  setMap(map: unknown): void;
  addListener(event: string, fn: () => void): void;
  setOptions(opts: Record<string, unknown>): void;
}
interface GMaps {
  Map: new (
    el: HTMLElement,
    opts: Record<string, unknown>,
  ) => {
    fitBounds(b: unknown, padding?: number): void;
  };
  Polygon: new (opts: Record<string, unknown>) => GOverlay;
  Circle: new (opts: Record<string, unknown>) => GOverlay;
  LatLngBounds: new () => { extend(p: GLatLng): void; isEmpty(): boolean };
}

let loading: Promise<GMaps> | null = null;

function loadMaps(): Promise<GMaps> {
  const w = window as unknown as { google?: { maps: GMaps }; __abrigoMaps?: () => void };
  if (w.google?.maps) return Promise.resolve(w.google.maps);
  loading ??= new Promise((resolve, reject) => {
    w.__abrigoMaps = () => resolve(w.google!.maps);
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_MAPS_KEY)}&v=weekly&loading=async&callback=__abrigoMaps&language=es&region=AR`;
    s.async = true;
    s.onerror = () => reject(new Error("maps"));
    document.head.appendChild(s);
  });
  return loading;
}

/** Estilo propio: tonos de DESIGN.md, sin comercios ni transporte. */
function mapStyles(c: ReturnType<typeof useTheme>["colors"]) {
  return [
    { elementType: "geometry", stylers: [{ color: c.surfaceSunk }] },
    { elementType: "labels.text.fill", stylers: [{ color: c.inkSoft }] },
    { elementType: "labels.text.stroke", stylers: [{ color: c.canvas }] },
    { featureType: "poi", stylers: [{ visibility: "off" }] },
    { featureType: "transit", stylers: [{ visibility: "off" }] },
    { featureType: "road", elementType: "geometry", stylers: [{ color: c.surface }] },
    { featureType: "road", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
    { featureType: "water", elementType: "geometry", stylers: [{ color: c.volAir }] },
    {
      featureType: "administrative",
      elementType: "geometry.stroke",
      stylers: [{ color: c.hairline }],
    },
  ];
}

/**
 * Pedidos abiertos como zonas difusas (la celda H3 entera, nunca un punto).
 * Sin clave de Maps no se muestra nada: la lista es la vista principal.
 */
export function AlertsMap({ alerts, coverage, selectedId, onSelect }: AlertsMapProps) {
  const { colors } = useTheme();
  const host = useRef<HTMLDivElement | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!GOOGLE_MAPS_KEY || !host.current) return;
    let overlays: GOverlay[] = [];
    let cancelled = false;
    void (async () => {
      try {
        const [maps, h3] = await Promise.all([loadMaps(), import("h3-js")]);
        if (cancelled || !host.current) return;
        const map = new maps.Map(host.current, {
          center: coverage ?? { lat: -38.4, lng: -63.6 },
          zoom: coverage ? 9 : 4,
          styles: mapStyles(colors),
          disableDefaultUI: true,
          zoomControl: true,
          clickableIcons: false,
          gestureHandling: "cooperative",
        });
        const bounds = new maps.LatLngBounds();
        if (coverage) {
          overlays.push(
            new maps.Circle({
              map,
              center: coverage,
              radius: coverage.radiusKm * 1000,
              strokeColor: colors.primary,
              strokeOpacity: 0.5,
              strokeWeight: 1,
              fillOpacity: 0,
              clickable: false,
            }),
          );
        }
        for (const a of alerts) {
          if (!a.h3Cell) continue;
          const paths = h3.cellToBoundary(a.h3Cell).map(([lat, lng]) => ({ lat, lng }));
          paths.forEach((p) => bounds.extend(p));
          const color = a.path === "violence" ? colors.embrace : colors.primary;
          const poly = new maps.Polygon({
            map,
            paths,
            strokeColor: color,
            strokeOpacity: 0.6,
            strokeWeight: a.id === selectedId ? 3 : 1,
            fillColor: color,
            fillOpacity: a.id === selectedId ? 0.45 : 0.25,
          });
          poly.addListener("click", () => onSelect(a.id));
          overlays.push(poly);
        }
        if (!bounds.isEmpty()) map.fitBounds(bounds, 48);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      overlays.forEach((o) => o.setMap(null));
      overlays = [];
    };
  }, [alerts, coverage, selectedId, onSelect, colors]);

  if (!GOOGLE_MAPS_KEY || failed) return null;
  return (
    <View
      accessibilityLabel="Mapa de pedidos abiertos, por zona aproximada"
      style={{
        height: 320,
        borderRadius: 20,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: colors.hairline,
      }}
    >
      {createElement("div", { ref: host, style: { width: "100%", height: "100%" } })}
    </View>
  );
}
