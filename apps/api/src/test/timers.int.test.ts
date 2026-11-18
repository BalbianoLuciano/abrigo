import { alertClaims, alerts, conversations, eq } from "@abrigo/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  call,
  createAdmin,
  createApprovedHelper,
  mentalHealthAlert,
  newAnon,
  startHarness,
  waitFor,
  type Harness,
  type StaffAccount,
} from "./harness.js";

describe("tiempos del ciclo de vida (reloj acelerado)", () => {
  let h: Harness;
  let admin: StaffAccount;

  beforeAll(async () => {
    h = await startHarness({
      CLAIM_TIMEOUT_MS: "1500",
      ALERT_EXPIRY_MS: "4000",
      CONVERSATION_INACTIVITY_MS: "3500",
      ANON_TOKEN_ROTATION_MS: "1000",
    });
    admin = await createAdmin(h);
  });
  afterAll(() => h?.close());

  it("una alerta tomada sin primer mensaje vuelve a estar abierta", async () => {
    const helper = await createApprovedHelper(h, admin);
    const anon = await newAnon(h);
    const alert = await call(h, "POST", "/v1/alerts", { anon, body: mentalHealthAlert });
    const claim = await call(h, "POST", `/v1/helper/alerts/${alert.body.id}/claim`, {
      bearer: helper.token,
    });
    expect(claim.status).toBe(201);
    const reopened = await waitFor(async () => {
      const [a] = await h.db.db.select().from(alerts).where(eq(alerts.id, alert.body.id));
      return a?.status === "open" && a;
    });
    expect(reopened.round).toBe(1);
    const [c] = await h.db.db
      .select()
      .from(alertClaims)
      .where(eq(alertClaims.alertId, alert.body.id));
    expect(c!.releaseReason).toBe("no_first_message");
    await call(h, "POST", `/v1/alerts/${alert.body.id}/cancel`, { anon });
  });

  it("con primer mensaje a tiempo, la alerta queda activa", async () => {
    const helper = await createApprovedHelper(h, admin);
    const anon = await newAnon(h);
    const alert = await call(h, "POST", "/v1/alerts", { anon, body: mentalHealthAlert });
    const claim = await call(h, "POST", `/v1/helper/alerts/${alert.body.id}/claim`, {
      bearer: helper.token,
    });
    await call(h, "POST", `/v1/conversations/${claim.body.conversationId}/messages`, {
      bearer: helper.token,
      body: { body: "Hola" },
    });
    await new Promise((r) => setTimeout(r, 1800));
    const [a] = await h.db.db.select().from(alerts).where(eq(alerts.id, alert.body.id));
    expect(a!.status).toBe("active");
    // Sin mensajes durante la ventana de inactividad, se cierra sola.
    const closed = await waitFor(async () => {
      const [conv] = await h.db.db
        .select()
        .from(conversations)
        .where(eq(conversations.id, claim.body.conversationId));
      return conv?.endedAt && conv;
    });
    expect(closed).toMatchObject({ endedBy: "system", endReason: "inactivity" });
  });

  it("sin respuesta, la alerta se cierra", async () => {
    const anon = await newAnon(h);
    const alert = await call(h, "POST", "/v1/alerts", {
      anon,
      body: { ...mentalHealthAlert, path: "violence" },
    });
    const closed = await waitFor(async () => {
      const [a] = await h.db.db.select().from(alerts).where(eq(alerts.id, alert.body.id));
      return a?.status === "closed" && a;
    }, 8000);
    expect(closed.closeReason).toBe("no_response");
  });

  it("el token anónimo rota y el anterior deja de valer después de la gracia", async () => {
    const anon = await newAnon(h);
    await new Promise((r) => setTimeout(r, 1100));
    const res = await call(h, "GET", "/v1/alerts/current", { anon });
    expect(res.status).toBe(200);
    const rotated = res.headers.get("x-anon-token-rotated");
    expect(rotated).toBeTruthy();
    expect(rotated).not.toBe(anon);
    // El nuevo funciona; el viejo sigue valiendo durante la ventana de gracia.
    expect((await call(h, "GET", "/v1/alerts/current", { anon: rotated! })).status).toBe(200);
    expect((await call(h, "GET", "/v1/alerts/current", { anon })).status).toBe(200);
  });
});
