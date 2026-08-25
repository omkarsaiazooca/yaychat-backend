import { Request, Response } from "express";
import { yaysCalls } from "../services/yaysCall.service";
import { callConfigFor, callsEnabled } from "../services/calls/iceServers";
import { CallRecord } from "../data/yaysCalls";

const emailOf = (req: Request): string =>
  String((req as any).user?.email || "").trim().toLowerCase();

const asInt = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.floor(parsed) : fallback;
};

const failed = (res: Response, error: any, context: string) => {
  console.error(`[yays/calls] ${context}`, error);
  return res
    .status(500)
    .json({ message: "The calling service is unavailable right now.", code: "server" });
};

/** Shape a stored call for the caller's own history view. */
const toHistoryRow = (call: CallRecord, viewerLower: string) => {
  const outgoing = call.callerLower === viewerLower;
  return {
    callId: call.callId,
    direction: outgoing ? "outgoing" : "incoming",
    peer: outgoing ? call.calleeLower : call.callerLower,
    peerName: (outgoing ? call.calleeLower : call.callerLower).split("@")[0],
    media: call.media,
    status: call.status,
    durationSeconds: call.durationSeconds || 0,
    // Only the receiving side of an unanswered call sees it as "missed".
    missed: !outgoing && call.status === "missed",
    createdAt: (call.createdAt ?? new Date()).toISOString(),
    endedAt: call.endedAt ? new Date(call.endedAt).toISOString() : null,
  };
};

export class YaysCallsController {
  constructor() {
    // Express drops `this` when handlers are passed as bare references.
    const self = this as any;
    for (const key of Object.getOwnPropertyNames(YaysCallsController.prototype)) {
      if (key !== "constructor" && typeof self[key] === "function") {
        self[key] = self[key].bind(this);
      }
    }
  }

  /**
   * Public capability check.
   *
   * Deliberately unauthenticated and free of credentials so the client can
   * decide whether to show call buttons before sign-in. The ICE servers
   * themselves — which carry TURN credentials — are only handed out to a
   * signed-in user by `getIceServers`.
   */
  async getConfig(_req: Request, res: Response) {
    const config = callConfigFor("anonymous");
    return res.status(200).json({
      data: {
        enabled: config.enabled,
        relayConfigured: config.relayConfigured,
        ringTimeoutSeconds: config.ringTimeoutSeconds,
        media: ["audio", "video"],
      },
    });
  }

  /** Short-lived ICE servers for one client. Re-fetched per call. */
  async getIceServers(req: Request, res: Response) {
    try {
      if (!callsEnabled()) {
        return res
          .status(503)
          .json({ message: "Calling is not available.", code: "unavailable" });
      }
      return res.status(200).json({ data: callConfigFor(emailOf(req)) });
    } catch (error) {
      return failed(res, error, "ice servers");
    }
  }

  async getHistory(req: Request, res: Response) {
    try {
      const userLower = emailOf(req);
      const limit = Math.min(Math.max(asInt(req.query.limit, 50), 1), 100);
      const skip = Math.max(asInt(req.query.skip, 0), 0);
      const rows = await yaysCalls.history(userLower, limit + 1, skip);
      return res.status(200).json({
        data: {
          items: rows.slice(0, limit).map((call) => toHistoryRow(call, userLower)),
          hasMore: rows.length > limit,
        },
      });
    } catch (error) {
      return failed(res, error, "history");
    }
  }

  async getCall(req: Request, res: Response) {
    try {
      const userLower = emailOf(req);
      const call = await yaysCalls.byId(String(req.params.callId));
      if (
        !call ||
        (call.callerLower !== userLower && call.calleeLower !== userLower)
      ) {
        return res
          .status(404)
          .json({ message: "That call is not available.", code: "not_found" });
      }
      return res.status(200).json({ data: toHistoryRow(call, userLower) });
    } catch (error) {
      return failed(res, error, "call");
    }
  }

  /**
   * Whether this user is mid-call.
   *
   * Used on app resume: a client that was killed during a call needs to know
   * whether to rejoin or start clean, and the server is the only place that
   * knows for sure.
   */
  async getActiveCall(req: Request, res: Response) {
    try {
      const userLower = emailOf(req);
      const call = await yaysCalls.liveCallFor(userLower);
      return res
        .status(200)
        .json({ data: { call: call ? toHistoryRow(call, userLower) : null } });
    } catch (error) {
      return failed(res, error, "active call");
    }
  }

  /**
   * REST fallback for ending a call.
   *
   * The socket path is normal; this exists for the case where the app is
   * resumed with a stale call and its socket has not reconnected yet, which
   * would otherwise leave the user marked busy.
   */
  async endCall(req: Request, res: Response) {
    try {
      const userLower = emailOf(req);
      const callId = String(req.params.callId);
      const call = await yaysCalls.byId(callId);
      if (
        !call ||
        (call.callerLower !== userLower && call.calleeLower !== userLower)
      ) {
        return res
          .status(404)
          .json({ message: "That call is not available.", code: "not_found" });
      }
      const settled =
        call.status === "ringing"
          ? await yaysCalls.cancel(callId, userLower)
          : await yaysCalls.hangUp(callId, userLower);
      return res.status(200).json({
        data: { call: settled ? toHistoryRow(settled, userLower) : toHistoryRow(call, userLower) },
      });
    } catch (error) {
      return failed(res, error, "end call");
    }
  }
}
