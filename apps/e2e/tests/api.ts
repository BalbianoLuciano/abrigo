import { randomBytes } from "node:crypto";
import { authUsers, createDb, eq } from "@abrigo/db";
import { generateSync } from "otplib";
import { API_URL } from "../stack.js";

async function call(
  method: string,
  path: string,
  body?: unknown,
  headers: Record<string, string> = {},
) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: { ...(body ? { "content-type": "application/json" } : {}), ...headers },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  return { status: res.status, headers: res.headers, body: text ? JSON.parse(text) : null };
}

export interface Account {
  email: string;
  password: string;
  secret: string;
  token: string;
  helperId: string;
}

async function register(firstName: string) {
  const email = `${firstName
    .normalize("NFD")
    .replace(/[^a-zA-Z]/g, "")
    .toLowerCase()}-${randomBytes(3).toString("hex")}@example.com`;
  const password = "una-clave-bien-larga";
  const res = await call("POST", "/v1/helpers/register", {
    email,
    password,
    firstName,
    lastName: "Prueba",
    profession: "psicologia",
    licenseNumber: "MN 12345",
    licenseJurisdiction: "CABA",
    specialties: ["mental_health", "violence"],
    gender: "woman",
    languages: ["es"],
    acceptsRemoteAnywhere: true,
    acceptsCodeOfConduct: true,
  });
  if (res.status !== 201) throw new Error(`register ${res.status}`);
  return { email, password, helperId: res.body.helperId as string };
}

async function signInAndEnableTotp(email: string, password: string) {
  const login = await call("POST", "/api/auth/sign-in/email", { email, password });
  const token = login.headers.get("set-auth-token") ?? login.body.token;
  const enable = await call(
    "POST",
    "/api/auth/two-factor/enable",
    { password },
    { authorization: `Bearer ${token}` },
  );
  const secret = new URL(enable.body.totpURI).searchParams.get("secret")!;
  const verify = await call(
    "POST",
    "/api/auth/two-factor/verify-totp",
    { code: generateSync({ secret }) },
    { authorization: `Bearer ${token}` },
  );
  return { secret, token: verify.headers.get("set-auth-token") ?? token };
}

export async function createAdmin(): Promise<Account> {
  const reg = await register("Admin");
  const db = createDb(process.env.E2E_DATABASE_URL!);
  await db.db.update(authUsers).set({ role: "admin" }).where(eq(authUsers.email, reg.email));
  await db.close();
  return { ...reg, ...(await signInAndEnableTotp(reg.email, reg.password)) };
}

/** Ayudante aprobado y con TOTP; la guardia la activa desde la interfaz. */
export async function createHelper(admin: Account, firstName: string): Promise<Account> {
  const reg = await register(firstName);
  const res = await call(
    "POST",
    `/v1/admin/helpers/${reg.helperId}/decision`,
    { decision: "approve" },
    { authorization: `Bearer ${admin.token}` },
  );
  if (res.status !== 204) throw new Error(`approve ${res.status}`);
  return { ...reg, ...(await signInAndEnableTotp(reg.email, reg.password)) };
}

export const totp = (secret: string) => generateSync({ secret });
