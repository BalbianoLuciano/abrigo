import { API_URL } from "./config";
import { secureStorage } from "./secure-storage";

const ANON_KEY = "anon-token";
const STAFF_KEY = "staff-token";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
    readonly data?: unknown,
  ) {
    super(message);
  }
}

type Auth = "anon" | "staff" | "none";

let anonToken: string | null | undefined;
let staffToken: string | null | undefined;

export async function getAnonToken(): Promise<string | null> {
  if (anonToken === undefined) anonToken = await secureStorage.get(ANON_KEY);
  return anonToken;
}

export async function setAnonToken(token: string | null) {
  anonToken = token;
  if (token) await secureStorage.set(ANON_KEY, token);
  else await secureStorage.remove(ANON_KEY);
}

export async function getStaffToken(): Promise<string | null> {
  if (staffToken === undefined) staffToken = await secureStorage.get(STAFF_KEY);
  return staffToken;
}

export async function setStaffToken(token: string | null) {
  staffToken = token;
  if (token) await secureStorage.set(STAFF_KEY, token);
  else await secureStorage.remove(STAFF_KEY);
}

/** Garantiza una sesión anónima en el dispositivo (sin ningún dato personal). */
export async function ensureAnonSession(): Promise<string> {
  const existing = await getAnonToken();
  if (existing) return existing;
  const res = await request<{ token: string }>("POST", "/v1/anon/session", { auth: "none" });
  await setAnonToken(res.token);
  return res.token;
}

export async function request<T>(
  method: string,
  path: string,
  opts: { auth?: Auth; body?: unknown; headers?: Record<string, string> } = {},
): Promise<T> {
  const auth = opts.auth ?? "none";
  const headers: Record<string, string> = { accept: "application/json", ...opts.headers };
  if (opts.body !== undefined) headers["content-type"] = "application/json";
  if (auth === "anon") {
    const token = await ensureAnonSession();
    headers["x-anon-token"] = token;
  }
  if (auth === "staff") {
    const token = await getStaffToken();
    if (token) headers.authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    credentials: "include",
    ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
  });

  const rotated = res.headers.get("x-anon-token-rotated");
  if (rotated && auth === "anon") await setAnonToken(rotated);
  const newStaff = res.headers.get("set-auth-token");
  if (newStaff) await setStaffToken(newStaff);

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!res.ok) {
    const d = (data ?? {}) as { message?: string | string[]; code?: string };
    const message = Array.isArray(d.message) ? d.message.join(". ") : (d.message ?? "Algo falló");
    if (res.status === 401 && auth === "anon") await setAnonToken(null);
    throw new ApiError(res.status, message, d.code, data);
  }
  return data as T;
}
