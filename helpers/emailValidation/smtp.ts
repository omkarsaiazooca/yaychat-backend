/**
 * Best-effort SMTP probing (the slow, port-25 pass).
 *
 * Opens at most one SMTP session against a domain's mail servers and, in that
 * single session, checks deliverability of the target address (RCPT TO) and
 * whether the domain is a catch-all (accepts a random nonexistent address too).
 *
 * READ BEFORE TRUSTING OUTPUT:
 *  - Requires outbound port 25. When it's blocked (many cloud VMs/CI), every
 *    SMTP field comes back null ("unknown"), NOT false.
 *  - Large providers (Gmail/Outlook/Yahoo) frequently accept-all at SMTP and
 *    bounce later — treat is_deliverable/is_catch_all for those as low-confidence.
 *
 * Node has no built-in SMTP client, so this implements the minimal
 * connect → HELO → MAIL FROM → RCPT TO conversation over a raw socket, which
 * is the faithful equivalent of the reference's smtplib usage.
 */

import net from "net";
import { randomBytes } from "crypto";
import type { DomainThrottler } from "./throttle";
import type { SmtpProbeResult } from "./types";

interface SmtpConnectionOptions {
  host: string;
  port: number;
  timeoutMs: number;
}

class SmtpConnection {
  private socket: net.Socket | null = null;
  private buffer = "";
  private pending: { resolve: (r: SmtpReply) => void; reject: (e: Error) => void } | null = null;
  private replyQueue: SmtpReply[] = [];

  constructor(private readonly opts: SmtpConnectionOptions) {}

  connect(): Promise<SmtpReply> {
    return new Promise((resolve, reject) => {
      const socket = net.createConnection({ host: this.opts.host, port: this.opts.port });
      this.socket = socket;
      socket.setTimeout(this.opts.timeoutMs);
      socket.setEncoding("utf8");

      const onError = (err: Error) => {
        if (this.pending) {
          this.pending.reject(err);
          this.pending = null;
        } else {
          reject(err);
        }
      };
      socket.on("error", onError);
      socket.on("timeout", () => onError(new Error("SMTP socket timed out")));
      socket.on("data", (chunk: string) => this.onData(chunk));

      // The greeting (220) is the first "reply" — waitFor picks it up.
      this.waitFor().then(resolve, reject);
    });
  }

  private onData(chunk: string) {
    this.buffer += chunk;
    let idx: number;
    // SMTP replies end with CRLF; a reply can span multiple lines where all
    // but the last use "code-" and the final uses "code " (space).
    while ((idx = this.buffer.indexOf("\n")) !== -1) {
      const line = this.buffer.slice(0, idx).replace(/\r$/, "");
      this.buffer = this.buffer.slice(idx + 1);
      this.collectLine(line);
    }
  }

  private lineAccumulator: string[] = [];
  private collectLine(line: string) {
    this.lineAccumulator.push(line);
    // Continuation lines look like "250-text"; the terminating line is "250 text".
    const isFinal = /^\d{3} /.test(line) || !/^\d{3}[- ]/.test(line);
    if (isFinal) {
      const codeMatch = /^(\d{3})/.exec(this.lineAccumulator[this.lineAccumulator.length - 1]);
      const code = codeMatch ? Number(codeMatch[1]) : 0;
      const message = this.lineAccumulator.join("\n");
      this.lineAccumulator = [];
      const reply: SmtpReply = { code, message };
      if (this.pending) {
        this.pending.resolve(reply);
        this.pending = null;
      } else {
        this.replyQueue.push(reply);
      }
    }
  }

  private waitFor(): Promise<SmtpReply> {
    const queued = this.replyQueue.shift();
    if (queued) return Promise.resolve(queued);
    return new Promise((resolve, reject) => {
      this.pending = { resolve, reject };
    });
  }

  async command(line: string): Promise<SmtpReply> {
    if (!this.socket) throw new Error("SMTP socket not connected");
    this.socket.write(line + "\r\n");
    return this.waitFor();
  }

  close() {
    try {
      this.socket?.destroy();
    } catch {
      /* ignore */
    }
    this.socket = null;
  }
}

interface SmtpReply {
  code: number;
  message: string;
}

const emptyProbe = (): SmtpProbeResult => ({
  canConnectSmtp: null,
  isDeliverable: null,
  isCatchAll: null,
  hasInboxFull: null,
  isDisabled: null,
  notes: [],
});

async function probeAgainstHost(
  host: string,
  domain: string,
  targetEmail: string,
  mailFrom: string,
  heloDomain: string,
  timeoutMs: number,
  result: SmtpProbeResult
): Promise<boolean> {
  const conn = new SmtpConnection({ host, port: 25, timeoutMs });
  try {
    await conn.connect(); // greeting
    result.canConnectSmtp = true;
    await conn.command(`HELO ${heloDomain}`);
    await conn.command(`MAIL FROM:<${mailFrom}>`);

    const rcpt = await conn.command(`RCPT TO:<${targetEmail}>`);
    const msg = rcpt.message.toLowerCase();
    result.isDeliverable = rcpt.code === 250;

    if ([450, 451, 452].includes(rcpt.code) || /mailbox full|over quota|quota exceeded/.test(msg)) {
      result.hasInboxFull = true;
    } else if (result.isDeliverable !== null) {
      result.hasInboxFull = false;
    }

    if (/disabled|inactive|suspended|account has been closed/.test(msg)) {
      result.isDisabled = true;
    } else if (result.isDeliverable !== null) {
      result.isDisabled = false;
    }

    // Catch-all probe: RCPT TO a random, near-certainly-nonexistent address.
    const randomLocal = "verify-check-" + randomBytes(6).toString("hex");
    const probe = await conn.command(`RCPT TO:<${randomLocal}@${domain}>`);
    result.isCatchAll = probe.code === 250;
    if (result.isCatchAll) {
      result.notes.push(
        "Domain accepted a random, almost-certainly-invalid address too (catch-all) — treat is_deliverable for this domain as low-confidence."
      );
    }

    try {
      await conn.command("QUIT");
    } catch {
      /* ignore */
    }
    return true;
  } catch (err: any) {
    result.notes.push(`SMTP probe against ${host} failed: ${err?.message || err}`);
    return false;
  } finally {
    conn.close();
  }
}

export async function smtpProbe(
  domain: string,
  mxHosts: string[],
  targetEmail: string,
  opts: { mailFrom?: string; timeoutMs?: number; throttler?: DomainThrottler } = {}
): Promise<SmtpProbeResult> {
  const mailFrom = opts.mailFrom || "verify@example.com";
  const timeoutMs = opts.timeoutMs ?? 10000;
  const result = emptyProbe();

  if (!mxHosts.length) {
    result.notes.push("No MX hosts available; skipped SMTP probe.");
    return result;
  }

  const heloDomain = mailFrom.includes("@") ? mailFrom.split("@").pop()! : "example.com";

  const doProbe = async () => {
    for (const host of mxHosts) {
      const ok = await probeAgainstHost(host, domain, targetEmail, mailFrom, heloDomain, timeoutMs, result);
      if (ok) break;
    }
  };

  if (opts.throttler) {
    await opts.throttler.run(domain, doProbe);
  } else {
    await doProbe();
  }

  if (result.canConnectSmtp === null) {
    result.notes.push(
      "Could not connect to any MX host on port 25. This is commonly caused by outbound port 25 being blocked (typical for cloud VMs, CI runners, and many consumer ISPs), not necessarily a problem with the target address."
    );
  }

  return result;
}
