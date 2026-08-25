import { IModel } from "./base";

/**
 * YaysApp — 1:1 audio and video calls.
 *
 * Media is peer-to-peer WebRTC; this backend is only the *signaling* path plus
 * the call record. It never sees audio or video, which is why the model stores
 * timings and outcomes but nothing about content.
 *
 * A call has exactly one authoritative lifecycle here, because two devices can
 * both think they ended it: `ringing → active → ended`, with `declined`,
 * `missed`, `cancelled`, and `failed` as terminal alternatives to `active`.
 */

export type CallMedia = "audio" | "video";

export type CallStatus =
  | "ringing"
  | "active"
  | "ended"
  | "declined"
  | "missed"
  | "cancelled"
  | "failed";

/** Who or what ended the call — drives the label in call history. */
export type CallEndReason =
  | "hangup"
  | "declined"
  | "no_answer"
  | "caller_cancelled"
  | "busy"
  | "connection_failed"
  | "unsupported_client";

export interface CallRecord extends IModel {
  /** Client-generated UUID; also the signaling room name. */
  callId: string;
  callerLower: string;
  calleeLower: string;
  media: CallMedia;
  status: CallStatus;
  /** Set once media actually connected, so ring time is not billed as talk time. */
  connectedAt?: Date | null;
  endedAt?: Date | null;
  /** Seconds between `connectedAt` and `endedAt`; 0 for unanswered calls. */
  durationSeconds: number;
  endReason?: CallEndReason | null;
  /** Which side hung up, when a human did. */
  endedByLower?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * One ICE server as the client expects it.
 *
 * TURN credentials are short-lived and minted per call: a static long-lived
 * TURN password in a shipped app is a relay anyone can bill to you.
 */
export interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface CallConfig {
  /** False when no TURN/STUN is configured; the client then hides calling. */
  enabled: boolean;
  iceServers: IceServer[];
  /** Seconds an unanswered call rings before the server marks it missed. */
  ringTimeoutSeconds: number;
  /** Whether a relay is configured — without one, calls fail behind strict NAT. */
  relayConfigured: boolean;
}
