// services/chatWebsocket.service.ts
import type http from "http";
import { Server } from "socket.io";
import { createClient } from "redis";
import { createAdapter } from "@socket.io/redis-adapter";
import { ChatGroupService } from "../services/chatgroups.service";
import { GroupReadStateService } from "./groupReadState.service";
import { ChatMessageService } from "./chatmessage.service";
import { ChatUserBlockService } from "./chatUserBlock.service";
import { registerCallHandlers } from "./calls/signaling";

export const EVERYONE_GROUP_ID = "1596e5c0-7eb0-11f0-89eb-753fe21ceabe";
export const EVERYONE_GROUP_NAME = "Bitcoin Yay General";

const normEmail = (e: string) => String(e || "").trim().toLowerCase();
const readState = new GroupReadStateService();
const msgSvc = new ChatMessageService();
const blockSvc = new ChatUserBlockService();

export class ChatSocketService {
  private static _instance: ChatSocketService | null = null;

  /** Singleton accessor (throws if not initialized) */
  public static get instance(): ChatSocketService {
    if (!this._instance) {
      throw new Error("ChatSocketService not initialized. Call ChatSocketService.init(server) first.");
    }
    return this._instance;
  }

  /** Returns the Socket.IO server if initialized */
  public static getIO(): Server | undefined {
    return this._instance?.io;
  }

  /** Initialize once per process */
  public static init(server: http.Server): ChatSocketService {
    if (!this._instance) {
      this._instance = new ChatSocketService(server);
    }
    return this._instance;
  }


  // ---- instance ----
  public readonly io!: Server;
  private readonly groupService = new ChatGroupService();
  private readonly userSockets = new Map<string, Set<string>>();

  private normalizeGroupId(group: any): string | null {
    const raw = group?.groupId ?? group?.id ?? group?._id;
    if (!raw) return null;
    return String(raw);
  }

  private constructor(server: http.Server) {
    this.io = new Server(server, {
      cors: { origin: "*", credentials: true },
      path: "/socket.io/",          // matches your Nginx `location /socket.io/`
      pingTimeout: 20000,
      pingInterval: 25000,
      perMessageDeflate: false
    });

    // Hook up Redis adapter for PM2 clusters (no sticky sessions needed)
    // Moved after this.io assignment to avoid "used before being assigned"
    (async () => {
      try {
        const pub = createClient({
          socket: {
            host: process.env.REDIS_HOST || "127.0.0.1",
            port: Number(process.env.REDIS_PORT || 6379),
          },
          username: process.env.REDIS_USERNAME || undefined,
          password: process.env.REDIS_PASSWORD,
        });
        const sub = pub.duplicate();
        await Promise.all([pub.connect(), sub.connect()]);
        this.io.adapter(createAdapter(pub, sub));
        console.log("[socket] Redis adapter ready");
      } catch (e) {
        console.error("[socket] Redis adapter failed:", e);
      }
    })();

    // Auth middleware (email via auth or query)
    this.io.use((socket, next) => {
      const email = normEmail(
        (socket.handshake.auth?.email as string) ||
        (socket.handshake.query?.email as string) ||
        ""
      );
      if (!email) return next(new Error("unauthorized"));
      (socket.data as any).email = email;
      next();
    });

    // Connections
    this.io.on("connection", async (socket) => {
      const email = normEmail((socket.data as any).email as string);
      this.addSocket(email, socket.id);

      // 🔐 join user-private room for direct emits (cluster-wide)
      socket.join(`user:${email}`);

      const fallbackRooms = new Set<string>([EVERYONE_GROUP_ID]);
      try {
        const groups = await this.groupService.getUserGroups(email);
        for (const g of groups) {
          const gid = this.normalizeGroupId(g);
          if (!gid) continue;
          socket.join(`group:${gid}`);
          fallbackRooms.delete(gid);
        }
      } catch {
        // ignore if DB not ready; client can join later
      }

      fallbackRooms.forEach((gid) => socket.join(`group:${gid}`));

      // Client-driven join/leave
      socket.on("group:join", (groupId: string) => groupId && socket.join(`group:${groupId}`));
      socket.on("group:leave", (groupId: string) => groupId && socket.leave(`group:${groupId}`));

      // Helper: list global groups
      socket.on("groups:list", async (_: unknown, cb?: (groups: any[]) => void) => {
        try {
          const groups = await this.groupService.find({ isGlobal: true });
          cb?.(groups);
        } catch {
          cb?.([]);
        }
      });

      // typing events should be volatile to avoid backpressure flood
      socket.on("typing", (payload) => {
        const fromEmail = (socket.data as any).email as string;
        const eventPayload = { ...(payload || {}), email: fromEmail };
        if (payload?.groupId) {
          this.io.volatile.to(`group:${payload.groupId}`).emit("typing", eventPayload);
          return;
        }
        const receiverEmail = normEmail(payload?.receiverEmail || payload?.to || "");
        if (receiverEmail) {
          this.io.volatile.to(`user:${receiverEmail}`).emit("typing", eventPayload);
        }
      });

      // Client marks a group as read
      socket.on("group:markRead", async (payload: { groupId: string; at?: string }) => {
        try {
          const email = (socket.data as any).email as string;
          const at = payload?.at ? new Date(payload.at) : new Date();
          await readState.markRead(email, payload.groupId, at);

          // Recompute this user's unread for that group and emit only to them
          const last = await readState.getLastRead(email, payload.groupId);
          const blocked = await blockSvc.getBlockedLowerListForGroupOrDirect(email, payload.groupId);
          const count = await msgSvc.countGroupUnreadForUser(payload.groupId, email, last, {
            excludeSenderEmails: blocked,
          });
          this.io.to(`user:${email}`).emit("counts:group", { groupId: payload.groupId, unread: count });
        } catch (e) {
          // swallow
        }
      });

      // Client asks for current counts snapshot (group + DM)
      socket.on("counts:pull", async (cb?: (data: any) => void) => {
        try {
          const email = (socket.data as any).email as string;

          // get every group this user should see
          const userGroups = await this.groupService.getUserGroups(email);
          const groupIds = (userGroups || []).map((g: any) => String(g.groupId)).filter(Boolean);

          const pairs = await Promise.all(
            groupIds.map(async gid => {
              const last = await readState.getLastRead(email, gid);
              const blockedForGroup = await blockSvc.getBlockedLowerListForGroupOrDirect(email, gid);
              const unread = await msgSvc.countGroupUnreadForUser(gid, email, last, {
                excludeSenderEmails: blockedForGroup,
              });
              return { groupId: gid, unread };
            })
          );

          const directTotal = await msgSvc.countDirectMessages(email, {
            unreadOnly: true,
            excludeSenderEmails: await blockSvc.getBlockedLowerList(email, null),
          });
          const payload = { groups: pairs, direct: { total: directTotal } };

          cb?.(payload);
          this.io.to(`user:${email}`).emit("counts:snapshot", payload);
        } catch {
          cb?.({ groups: [], direct: { total: 0 } });
        }
      });

      // 1:1 audio/video call signaling — SDP + ICE relay and call lifecycle.
      // Registered per connection so calls ride the same authenticated socket
      // as chat, and a user's `user:` room already reaches every device.
      registerCallHandlers(this.io, socket);

      // Healthcheck
      socket.on("ping:client", (msg: string, cb?: (s: string) => void) => cb?.(msg || "pong"));

      socket.on("disconnect", () => this.removeSocket(email, socket.id));
    });
  }

  // ---- helpers (instance) ----
  private addSocket(email: string, sid: string) {
    if (!this.userSockets.has(email)) this.userSockets.set(email, new Set());
    this.userSockets.get(email)!.add(sid);
  }

  private removeSocket(email: string, sid: string) {
    const set = this.userSockets.get(email);
    if (!set) return;
    set.delete(sid);
    if (set.size === 0) this.userSockets.delete(email);
  }

  private getSocketIdsByEmail(email: string): string[] {
    return Array.from(this.userSockets.get(normEmail(email)) ?? []);
  }

  // ---- helpers (static wrappers for controllers) ----
  /** Get socket IDs by email (works across methods) */
  public static getSocketIdsByEmail(email: string): string[] {
    return this.instance.getSocketIdsByEmail(email);
  }

  /** Emit to a group, excluding specific socket IDs */
  public static emitToGroupExcept(
    groupId: string,
    excludeSocketIds: string[] | undefined,
    event: string,
    payload: any
  ) {
    const io = this.getIO();
    if (!io) return;
    let op: any = io.to(`group:${groupId}`);
    if (excludeSocketIds?.length) op = op.except(excludeSocketIds);
    op.emit(event, payload);
  }

  /** Emit to a group, excluding all sockets that belong to `excludeEmail` */
  public static emitToGroupExceptEmail(
    groupId: string,
    excludeEmail: string,
    event: string,
    payload: any
  ) {
    const ids = this.getSocketIdsByEmail(excludeEmail);
    this.emitToGroupExcept(groupId, ids, event, payload);
  }

  public static emitToUser(email: string, event: string, payload: any) {
    const io = this.getIO();
    if (!io) return;
    io.to(`user:${normEmail(email)}`).emit(event, payload);
  }

  public static emitToGroup(groupId: string, event: string, payload: any) {
    const io = this.getIO();
    if (!io) return;
    io.to(`group:${groupId}`).emit(event, payload);
  }

  public static joinUserToGroup(email: string, groupId: string) {
    if (!groupId) return;
    const inst = this._instance;
    if (!inst) return;
    const io = inst.io;
    const ids = inst.getSocketIdsByEmail(email);
    if (!ids.length) return;
    ids.forEach((sid) => {
      const sock = io.sockets.sockets.get(sid);
      sock?.join(`group:${groupId}`);
    });
  }

  public static leaveUserFromGroup(email: string, groupId: string) {
    if (!groupId) return;
    const inst = this._instance;
    if (!inst) return;
    const io = inst.io;
    const ids = inst.getSocketIdsByEmail(email);
    if (!ids.length) return;
    ids.forEach((sid) => {
      const sock = io.sockets.sockets.get(sid);
      sock?.leave(`group:${groupId}`);
    });
  }

}
