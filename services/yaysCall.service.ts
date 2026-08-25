import { ServiceBase } from "./base";
import callSchema, { CallRecordModel } from "../models/yaysCall";
import {
  CallEndReason,
  CallMedia,
  CallRecord,
  CallStatus,
} from "../data/yaysCalls";

/** How long an unanswered call rings before it is recorded as missed. */
export const RING_TIMEOUT_SECONDS = 45;

/** States a call can still move out of. Anything else is final. */
const LIVE_STATUSES: CallStatus[] = ["ringing", "active"];

const isDuplicateKeyError = (error: any): boolean =>
  error?.code === 11000 || error?.code === 11001;

export class CallAlreadyExistsError extends Error {
  constructor() {
    super("That call has already been placed.");
    this.name = "CallAlreadyExistsError";
  }
}

export class CallNotFoundError extends Error {
  constructor() {
    super("That call is no longer available.");
    this.name = "CallNotFoundError";
  }
}

export class CalleeBusyError extends Error {
  constructor() {
    super("They are already on another call.");
    this.name = "CalleeBusyError";
  }
}

/**
 * The authoritative call lifecycle.
 *
 * Every transition is a conditional update on the current status, so the two
 * devices racing to end a call cannot both write an outcome — the first one
 * wins and the second is told the call was already settled. Without that, a
 * simultaneous hang-up and decline would leave the history row saying whichever
 * write landed last, which is not necessarily what happened.
 */
export class YaysCallService extends ServiceBase<CallRecord, CallRecordModel> {
  constructor() {
    super(callSchema, "YaysCall");
  }

  /** Any call this user is currently ringing on or talking on. */
  async liveCallFor(userLower: string): Promise<CallRecord | null> {
    return (
      (await this.findOne({
        status: { $in: LIVE_STATUSES },
        $or: [{ callerLower: userLower }, { calleeLower: userLower }],
      })) || null
    );
  }

  /**
   * Record an outgoing call.
   *
   * Refuses if the callee is already busy so the ring never reaches someone
   * mid-conversation, and refuses a duplicate `callId` so a retried invite
   * re-uses the existing row instead of forking the lifecycle.
   */
  async place(input: {
    callId: string;
    callerLower: string;
    calleeLower: string;
    media: CallMedia;
  }): Promise<CallRecord> {
    const busy = await this.liveCallFor(input.calleeLower);
    if (busy) {
      throw new CalleeBusyError();
    }

    // If the caller left a call dangling — app killed mid-call — clear it
    // rather than blocking them from ever calling again.
    const stale = await this.liveCallFor(input.callerLower);
    if (stale) {
      await this.settle(stale.callId, "failed", "connection_failed", null);
    }

    try {
      return await this.create({
        callId: input.callId,
        callerLower: input.callerLower,
        calleeLower: input.calleeLower,
        media: input.media,
        status: "ringing",
        durationSeconds: 0,
      } as CallRecord);
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new CallAlreadyExistsError();
      }
      throw error;
    }
  }

  /** Callee answered. Only a ringing call can be accepted. */
  async accept(callId: string, calleeLower: string): Promise<CallRecord> {
    const accepted = await this.findOneUpdate(
      { callId, calleeLower, status: "ringing" },
      { $set: { status: "active", connectedAt: new Date() } },
      { new: true }
    );
    if (!accepted) {
      throw new CallNotFoundError();
    }
    return accepted;
  }

  /**
   * Move a live call to a terminal state and compute talk time.
   *
   * Duration is measured from `connectedAt`, not from when the call was placed,
   * so a 40-second ring that was never answered is a 0-second call.
   */
  async settle(
    callId: string,
    status: Exclude<CallStatus, "ringing" | "active">,
    endReason: CallEndReason,
    endedByLower: string | null
  ): Promise<CallRecord | null> {
    const current = await this.findOne({ callId });
    if (!current || !LIVE_STATUSES.includes(current.status)) {
      return null;
    }

    const endedAt = new Date();
    const durationSeconds = current.connectedAt
      ? Math.max(
          0,
          Math.round((endedAt.getTime() - new Date(current.connectedAt).getTime()) / 1000)
        )
      : 0;

    return this.findOneUpdate(
      { callId, status: { $in: LIVE_STATUSES } },
      { $set: { status, endReason, endedByLower, endedAt, durationSeconds } },
      { new: true }
    );
  }

  /** Either party hung up a connected call. */
  async hangUp(callId: string, byLower: string): Promise<CallRecord | null> {
    return this.settle(callId, "ended", "hangup", byLower);
  }

  async decline(callId: string, byLower: string): Promise<CallRecord | null> {
    return this.settle(callId, "declined", "declined", byLower);
  }

  /** Caller gave up before the callee answered. */
  async cancel(callId: string, byLower: string): Promise<CallRecord | null> {
    return this.settle(callId, "cancelled", "caller_cancelled", byLower);
  }

  /** Ring timeout expired with no answer. */
  async markMissed(callId: string): Promise<CallRecord | null> {
    return this.settle(callId, "missed", "no_answer", null);
  }

  /**
   * Close out calls whose ring expired without either side reporting an
   * outcome — the usual cause is the caller's app being killed mid-ring, which
   * leaves the callee permanently "busy" if nothing sweeps it.
   */
  async expireStaleRings(): Promise<CallRecord[]> {
    const cutoff = new Date(Date.now() - RING_TIMEOUT_SECONDS * 1000);
    const stale = await this.find({ status: "ringing", createdAt: { $lt: cutoff } });
    const settled: CallRecord[] = [];
    for (const call of stale) {
      const row = await this.markMissed(call.callId);
      if (row) {
        settled.push(row);
      }
    }
    return settled;
  }

  async history(userLower: string, limit: number, skip: number): Promise<CallRecord[]> {
    return this.findPaginatedSkip(
      limit,
      skip,
      { createdAt: -1 },
      { $or: [{ callerLower: userLower }, { calleeLower: userLower }] },
      {}
    );
  }

  async byId(callId: string): Promise<CallRecord | null> {
    return (await this.findOne({ callId })) || null;
  }

  /** Calls the user missed and has not seen — drives the Calls tab badge. */
  async missedCountFor(userLower: string, since: Date): Promise<number> {
    return this.findCount({
      calleeLower: userLower,
      status: "missed",
      createdAt: { $gte: since },
    });
  }
}

export const yaysCalls = new YaysCallService();
