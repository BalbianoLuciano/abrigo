export interface MapAlert {
  id: string;
  path: "mental_health" | "violence";
  h3Cell: string | null;
}

export interface AlertsMapProps {
  alerts: MapAlert[];
  coverage: { lat: number; lng: number; radiusKm: number } | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
}
