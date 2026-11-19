import { sql, type SQL } from "@abrigo/db";
import { BadRequestException } from "@nestjs/common";
import { cellToLatLng, getResolution, isValidCell } from "h3-js";

/** La app reduce la ubicación a resolución 6 (~36 km²) antes de enviarla. */
export const H3_RESOLUTION = 6;

export function assertCoarseCell(cell: string) {
  if (!isValidCell(cell) || getResolution(cell) !== H3_RESOLUTION) {
    throw new BadRequestException({ message: "Zona inválida", code: "invalid_zone" });
  }
}

/** Centro de la celda como geography(Point). Solo se usa para comparar con coberturas. */
export function cellCenterSql(cell: string): SQL {
  const [lat, lng] = cellToLatLng(cell);
  return sql`ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography`;
}
