import type { Server, Socket } from "socket.io";
import {
  CalleeBusyError,
  CallAlreadyExistsError,
  RING_TIMEOUT_SECONDS,
  yaysCalls,
} from "../yaysCall.service";
import { callConfigFor, callsEnabled } from "./iceServers";
import { CallMedia } from "../../data/yaysCalls";
import { notificationDelivery } from "../notificationDelivery.service";
import { buildDeepLink } from "../notifications/deepLinks";

/**
 * WebRTC signaling for 1:1 calls, carried on the existing chat socket.
 *
 * Only the handshake passes through here — SDP offers/answers and ICE
 * candidates — plus the call-state events both peers need to keep their UI in
 * sync. Media never touches the server.
 *
 * Two things this layer is careful about:
 *
 *  - **Relaying, not trusting.** A socket may only signal about a call it is
 *    actually a party to, and the peer is looked up from the stored record
 *    rather than from the payload. Otherwise any client could inject an offer
 *    into someone else's call by guessing a `callId`.
 *  - **Every device, then exactly one outcome.** A user signed in on several
 *    devices rings on all of them (`user:` room), but the first device to
 *    accept or decline settles the call and the rest are told to stop ringing.
 */

const normEmail = (value: unknown): string =>
  String(value || "").trim().toLowerCase();

/** Ring timers, so a caller who disappears mid-ring still resolves the call. */
const ringTimers = new Map<string, NodeJS.Timeout>();

const clearRingTimer = (callId: string) => {
  const timer = ringTimers.get(callId);
  if (timer) {
    clearTimeout(timer);
    ringTimers.delete(callId);
  }
};

const toPeer = (io: Server, email: string, event: string, payload: unknown) => {
  io.to(`user:${email}`).emit(event, payload);
};

/** The two ends of a call, or null if this user is not a party to it. */
const partiesFor = async (callId: string, actorLower: string) => {
  const call = await yaysCalls.byId(callId);
  if (!call) {
    return null;
  }
  if (call.callerLower !== actorLower && call.calleeLower !== actorLower) {
    return null;
  }
  const peerLower =
    call.callerLower === actorLower ? call.calleeLower : call.callerLower;
  return { call, peerLower };
};

export const registerCallHandlers = (io: Server, socket: Socket) => {
  const email = normEmail((socket.data as any).email);

  /** What ICE servers this client should use; refreshed per call. */
  socket.on("call:config", (_: unknown, cb?: (config: unknown) => void) => {
    cb?.(callConfigFor(email));
  });

  /**
   * Place a call. The caller has already generated `callId` and will send the
   * SDP offer once the callee reports ringing.
   */
  socket.on(
    "call:invite",
    async (
      payload: { callId?: string; to?: string; media?: CallMedia },
      cb?: (result: unknown) => void
    ) => {
      const callId = String(payload?.callId || "").trim();
      const calleeLower = normEmail(payload?.to);
      const media: CallMedia = payload?.media === "video" ? "video" : "audio";

      if (!callsEnabled()) {
        cb?.({ ok: false, code: "unavailable", message: "Calling is not available." });
        return;
      }
      if (!callId || !calleeLower || calleeLower === email) {
        cb?.({ ok: false, code: "validation", message: "Invalid call request." });
        return;
      }

      try {
        const call = await yaysCalls.place({
          callId,
          callerLower: email,
          calleeLower,
          media,
        });

        // Ring every device the callee is signed in on.
        toPeer(io, calleeLower, "call:incoming", {
          callId,
          from: email,
          media,
          ringTimeoutSeconds: RING_TIMEOUT_SECONDS,
        });

        // …and push, so a backgrounded or killed app still rings.
        notificationDelivery
          .deliver({
            userLower: calleeLower,
            category: "messages",
            title: media === "video" ? "Incoming video call" : "Incoming call",
            body: `${email.split("@")[0]} is calling you.`,
            deepLink: buildDeepLink("calls.incoming", { callId }) ?? undefined,
            // A ring has to cut through Do Not Disturb the way a phone call
            // does; a call that silently expires under quiet hours is worse
            // than no calling at all.
            critical: true,
            dedupeKey: `call:${callId}`,
            data: { type: "call", callId, media, from: email },
          })
          .catch((error) =>
            console.error("[yays/calls] could not push incoming call", error)
          );

        // If nobody answers, the server — not either client — decides it was
        // missed, so the outcome is the same whatever the callers' apps did.
        clearRingTimer(callId);
        ringTimers.set(
          callId,
          setTimeout(async () => {
            ringTimers.delete(callId);
            const missed = await yaysCalls.markMissed(callId).catch(() => null);
            if (missed) {
              toPeer(io, missed.callerLower, "call:ended", {
                callId,
                status: "missed",
                reason: "no_answer",
              });
              toPeer(io, missed.calleeLower, "call:ended", {
                callId,
                status: "missed",
                reason: "no_answer",
              });
            }
          }, RING_TIMEOUT_SECONDS * 1000)
        );

        cb?.({ ok: true, call: { callId, status: call.status, media } });
      } catch (error) {
        if (error instanceof CalleeBusyError) {
          cb?.({ ok: false, code: "busy", message: error.message });
          return;
        }
        if (error instanceof CallAlreadyExistsError) {
          cb?.({ ok: false, code: "duplicate", message: error.message });
          return;
        }
        console.error("[yays/calls] invite failed", error);
        cb?.({ ok: false, code: "server", message: "Could not start the call." });
      }
    }
  );

  /** SDP offer/answer and ICE candidates — relayed verbatim to the peer. */
  const relay = (event: "call:offer" | "call:answer" | "call:candidate") => {
    socket.on(event, async (payload: { callId?: string; [key: string]: unknown }) => {
      const callId = String(payload?.callId || "");
      const parties = await partiesFor(callId, email).catch(() => null);
      if (!parties) {
        return;
      }
      toPeer(io, parties.peerLower, event, { ...payload, from: email });
    });
  };
  relay("call:offer");
  relay("call:answer");
  relay("call:candidate");

  socket.on("call:accept", async (payload: { callId?: string }, cb?: (r: unknown) => void) => {
    const callId = String(payload?.callId || "");
    try {
      const call = await yaysCalls.accept(callId, email);
      clearRingTimer(callId);
      toPeer(io, call.callerLower, "call:accepted", { callId, by: email });
      // Stop the ring on this user's other devices.
      toPeer(io, call.calleeLower, "call:handled", { callId, by: email });
      cb?.({ ok: true });
    } catch (error) {
      cb?.({ ok: false, code: "not_found", message: "That call is no longer available." });
    }
  });

  socket.on("call:decline", async (payload: { callId?: string }, cb?: (r: unknown) => void) => {
    const callId = String(payload?.callId || "");
    const parties = await partiesFor(callId, email).catch(() => null);
    if (!parties) {
      cb?.({ ok: false, code: "not_found" });
      return;
    }
    const settled = await yaysCalls.decline(callId, email);
    clearRingTimer(callId);
    if (settled) {
      toPeer(io, settled.callerLower, "call:ended", {
        callId,
        status: "declined",
        reason: "declined",
      });
      toPeer(io, settled.calleeLower, "call:handled", { callId, by: email });
    }
    cb?.({ ok: true });
  });

  socket.on("call:hangup", async (payload: { callId?: string }, cb?: (r: unknown) => void) => {
    const callId = String(payload?.callId || "");
    const parties = await partiesFor(callId, email).catch(() => null);
    if (!parties) {
      cb?.({ ok: false, code: "not_found" });
      return;
    }

    // Hanging up while it is still ringing is a cancel, not a completed call —
    // the distinction is what tells the callee's history "missed" rather than
    // "incoming call, 0 seconds".
    const settled =
      parties.call.status === "ringing"
        ? await yaysCalls.cancel(callId, email)
        : await yaysCalls.hangUp(callId, email);

    clearRingTimer(callId);
    if (settled) {
      const event = {
        callId,
        status: settled.status,
        reason: settled.endReason,
        durationSeconds: settled.durationSeconds,
      };
      toPeer(io, settled.callerLower, "call:ended", event);
      toPeer(io, settled.calleeLower, "call:ended", event);
    }
    cb?.({ ok: true });
  });

  /**
   * The peer's media stack gave up (ICE failed, usually behind a NAT with no
   * TURN relay). Recorded distinctly from a hang-up so the failure rate is
   * visible instead of looking like people ending calls immediately.
   */
  socket.on("call:failed", async (payload: { callId?: string }) => {
    const callId = String(payload?.callId || "");
    const parties = await partiesFor(callId, email).catch(() => null);
    if (!parties) {
      return;
    }
    const settled = await yaysCalls.settle(callId, "failed", "connection_failed", email);
    clearRingTimer(callId);
    if (settled) {
      const event = { callId, status: "failed", reason: "connection_failed" };
      toPeer(io, settled.callerLower, "call:ended", event);
      toPeer(io, settled.calleeLower, "call:ended", event);
    }
  });

  /**
   * A dropped socket during a live call ends it.
   *
   * Deliberately immediate rather than grace-period: WebRTC media has already
   * stopped by the time the signaling socket drops, so holding the call "open"
   * only leaves the other side staring at a frozen screen and marks the user
   * busy for the next caller.
   */
  socket.on("disconnect", async () => {
    try {
      const live = await yaysCalls.liveCallFor(email);
      if (!live) {
        return;
      }
      const settled =
        live.status === "ringing"
          ? await yaysCalls.cancel(live.callId, email)
          : await yaysCalls.hangUp(live.callId, email);
      clearRingTimer(live.callId);
      if (settled) {
        const event = {
          callId: settled.callId,
          status: settled.status,
          reason: settled.endReason,
          durationSeconds: settled.durationSeconds,
        };
        toPeer(io, settled.callerLower, "call:ended", event);
        toPeer(io, settled.calleeLower, "call:ended", event);
      }
    } catch (error) {
      console.error("[yays/calls] disconnect cleanup failed", error);
    }
  });
};
