import { Inject, Logger } from "@nestjs/common";
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  type OnGatewayConnection,
} from "@nestjs/websockets";
import type { Socket } from "socket.io";
import { z } from "zod";
import { AnonService } from "../anon/anon.service.js";
import { StaffSessionResolver } from "../auth/guards.js";
import type { Principal } from "../common/principal.js";
import { ConversationsService } from "../conversations/conversations.service.js";
import { HelpersService } from "../helpers/helpers.service.js";
import { rooms } from "./events.js";

const joinSchema = z.object({ conversationId: z.uuid() });
const messageSchema = z.object({
  conversationId: z.uuid(),
  body: z.string().min(1).max(4000),
  clientId: z.string().max(64).optional(),
});

type Ack<T = unknown> = { ok: true; data?: T } | { ok: false; error: string };

interface SocketData {
  principal?: Principal;
}

@WebSocketGateway({ path: "/socket.io" })
export class ChatGateway implements OnGatewayConnection {
  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    @Inject(AnonService) private readonly anon: AnonService,
    @Inject(StaffSessionResolver) private readonly staff: StaffSessionResolver,
    @Inject(ConversationsService) private readonly conversations: ConversationsService,
    @Inject(HelpersService) private readonly helpers: HelpersService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const auth = client.handshake.auth as { anonToken?: unknown; sessionToken?: unknown };
      const data = client.data as SocketData;
      if (typeof auth.anonToken === "string") {
        const result = await this.anon.validate(auth.anonToken);
        if (!result) return this.reject(client);
        data.principal = { kind: "anon", sessionId: result.sessionId };
        await client.join(rooms.anon(result.sessionId));
        if (result.rotatedToken) client.emit("anon:token-rotated", { token: result.rotatedToken });
        return;
      }
      const headers = new Headers();
      if (typeof auth.sessionToken === "string")
        headers.set("authorization", `Bearer ${auth.sessionToken}`);
      const cookie = client.handshake.headers.cookie;
      if (cookie) headers.set("cookie", cookie);
      const staff = await this.staff.resolve(headers);
      if (!staff || !staff.twoFactorEnabled || staff.role === "helper_suspended") {
        return this.reject(client);
      }
      data.principal = {
        kind: "staff",
        userId: staff.userId,
        role: staff.role,
        helperId: staff.helperId,
      };
      await client.join(rooms.user(staff.userId));
      if (staff.helperId && staff.role === "helper") {
        await client.join(rooms.helper(staff.helperId));
        const profile = await this.helpers.profileForClaims(staff.helperId);
        for (const path of profile.specialties) await client.join(rooms.helpersOf(path));
      }
    } catch (err) {
      this.logger.warn(`Conexión rechazada: ${(err as Error).name}`);
      this.reject(client);
    }
  }

  @SubscribeMessage("join")
  async join(@ConnectedSocket() client: Socket, @MessageBody() payload: unknown): Promise<Ack> {
    const who = (client.data as SocketData).principal;
    const parsed = joinSchema.safeParse(payload);
    if (!who || !parsed.success) return { ok: false, error: "invalid" };
    try {
      const conv = await this.conversations.forParticipant(parsed.data.conversationId, who);
      if (conv.endedAt) return { ok: false, error: "ended" };
      await client.join(rooms.conversation(conv.id));
      return { ok: true };
    } catch {
      return { ok: false, error: "forbidden" };
    }
  }

  @SubscribeMessage("message")
  async message(@ConnectedSocket() client: Socket, @MessageBody() payload: unknown): Promise<Ack> {
    const who = (client.data as SocketData).principal;
    const parsed = messageSchema.safeParse(payload);
    if (!who || !parsed.success) return { ok: false, error: "invalid" };
    try {
      const event = await this.conversations.send(
        parsed.data.conversationId,
        who,
        parsed.data.body,
        parsed.data.clientId,
      );
      return { ok: true, data: event };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }

  @SubscribeMessage("typing")
  typing(@ConnectedSocket() client: Socket, @MessageBody() payload: unknown): void {
    const who = (client.data as SocketData).principal;
    const parsed = joinSchema.safeParse(payload);
    if (!who || !parsed.success) return;
    const room = rooms.conversation(parsed.data.conversationId);
    if (!client.rooms.has(room)) return;
    client.to(room).emit("typing", {
      conversationId: parsed.data.conversationId,
      sender: who.kind === "anon" ? "anon" : "helper",
    });
  }

  private reject(client: Socket) {
    client.emit("auth:error", { message: "Sesión no válida" });
    client.disconnect(true);
  }
}
