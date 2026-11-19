import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { alerts, and, eq, inArray, notifications } from "@abrigo/db";
import { latLngToCell } from "h3-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  call,
  createAdmin,
  createApprovedHelper,
  newAnon,
  startHarness,
  waitFor,
  type Harness,
  type StaffAccount,
} from "./harness.js";

/** Obelisco, CABA. */
const CABA = { lat: -34.6037, lng: -58.3816 };
const CABA_CELL = latLngToCell(CABA.lat, CABA.lng, 6);
/** ~1 grado de latitud ≈ 111 km. */
const southOf = (km: number) => ({ lat: CABA.lat - km / 111, lng: CABA.lng });

const WEBHOOK_SECRET = "secreto-del-webhook-de-prueba";
const DELAYS = [1500, 3000, 4500, 6000];

interface TelegramCall {
  method: string;
  body: { chat_id: string; text: string; reply_markup?: unknown };
}

describe("cercanía y escalado (etapa 2)", () => {
  let h: Harness;
  let admin: StaffAccount;
  let telegramApi: Server;
  const telegramCalls: TelegramCall[] = [];

  beforeAll(async () => {
    // Bot de Telegram falso: registra lo que la API le manda.
    telegramApi = createServer((req, res) => {
      let raw = "";
      req.on("data", (c) => (raw += c));
      req.on("end", () => {
        telegramCalls.push({ method: req.url!.split("/").pop()!, body: JSON.parse(raw) });
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ ok: true, result: {} }));
      });
    });
    await new Promise<void>((r) => telegramApi.listen(0, "127.0.0.1", r));
    const port = (telegramApi.address() as AddressInfo).port;

    h = await startHarness({
      ESCALATION_DELAYS_MS: DELAYS.join(","),
      ALERT_EXPIRY_MS: "120000",
      TELEGRAM_BOT_TOKEN: "test-token",
      TELEGRAM_BOT_USERNAME: "AbrigoPruebaBot",
      TELEGRAM_WEBHOOK_SECRET: WEBHOOK_SECRET,
      TELEGRAM_API_BASE: `http://127.0.0.1:${port}`,
    });
    admin = await createAdmin(h);
  });
  afterAll(async () => {
    await h?.close();
    telegramApi?.close();
  });

  async function helperAt(
    circle: { lat: number; lng: number; radiusKm: number } | null,
    opts: { regionCodes?: string[]; remote?: boolean; gender?: "woman" | "man" } = {},
  ) {
    const helper = await createApprovedHelper(h, admin, {
      specialties: ["mental_health", "violence"],
      ...(opts.gender ? { gender: opts.gender } : {}),
    });
    const res = await call(h, "PUT", "/v1/helper/coverage", {
      bearer: helper.token,
      body: {
        circle,
        regionCodes: opts.regionCodes ?? [],
        acceptsRemoteAnywhere: opts.remote ?? false,
      },
    });
    expect(res.status).toBe(200);
    return helper;
  }

  async function createAlert(body: Record<string, unknown>) {
    const anon = await newAnon(h);
    const res = await call(h, "POST", "/v1/alerts", {
      anon,
      body: {
        path: "mental_health",
        ageConfirmed: true,
        consentAccepted: true,
        dangerNow: "no",
        ...body,
      },
    });
    expect(res.status).toBe(201);
    return { anon, id: res.body.id as string };
  }

  async function notifiedAmong(alertId: string, helperIds: string[]) {
    const rows = await h.db.db
      .selectDistinct({ helperId: notifications.helperId })
      .from(notifications)
      .where(and(eq(notifications.alertId, alertId), inArray(notifications.helperId, helperIds)));
    return new Set(rows.map((r) => r.helperId));
  }

  const level = async (id: string) =>
    (await h.db.db.select().from(alerts).where(eq(alerts.id, id)))[0]!.escalationLevel;

  it("guarda y devuelve la zona de cobertura", async () => {
    const helper = await helperAt({ ...CABA, radiusKm: 10 }, { regionCodes: ["AR-C"] });
    const res = await call(h, "GET", "/v1/helper/coverage", { bearer: helper.token });
    expect(res.body.regionCodes).toEqual(["AR-C"]);
    expect(res.body.circle.lat).toBeCloseTo(CABA.lat, 2);
    expect(res.body.circle.radiusKm).toBeGreaterThan(9.5);
    expect(res.body.circle.radiusKm).toBeLessThan(10.5);
  });

  it("rechaza una celda más precisa que resolución 6", async () => {
    const anon = await newAnon(h);
    const res = await call(h, "POST", "/v1/alerts", {
      anon,
      body: {
        path: "mental_health",
        ageConfirmed: true,
        consentAccepted: true,
        dangerNow: "no",
        h3Cell: latLngToCell(CABA.lat, CABA.lng, 9),
      },
    });
    expect(res.status).toBe(400);
  });

  it("una alerta en CABA avisa primero a quien cubre CABA y escala por niveles", async () => {
    const local = await helperAt({ ...CABA, radiusKm: 10 });
    const near = await helperAt({ ...southOf(40), radiusKm: 10 }); // borde a ~30 km
    const province = await helperAt({ ...southOf(120), radiusKm: 10 }); // borde a ~110 km
    const remote = await helperAt(null, { remote: true });
    const far = await helperAt({ lat: -31.4201, lng: -64.1888, radiusKm: 20 }); // Córdoba, no remoto
    const ids = [local, near, province, remote, far].map((x) => x.helperId);

    const alert = await createAlert({ h3Cell: CABA_CELL });

    const at0 = await waitFor(async () => {
      const s = await notifiedAmong(alert.id, ids);
      return s.size > 0 && s;
    });
    expect([...at0]).toEqual([local.helperId]);

    // El ayudante de la zona ve la alerta; el de 30 km todavía no.
    const localList = await call(h, "GET", "/v1/helper/alerts", { bearer: local.token });
    expect(localList.body.alerts.map((a: { id: string }) => a.id)).toContain(alert.id);
    const nearList = await call(h, "GET", "/v1/helper/alerts", { bearer: near.token });
    expect(nearList.body.alerts.map((a: { id: string }) => a.id)).not.toContain(alert.id);

    await waitFor(async () => (await notifiedAmong(alert.id, ids)).has(near.helperId));
    expect((await notifiedAmong(alert.id, ids)).has(province.helperId)).toBe(false);

    await waitFor(async () => (await notifiedAmong(alert.id, ids)).has(province.helperId));
    expect((await notifiedAmong(alert.id, ids)).has(remote.helperId)).toBe(false);

    await waitFor(async () => (await notifiedAmong(alert.id, ids)).has(remote.helperId));
    await waitFor(async () => (await level(alert.id)) === 4);

    // Córdoba, sin aceptar remoto: nunca.
    expect((await notifiedAmong(alert.id, ids)).has(far.helperId)).toBe(false);

    // A nadie se le avisó dos veces por la misma alerta y canal.
    const rows = await h.db.db
      .select()
      .from(notifications)
      .where(and(eq(notifications.alertId, alert.id), eq(notifications.helperId, local.helperId)));
    expect(rows.length).toBe(new Set(rows.map((r) => r.channel)).size);

    await call(h, "POST", `/v1/alerts/${alert.id}/cancel`, { anon: alert.anon });
  }, 30_000);

  it("con peligro indicado arranca en el nivel 1", async () => {
    const near = await helperAt({ ...southOf(40), radiusKm: 10 });
    const alert = await createAlert({
      h3Cell: CABA_CELL,
      dangerNow: "yes",
      crisisLinesShownAt: new Date().toISOString(),
    });
    expect(await level(alert.id)).toBe(1);
    await waitFor(async () => (await notifiedAmong(alert.id, [near.helperId])).size === 1, 1200);
    await call(h, "POST", `/v1/alerts/${alert.id}/cancel`, { anon: alert.anon });
  });

  it("tomar una alerta cancela los escalados pendientes", async () => {
    const local = await helperAt({ ...CABA, radiusKm: 10 });
    const remote = await helperAt(null, { remote: true });
    const alert = await createAlert({ h3Cell: CABA_CELL });
    const claim = await call(h, "POST", `/v1/helper/alerts/${alert.id}/claim`, {
      bearer: local.token,
    });
    expect(claim.status).toBe(201);
    const [claimRow] = await h.db.db.select().from(alerts).where(eq(alerts.id, alert.id));
    expect(claimRow!.status).toBe("claimed");

    await new Promise((r) => setTimeout(r, DELAYS[2]! + 500));
    expect(await level(alert.id)).toBe(0);
    expect((await notifiedAmong(alert.id, [remote.helperId])).size).toBe(0);
    await call(h, "POST", `/v1/alerts/${alert.id}/cancel`, { anon: alert.anon });
  }, 15_000);

  it("la preferencia de mujer se respeta hasta el nivel 3", async () => {
    const man = await helperAt({ ...CABA, radiusKm: 10 }, { gender: "man" });
    const alert = await createAlert({
      path: "violence",
      h3Cell: CABA_CELL,
      safeTimeToWrite: "yes",
      helperGenderPref: "woman",
    });
    const early = await call(h, "POST", `/v1/helper/alerts/${alert.id}/claim`, {
      bearer: man.token,
    });
    expect(early.status).toBe(409);
    expect((await notifiedAmong(alert.id, [man.helperId])).size).toBe(0);

    await waitFor(async () => (await level(alert.id)) >= 3, 8000);
    await waitFor(async () => (await notifiedAmong(alert.id, [man.helperId])).size === 1);
    const late = await call(h, "POST", `/v1/helper/alerts/${alert.id}/claim`, {
      bearer: man.token,
    });
    expect(late.status).toBe(201);
    await call(h, "POST", `/v1/alerts/${alert.id}/cancel`, { anon: alert.anon });
  }, 15_000);

  it("el ayudante nunca recibe una ubicación más precisa que la celda", async () => {
    const local = await helperAt({ ...CABA, radiusKm: 10 });
    const alert = await createAlert({ h3Cell: CABA_CELL });
    const list = await call(h, "GET", "/v1/helper/alerts", { bearer: local.token });
    const item = list.body.alerts.find((a: { id: string }) => a.id === alert.id);
    expect(item.h3Cell).toBe(CABA_CELL);
    expect(Object.keys(item)).not.toContain("cellCenter");
    expect(JSON.stringify(list.body)).not.toMatch(/-34\.6|-58\.3/);
    await call(h, "POST", `/v1/alerts/${alert.id}/cancel`, { anon: alert.anon });
  });

  it("vincula Telegram, avisa por ese canal y se desvincula con /stop", async () => {
    const helper = await helperAt({ ...CABA, radiusKm: 10 });
    const link = await call(h, "POST", "/v1/helper/telegram/link", { bearer: helper.token });
    expect(link.status).toBe(201);
    expect(link.body.url).toBe(`https://t.me/AbrigoPruebaBot?start=${link.body.code}`);

    const update = (text: string, chatId = 4242) => ({
      message: { text, chat: { id: chatId, type: "private" } },
    });
    const forged = await call(h, "POST", "/v1/telegram/webhook", {
      body: update(`/start ${link.body.code}`),
      headers: { "x-telegram-bot-api-secret-token": "otro-secreto-cualquiera-xx" },
    });
    expect(forged.status).toBe(403);

    const ok = await call(h, "POST", "/v1/telegram/webhook", {
      body: update(`/start ${link.body.code}`),
      headers: { "x-telegram-bot-api-secret-token": WEBHOOK_SECRET },
    });
    expect(ok.status).toBe(200);
    const prefs = await call(h, "GET", "/v1/helper/notification-prefs", { bearer: helper.token });
    expect(prefs.body.telegramLinked).toBe(true);

    // El código es de un solo uso.
    await call(h, "POST", "/v1/telegram/webhook", {
      body: update(`/start ${link.body.code}`, 999),
      headers: { "x-telegram-bot-api-secret-token": WEBHOOK_SECRET },
    });
    expect(telegramCalls.at(-1)!.body.text).toMatch(/Para vincular tu cuenta/);

    // Solo Telegram: sin push ni email.
    await call(h, "PUT", "/v1/helper/notification-prefs", {
      bearer: helper.token,
      body: {
        webPush: false,
        email: false,
        telegram: true,
        quietStartMin: null,
        quietEndMin: null,
      },
    });
    const alert = await createAlert({ h3Cell: CABA_CELL });
    const sent = await waitFor(async () =>
      telegramCalls.find(
        (c) => c.body.chat_id === "4242" && /necesita que la escuchen/.test(c.body.text),
      ),
    );
    expect(sent.body.text).toBe("Hay una persona que necesita que la escuchen (salud mental).");
    expect(JSON.stringify(sent.body.reply_markup)).toContain("Abrir Abrigo");
    const channels = await h.db.db
      .select({ channel: notifications.channel })
      .from(notifications)
      .where(and(eq(notifications.alertId, alert.id), eq(notifications.helperId, helper.helperId)));
    expect(channels.map((c) => c.channel)).toEqual(["telegram"]);
    await call(h, "POST", `/v1/alerts/${alert.id}/cancel`, { anon: alert.anon });

    await call(h, "POST", "/v1/telegram/webhook", {
      body: update("/stop"),
      headers: { "x-telegram-bot-api-secret-token": WEBHOOK_SECRET },
    });
    const after = await call(h, "GET", "/v1/helper/notification-prefs", { bearer: helper.token });
    expect(after.body.telegramLinked).toBe(false);
  });

  it("en horario de silencio no se avisa", async () => {
    const helper = await helperAt({ ...CABA, radiusKm: 10 });
    // Silencio de 00:00 a 23:59 (hora de Argentina).
    await call(h, "PUT", "/v1/helper/notification-prefs", {
      bearer: helper.token,
      body: { webPush: true, email: true, telegram: true, quietStartMin: 0, quietEndMin: 1439 },
    });
    const alert = await createAlert({ h3Cell: CABA_CELL });
    await new Promise((r) => setTimeout(r, 800));
    expect((await notifiedAmong(alert.id, [helper.helperId])).size).toBe(0);
    await call(h, "POST", `/v1/alerts/${alert.id}/cancel`, { anon: alert.anon });
  });

  it("métricas de tiempo hasta tomar, por nivel y provincia", async () => {
    const res = await call(h, "GET", "/v1/admin/metrics?days=7", { bearer: admin.token });
    expect(res.status).toBe(200);
    expect(res.body.alertsCreated).toBeGreaterThan(0);
    const levels = res.body.byLevel.map((r: { level: number }) => r.level);
    expect(levels).toEqual(expect.arrayContaining([0, 3]));
    expect(res.body.byRegion.some((r: { region: string }) => r.region === "cell")).toBe(true);
    const asHelper = await call(h, "GET", "/v1/admin/metrics", {
      bearer: (await helperAt(null)).token,
    });
    expect(asHelper.status).toBe(403);
  });
});
