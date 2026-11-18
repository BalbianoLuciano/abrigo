import type { FastifyRequest } from "fastify";

export function toWebHeaders(raw: FastifyRequest["headers"]): Headers {
  const headers = new Headers();
  for (const [key, value] of Object.entries(raw)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) value.forEach((v) => headers.append(key, v));
    else headers.set(key, String(value));
  }
  return headers;
}

export const ANON_TOKEN_HEADER = "x-anon-token";
export const ANON_TOKEN_ROTATED_HEADER = "x-anon-token-rotated";
