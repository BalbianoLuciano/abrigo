import { useQuery } from "@tanstack/react-query";
import { ApiError, getStaffToken, request, setStaffToken } from "./api";
import { closeSocket } from "./socket";

export interface StaffMe {
  helperId: string | null;
  firstName: string | null;
  lastName: string | null;
  profession: string | null;
  specialties: ("mental_health" | "violence")[] | null;
  gender: string | null;
  status: "pending" | "approved" | "rejected" | "suspended" | null;
  maxConcurrent: number | null;
  isOnCall: boolean | null;
  pausedUntil: string | null;
  email: string;
  role: "helper_pending" | "helper" | "helper_suspended" | "admin";
  twoFactorEnabled: boolean;
}

export function useStaffMe() {
  return useQuery({
    queryKey: ["staff-me"],
    queryFn: async (): Promise<StaffMe | null> => {
      if (!(await getStaffToken())) return null;
      try {
        return await request<StaffMe>("GET", "/v1/helper/me", { auth: "staff" });
      } catch (err) {
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          await setStaffToken(null);
          return null;
        }
        throw err;
      }
    },
  });
}

/** Paso 1 del login. Si la cuenta tiene TOTP, devuelve `needsTotp`. */
export async function signIn(email: string, password: string): Promise<{ needsTotp: boolean }> {
  const res = await request<{ twoFactorRedirect?: boolean; token?: string }>(
    "POST",
    "/api/auth/sign-in/email",
    { body: { email, password } },
  );
  if (res.twoFactorRedirect) return { needsTotp: true };
  if (res.token) await setStaffToken(res.token);
  return { needsTotp: false };
}

/** Paso 2 del login: el código de la app de autenticación (usa la cookie del paso 1). */
export async function verifyTotp(code: string) {
  const res = await request<{ token?: string }>("POST", "/api/auth/two-factor/verify-totp", {
    body: { code },
  });
  if (res.token) await setStaffToken(res.token);
}

export async function startTotpSetup(password: string) {
  return request<{ totpURI: string; backupCodes: string[] }>(
    "POST",
    "/api/auth/two-factor/enable",
    {
      auth: "staff",
      body: { password },
    },
  );
}

export async function confirmTotpSetup(code: string) {
  await request("POST", "/api/auth/two-factor/verify-totp", { auth: "staff", body: { code } });
}

export async function signOut() {
  try {
    await request("POST", "/api/auth/sign-out", { auth: "staff", body: {} });
  } catch {
    // la sesión local se limpia igual
  }
  closeSocket();
  await setStaffToken(null);
}
