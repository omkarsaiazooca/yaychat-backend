import assert from "assert";
import dns from "dns";
import { getMxRecords } from "../../helpers/emailValidation/rules";

// getMxRecords calls dns.promises.resolveMx / resolve4. Because rules.ts holds a
// reference to the same dns.promises object, patching its methods here reroutes
// the lookups without any real network/DNS access.
const dnsp: any = dns.promises;
const original = { resolveMx: dnsp.resolveMx, resolve4: dnsp.resolve4 };

function mockDns(opts: { mx?: any; mxError?: any; a?: any; aError?: any }) {
  dnsp.resolveMx = async () => {
    if (opts.mxError) throw opts.mxError;
    return opts.mx;
  };
  dnsp.resolve4 = async () => {
    if (opts.aError) throw opts.aError;
    return opts.a;
  };
}

afterEach(() => {
  dnsp.resolveMx = original.resolveMx;
  dnsp.resolve4 = original.resolve4;
});

const err = (code: string) => Object.assign(new Error(code), { code });

describe("getMxRecords", () => {
  it("returns MX hosts ranked by preference", async () => {
    mockDns({
      mx: [
        { exchange: "mx-backup.example.com.", priority: 20 },
        { exchange: "mx-primary.example.com.", priority: 10 },
      ],
    });
    const notes: string[] = [];
    const hosts = await getMxRecords("example.com", 2000, notes);
    assert.deepStrictEqual(hosts, ["mx-primary.example.com", "mx-backup.example.com"]);
  });

  it("handles the RFC 7505 null MX record (single '.' exchange) as no-mail", async () => {
    mockDns({ mx: [{ exchange: ".", priority: 0 }] });
    const notes: string[] = [];
    const hosts = await getMxRecords("no-mail.example", 2000, notes);
    assert.deepStrictEqual(hosts, []);
    assert.ok(
      notes.some((n) => n.toLowerCase().includes("null mx")),
      "should note the null MX case"
    );
  });

  it("treats an empty-exchange null MX as no-mail too", async () => {
    mockDns({ mx: [{ exchange: "", priority: 0 }] });
    const hosts = await getMxRecords("no-mail.example", 2000, []);
    assert.deepStrictEqual(hosts, []);
  });

  it("returns [] on NXDOMAIN", async () => {
    mockDns({ mxError: err("ENOTFOUND") });
    const notes: string[] = [];
    const hosts = await getMxRecords("does-not-exist.tld", 2000, notes);
    assert.deepStrictEqual(hosts, []);
    assert.ok(notes.some((n) => n.includes("NXDOMAIN")));
  });

  it("falls back to implicit MX (A record) when no MX record exists", async () => {
    mockDns({ mxError: err("ENODATA"), a: ["93.184.216.34"] });
    const notes: string[] = [];
    const hosts = await getMxRecords("a-only.example", 2000, notes);
    assert.deepStrictEqual(hosts, ["a-only.example"]);
    assert.ok(notes.some((n) => n.toLowerCase().includes("implicit mx")));
  });

  it("returns [] when there is neither MX nor A record", async () => {
    mockDns({ mxError: err("ENODATA"), aError: err("ENOTFOUND") });
    const hosts = await getMxRecords("nothing.example", 2000, []);
    assert.deepStrictEqual(hosts, []);
  });
});
