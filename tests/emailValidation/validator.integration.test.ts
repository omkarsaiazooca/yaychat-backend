import assert from "assert";
import { EventEmitter } from "events";
import dns from "dns";
import net from "net";
import { validateEmail } from "../../helpers/emailValidation";

/**
 * End-to-end validateEmail test with DNS and SMTP fully mocked out — no network.
 * DNS: patch dns.promises.resolveMx to return a fake MX host.
 * SMTP: patch net.createConnection to return a scripted fake socket that plays
 *       an SMTP server whose RCPT TO behavior is configurable per test.
 */

const dnsp: any = dns.promises;
const netAny: any = net;
const originalResolveMx = dnsp.resolveMx;
const originalCreateConnection = netAny.createConnection;

type RcptDecision = (recipient: string) => number; // SMTP status code

class FakeSmtpSocket extends EventEmitter {
  constructor(private rcpt: RcptDecision) {
    super();
    // Greeting after handlers are attached in the same tick.
    setImmediate(() => this.emit("data", "220 mx.fake ESMTP ready\r\n"));
  }
  setTimeout() {}
  setEncoding() {}
  setNoDelay() {}
  write(line: string) {
    const cmd = line.trim();
    setImmediate(() => {
      if (/^HELO|^EHLO/i.test(cmd)) return this.emit("data", "250 mx.fake\r\n");
      if (/^MAIL FROM/i.test(cmd)) return this.emit("data", "250 OK\r\n");
      if (/^RCPT TO:<(.+)>/i.test(cmd)) {
        const recipient = /^RCPT TO:<(.+)>/i.exec(cmd)![1];
        const code = this.rcpt(recipient);
        const text =
          code === 250 ? "250 Accepted" : code >= 500 ? "550 No such user" : "450 Mailbox full";
        return this.emit("data", `${text}\r\n`);
      }
      if (/^QUIT/i.test(cmd)) return this.emit("data", "221 Bye\r\n");
      this.emit("data", "250 OK\r\n");
    });
    return true;
  }
  destroy() {}
  end() {}
}

function installMocks(rcpt: RcptDecision) {
  dnsp.resolveMx = async () => [{ exchange: "mx.fake.test", priority: 10 }];
  netAny.createConnection = () => new FakeSmtpSocket(rcpt) as any;
}

afterEach(() => {
  dnsp.resolveMx = originalResolveMx;
  netAny.createConnection = originalCreateConnection;
});

describe("validateEmail (integration, DNS + SMTP mocked)", () => {
  it("marks a deliverable, non-catch-all address safe to send", async () => {
    // Accept the target, reject the random catch-all probe.
    installMocks((rcpt) => (rcpt.startsWith("verify-check-") ? 550 : 250));
    const r = await validateEmail("real.person@acme-corp.com", {
      doSmtp: true,
      mailFrom: "verify@indexx.ai",
    });

    assert.strictEqual(r.isValidSyntax, true);
    assert.strictEqual(r.mxAcceptsMail, true);
    assert.strictEqual(r.canConnectSmtp, true);
    assert.strictEqual(r.isDeliverable, true);
    assert.strictEqual(r.isCatchAll, false);
    assert.strictEqual(r.isSafeToSend, true);
    assert.strictEqual(r.isSpamtrap, null, "spamtrap is never computed");
  });

  it("detects a catch-all domain (accepts random address too)", async () => {
    installMocks(() => 250); // accept everything
    const r = await validateEmail("someone@catchall-domain.com", {
      doSmtp: true,
      mailFrom: "verify@indexx.ai",
    });
    assert.strictEqual(r.isDeliverable, true);
    assert.strictEqual(r.isCatchAll, true);
    assert.ok(r.notes.some((n) => n.toLowerCase().includes("catch-all")));
  });

  it("marks an SMTP-rejected address undeliverable and not safe", async () => {
    installMocks(() => 550); // reject everything
    const r = await validateEmail("ghost@acme-corp.com", {
      doSmtp: true,
      mailFrom: "verify@indexx.ai",
    });
    assert.strictEqual(r.isDeliverable, false);
    assert.strictEqual(r.isSafeToSend, false);
  });

  it("skips SMTP entirely on the fast pass (doSmtp=false) and leaves SMTP fields unknown", async () => {
    installMocks(() => 250);
    const r = await validateEmail("user@acme-corp.com", { doSmtp: false });
    assert.strictEqual(r.mxAcceptsMail, true);
    assert.strictEqual(r.canConnectSmtp, null);
    assert.strictEqual(r.isDeliverable, null);
  });

  it("never SMTP-probes a disposable address and reports why", async () => {
    installMocks(() => 250);
    const r = await validateEmail("throwaway@mailinator.com", {
      doSmtp: true,
      mailFrom: "verify@indexx.ai",
    });
    assert.strictEqual(r.isDisposable, true);
    assert.strictEqual(r.isSafeToSend, false);
  });
});
