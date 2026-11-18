import {
  alerts,
  anonSessions,
  auditLog,
  conversations,
  eq,
  messages,
  notifications,
  sql,
} from "@abrigo/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  call,
  connectSocket,
  createAdmin,
  createApprovedHelper,
  mentalHealthAlert,
  newAnon,
  nextEvent,
  startHarness,
  waitFor,
  type Harness,
  type StaffAccount,
} from "./harness.js";

describe("pedido de ayuda, toma y chat", () => {
  let h: Harness;
  let admin: StaffAccount;

  beforeAll(async () => {
    h = await startHarness();
    admin = await createAdmin(h);
  });
  afterAll(() => h?.close());

  it("se puede crear una alerta sin ningún dato personal", async () => {
    const anon = await newAnon(h);
    const res = await call(h, "POST", "/v1/alerts", { anon, body: mentalHealthAlert });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ status: "open", path: "mental_health" });
    const current = await call(h, "GET", "/v1/alerts/current", { anon });
    expect(current.body.alert.id).toBe(res.body.id);
    const [session] = await h.db.db.select().from(anonSessions);
    // La sesión solo guarda el hash del token.
    expect(Object.values(session!)).not.toContain(anon);
  });

  it("con peligro, las líneas se tienen que haber mostrado antes de enviar", async () => {
    const anon = await newAnon(h);
    const without = await call(h, "POST", "/v1/alerts", {
      anon,
      body: { ...mentalHealthAlert, dangerNow: "yes" },
    });
    expect(without.status).toBe(400);
    const shownAt = new Date().toISOString();
    const ok = await call(h, "POST", "/v1/alerts", {
      anon,
      body: { ...mentalHealthAlert, dangerNow: "unsure", crisisLinesShownAt: shownAt },
    });
    expect(ok.status).toBe(201);
    const [row] = await h.db.db.select().from(alerts).where(eq(alerts.id, ok.body.id));
    expect(row!.crisisLinesShownAt?.toISOString()).toBe(shownAt);
    await call(h, "POST", `/v1/alerts/${ok.body.id}/cancel`, { anon });
  });

  it("un menor de 18 no puede crear una alerta", async () => {
    const anon = await newAnon(h);
    const res = await call(h, "POST", "/v1/alerts", {
      anon,
      body: { ...mentalHealthAlert, ageConfirmed: false },
    });
    expect(res.status).toBe(400);
  });

  it("no acepta coordenadas exactas", async () => {
    const anon = await newAnon(h);
    const res = await call(h, "POST", "/v1/alerts", {
      anon,
      body: { ...mentalHealthAlert, h3Cell: "-34.6037,-58.3816" },
    });
    expect(res.status).toBe(400);
  });

  it("sin sesión anónima no se puede pedir", async () => {
    expect((await call(h, "POST", "/v1/alerts", { body: mentalHealthAlert })).status).toBe(401);
    expect(
      (await call(h, "POST", "/v1/alerts", { anon: "inventado", body: mentalHealthAlert })).status,
    ).toBe(401);
  });

  it("dos ayudantes que toman la misma alerta a la vez: solo uno lo logra", async () => {
    const helpers = await Promise.all(
      Array.from({ length: 5 }, () => createApprovedHelper(h, admin)),
    );
    const anon = await newAnon(h);
    const alert = await call(h, "POST", "/v1/alerts", { anon, body: mentalHealthAlert });
    const results = await Promise.all(
      helpers.map((hp) =>
        call(h, "POST", `/v1/helper/alerts/${alert.body.id}/claim`, { bearer: hp.token }),
      ),
    );
    const statuses = results.map((r) => r.status).sort();
    expect(statuses).toEqual([201, 409, 409, 409, 409]);
    const loser = results.find((r) => r.status === 409)!;
    expect(loser.body.message).toBe("Otra persona ya está acompañando este pedido");
    const convs = await h.db.db
      .select()
      .from(conversations)
      .where(eq(conversations.alertId, alert.body.id));
    expect(convs).toHaveLength(1);
    await call(h, "POST", `/v1/alerts/${alert.body.id}/cancel`, { anon });
  });

  it("flujo completo: pedido → aviso → tomar → chat cifrado → cierre", async () => {
    const helper = await createApprovedHelper(h, admin);
    const anon = await newAnon(h);
    const anonSocket = await connectSocket(h, { anonToken: anon });
    const helperSocket = await connectSocket(h, { sessionToken: helper.token });

    const listChanged = nextEvent(helperSocket, "alerts:changed");
    const alert = await call(h, "POST", "/v1/alerts", { anon, body: mentalHealthAlert });
    await listChanged;

    // Aviso registrado (el email y el push no tienen destino en tests).
    await waitFor(async () => {
      const rows = await h.db.db
        .select()
        .from(notifications)
        .where(eq(notifications.alertId, alert.body.id));
      return rows.some((r) => r.helperId === helper.helperId) && rows;
    });

    const open = await call(h, "GET", "/v1/helper/alerts", { bearer: helper.token });
    expect(open.body.alerts.map((a: { id: string }) => a.id)).toContain(alert.body.id);

    const claimedEvent = nextEvent(anonSocket, "alert:update");
    const claim = await call(h, "POST", `/v1/helper/alerts/${alert.body.id}/claim`, {
      bearer: helper.token,
    });
    expect(claim.status).toBe(201);
    const conversationId = claim.body.conversationId as string;
    expect(await claimedEvent).toMatchObject({ status: "claimed", conversationId });
    const mine = await call(h, "GET", "/v1/helper/conversations", { bearer: helper.token });
    expect(mine.body.conversations).toEqual([
      expect.objectContaining({ id: conversationId, path: "mental_health", status: "claimed" }),
    ]);

    expect((await helperSocket.emitWithAck("join", { conversationId })).ok).toBe(true);
    expect((await anonSocket.emitWithAck("join", { conversationId })).ok).toBe(true);

    // Quien pide ayuda ve nombre de pila y profesión, nada más.
    const summary = await call(h, "GET", `/v1/conversations/${conversationId}`, { anon });
    expect(summary.body.helper).toEqual({ firstName: "Lucía", profession: "psicologia" });

    const activeEvent = waitFor(async () => {
      const [a] = await h.db.db.select().from(alerts).where(eq(alerts.id, alert.body.id));
      return a?.status === "active" && a;
    });
    const received = nextEvent(anonSocket, "message");
    const ack = await helperSocket.emitWithAck("message", {
      conversationId,
      body: "Hola, soy Lucía. Gracias por escribir. Acá estoy.",
    });
    expect(ack.ok).toBe(true);
    expect((await received).body).toBe("Hola, soy Lucía. Gracias por escribir. Acá estoy.");
    await activeEvent;

    const helperReceived = nextEvent(helperSocket, "message");
    await anonSocket.emitWithAck("message", { conversationId, body: "Hola, gracias" });
    expect((await helperReceived).sender).toBe("anon");

    // En la base no hay texto plano.
    const raw = await h.db.pool.query<{ ciphertext: Buffer }>(
      "SELECT ciphertext FROM messages WHERE conversation_id = $1",
      [conversationId],
    );
    expect(raw.rows).toHaveLength(2);
    for (const r of raw.rows) {
      expect(r.ciphertext.toString("utf8")).not.toMatch(/Hola|gracias|Lucía/);
    }
    const history = await call(h, "GET", `/v1/conversations/${conversationId}/messages`, { anon });
    expect(history.body.messages.map((m: { body: string }) => m.body)).toEqual([
      "Hola, soy Lucía. Gracias por escribir. Acá estoy.",
      "Hola, gracias",
    ]);

    // Un tercero no puede leer ni unirse.
    const other = await newAnon(h);
    expect(
      (await call(h, "GET", `/v1/conversations/${conversationId}/messages`, { anon: other }))
        .status,
    ).toBe(403);

    const closed = nextEvent(anonSocket, "closed");
    const close = await call(h, "POST", `/v1/conversations/${conversationId}/close`, {
      bearer: helper.token,
      body: { helperNote: "Derivé a la línea 135. Seguimiento sugerido." },
    });
    expect(close.status).toBe(204);
    expect(await closed).toMatchObject({ by: "helper" });
    const [final] = await h.db.db.select().from(alerts).where(eq(alerts.id, alert.body.id));
    expect(final!.status).toBe("closed");
    const [conv] = await h.db.db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationId));
    expect(conv!.helperNoteCiphertext?.toString("utf8")).not.toContain("135");

    const audit = await h.db.db.select().from(auditLog).where(eq(auditLog.targetId, alert.body.id));
    expect(audit.map((a) => a.action)).toEqual(
      expect.arrayContaining(["alert.created", "alert.claimed"]),
    );
    for (const a of await h.db.db.select().from(auditLog)) {
      expect(JSON.stringify(a.metadata)).not.toMatch(/Hola|Lucía|135/);
    }

    anonSocket.disconnect();
    helperSocket.disconnect();
  });

  it("pedir otra persona libera al ayudante y vuelve a abrir el pedido", async () => {
    const first = await createApprovedHelper(h, admin);
    const anon = await newAnon(h);
    const alert = await call(h, "POST", "/v1/alerts", { anon, body: mentalHealthAlert });
    const claim = await call(h, "POST", `/v1/helper/alerts/${alert.body.id}/claim`, {
      bearer: first.token,
    });
    await call(h, "POST", `/v1/conversations/${claim.body.conversationId}/messages`, {
      bearer: first.token,
      body: { body: "Hola" },
    });
    expect((await call(h, "POST", `/v1/alerts/${alert.body.id}/reassign`, { anon })).status).toBe(
      204,
    );
    const [row] = await h.db.db.select().from(alerts).where(eq(alerts.id, alert.body.id));
    expect(row).toMatchObject({ status: "open", round: 1 });
    // El mismo ayudante no la vuelve a ver ni la puede tomar.
    const list = await call(h, "GET", "/v1/helper/alerts", { bearer: first.token });
    expect(list.body.alerts.map((a: { id: string }) => a.id)).not.toContain(alert.body.id);
    const again = await call(h, "POST", `/v1/helper/alerts/${alert.body.id}/claim`, {
      bearer: first.token,
    });
    expect(again.status).toBe(409);
    // Ya no puede escribir en la conversación anterior.
    const late = await call(h, "POST", `/v1/conversations/${claim.body.conversationId}/messages`, {
      bearer: first.token,
      body: { body: "¿Seguís ahí?" },
    });
    expect(late.status).toBe(422);
    const second = await createApprovedHelper(h, admin);
    expect(
      (await call(h, "POST", `/v1/helper/alerts/${alert.body.id}/claim`, { bearer: second.token }))
        .status,
    ).toBe(201);
    await call(h, "POST", `/v1/alerts/${alert.body.id}/cancel`, { anon });
  });

  it("la preferencia de que escriba una mujer se respeta", async () => {
    const man = await createApprovedHelper(h, admin, { gender: "man", firstName: "Juan" });
    const anon = await newAnon(h);
    const alert = await call(h, "POST", "/v1/alerts", {
      anon,
      body: {
        ...mentalHealthAlert,
        path: "violence",
        helperGenderPref: "woman",
        safeTimeToWrite: "little",
      },
    });
    const list = await call(h, "GET", "/v1/helper/alerts", { bearer: man.token });
    expect(list.body.alerts.map((a: { id: string }) => a.id)).not.toContain(alert.body.id);
    const claim = await call(h, "POST", `/v1/helper/alerts/${alert.body.id}/claim`, {
      bearer: man.token,
    });
    expect(claim.status).toBe(409);
    await call(h, "POST", `/v1/alerts/${alert.body.id}/cancel`, { anon });
  });

  it("suspender a un ayudante en plena conversación vuelve a abrir el pedido", async () => {
    const helper = await createApprovedHelper(h, admin);
    const anon = await newAnon(h);
    const anonSocket = await connectSocket(h, { anonToken: anon });
    const alert = await call(h, "POST", "/v1/alerts", { anon, body: mentalHealthAlert });
    const claim = await call(h, "POST", `/v1/helper/alerts/${alert.body.id}/claim`, {
      bearer: helper.token,
    });
    await call(h, "POST", `/v1/conversations/${claim.body.conversationId}/messages`, {
      bearer: helper.token,
      body: { body: "Hola" },
    });
    const reopened = waitFor(async () => {
      const [a] = await h.db.db.select().from(alerts).where(eq(alerts.id, alert.body.id));
      return a?.status === "open" && a;
    });
    const update = nextEvent(anonSocket, "alert:update");
    const res = await call(h, "POST", `/v1/admin/helpers/${helper.helperId}/suspend`, {
      bearer: admin.token,
      body: { reason: "reporte grave" },
    });
    expect(res.body).toEqual({ reopenedConversations: 1 });
    await reopened;
    expect(await update).toMatchObject({ status: "open", reason: "helper_suspended" });
    anonSocket.disconnect();
    await call(h, "POST", `/v1/alerts/${alert.body.id}/cancel`, { anon });
  });

  it("como máximo 3 pedidos por sesión cada 24 h", async () => {
    const anon = await newAnon(h);
    for (let i = 0; i < 3; i++) {
      const res = await call(h, "POST", "/v1/alerts", { anon, body: mentalHealthAlert });
      expect(res.status).toBe(201);
      // Mientras haya uno en curso no se puede crear otro.
      expect((await call(h, "POST", "/v1/alerts", { anon, body: mentalHealthAlert })).status).toBe(
        409,
      );
      await call(h, "POST", `/v1/alerts/${res.body.id}/cancel`, { anon });
    }
    const fourth = await call(h, "POST", "/v1/alerts", { anon, body: mentalHealthAlert });
    expect(fourth.status).toBe(429);
  });

  it("'Borrar todo' elimina la sesión y los datos del servidor", async () => {
    const helper = await createApprovedHelper(h, admin);
    const anon = await newAnon(h);
    const alert = await call(h, "POST", "/v1/alerts", {
      anon,
      body: { ...mentalHealthAlert, regionCode: "AR-C" },
    });
    const claim = await call(h, "POST", `/v1/helper/alerts/${alert.body.id}/claim`, {
      bearer: helper.token,
    });
    const conversationId = claim.body.conversationId as string;
    await call(h, "POST", `/v1/conversations/${conversationId}/messages`, {
      bearer: helper.token,
      body: { body: "Hola" },
    });
    await call(h, "POST", `/v1/conversations/${conversationId}/messages`, {
      anon,
      body: { body: "Hola" },
    });

    expect((await call(h, "DELETE", "/v1/anon/session", { anon })).status).toBe(204);

    expect(
      await h.db.db.select().from(messages).where(eq(messages.conversationId, conversationId)),
    ).toHaveLength(0);
    const [conv] = await h.db.db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationId));
    expect(conv).toMatchObject({ anonSessionId: null, endReason: "erased" });
    const [a] = await h.db.db.select().from(alerts).where(eq(alerts.id, alert.body.id));
    expect(a).toMatchObject({ status: "closed", anonSessionId: null, regionCode: null });
    expect((await call(h, "GET", "/v1/alerts/current", { anon })).status).toBe(401);
    const sessions = await h.db.db.execute(sql`SELECT count(*)::int AS n FROM anon_sessions`);
    expect(sessions.rows[0]).toBeDefined();
  });
});
