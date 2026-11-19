import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  call,
  createAdmin,
  createApprovedHelper,
  enableTotp,
  registration,
  signIn,
  startHarness,
  type Harness,
  type StaffAccount,
} from "./harness.js";

describe("auth de ayudantes y admin", () => {
  let h: Harness;
  let admin: StaffAccount;

  beforeAll(async () => {
    h = await startHarness();
    admin = await createAdmin(h);
  });
  afterAll(() => h?.close());

  it("el alta pública por Better Auth está bloqueada", async () => {
    const res = await call(h, "POST", "/api/auth/sign-up/email", {
      body: { email: "x@example.com", password: "una-clave-bien-larga", name: "X" },
    });
    expect(res.status).toBe(404);
  });

  it("un profesional sin matrícula no puede registrarse", async () => {
    const res = await call(h, "POST", "/v1/helpers/register", {
      body: registration({ licenseNumber: undefined as never }),
    });
    expect(res.status).toBe(400);
  });

  it("un ayudante pendiente ve su estado pero no las alertas", async () => {
    const reg = registration();
    const created = await call(h, "POST", "/v1/helpers/register", { body: reg });
    expect(created.status).toBe(201);
    const { token } = await signIn(h, reg.email, reg.password);
    const me = await call(h, "GET", "/v1/helper/me", { bearer: token });
    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({ status: "pending", twoFactorEnabled: false });
    const alerts = await call(h, "GET", "/v1/helper/alerts", { bearer: token });
    expect(alerts.status).toBe(403);
  });

  it("un ayudante aprobado sin TOTP no puede entrar", async () => {
    const reg = registration();
    const created = await call(h, "POST", "/v1/helpers/register", { body: reg });
    await call(h, "POST", `/v1/admin/helpers/${created.body.helperId}/decision`, {
      bearer: admin.token,
      body: { decision: "approve" },
    });
    const { token } = await signIn(h, reg.email, reg.password);
    const res = await call(h, "GET", "/v1/helper/alerts", { bearer: token });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("two_factor_required");

    const totp = await enableTotp(h, token, reg.password);
    expect((await call(h, "GET", "/v1/helper/alerts", { bearer: totp.token })).status).toBe(200);

    // Con TOTP activo, la contraseña sola ya no alcanza.
    const again = await signIn(h, reg.email, reg.password);
    expect(again.twoFactorRedirect).toBe(true);
    expect(again.token).toBe("");
  });

  it("solo el admin puede aprobar", async () => {
    const helper = await createApprovedHelper(h, admin);
    const res = await call(h, "GET", "/v1/admin/helpers?status=pending", { bearer: helper.token });
    expect(res.status).toBe(403);
    const ok = await call(h, "GET", "/v1/admin/helpers?status=pending", { bearer: admin.token });
    expect(ok.status).toBe(200);
  });

  it("un ayudante suspendido pierde la sesión al instante", async () => {
    const helper = await createApprovedHelper(h, admin);
    expect((await call(h, "GET", "/v1/helper/alerts", { bearer: helper.token })).status).toBe(200);
    const res = await call(h, "POST", `/v1/admin/helpers/${helper.helperId}/suspend`, {
      bearer: admin.token,
      body: { reason: "prueba de suspensión" },
    });
    expect(res.status).toBe(201);
    expect((await call(h, "GET", "/v1/helper/alerts", { bearer: helper.token })).status).toBe(401);
    // Y no puede volver a entrar a operar.
    const again = await signIn(h, helper.email, helper.password, helper.totpSecret);
    expect((await call(h, "GET", "/v1/helper/alerts", { bearer: again.token })).status).toBe(403);
  });
});

describe("CORS", () => {
  let h: Harness;
  beforeAll(async () => {
    h = await startHarness();
  });
  afterAll(() => h?.close());

  it("permite los métodos que usa la PWA", async () => {
    for (const method of ["PATCH", "PUT", "DELETE"]) {
      const res = await fetch(`${h.baseUrl}/v1/helper/availability`, {
        method: "OPTIONS",
        headers: {
          origin: h.env.PUBLIC_APP_URL,
          "access-control-request-method": method,
          "access-control-request-headers": "authorization,content-type",
        },
      });
      expect(res.status).toBeLessThan(300);
      expect(res.headers.get("access-control-allow-methods")).toContain(method);
    }
  });
});
