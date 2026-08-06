import assert from "assert";
import {
  checkSyntax,
  checkDisposable,
  checkFreeEmail,
  checkRoleAccount,
  computeIsSafeToSend,
} from "../../helpers/emailValidation/rules";
import { emptyResult } from "../../helpers/emailValidation/types";

describe("checkSyntax", () => {
  const valid = [
    "user@example.com",
    "first.last@sub.domain.co.uk",
    "a+tag@gmail.com",
    "x_y-z@domain.io",
    "user!#$%&'*+/=?^_`{|}~@example.com",
  ];
  for (const email of valid) {
    it(`accepts ${email}`, () => {
      const r = checkSyntax(email);
      assert.strictEqual(r.isValid, true, `${email} should be valid`);
      assert.ok(r.local && r.domain);
    });
  }

  const invalid = [
    "",
    "no-at-sign.com",
    "@example.com",
    "user@",
    "user@localhost", // no dot in domain
    "user@@example.com",
    "user@exam ple.com",
    "user..name@example.com", // consecutive dots in local
    "user@ex..ample.com", // consecutive dots in domain
    "a".repeat(65) + "@example.com", // local part too long
    "user@" + "d".repeat(250) + ".com", // whole thing > 254
  ];
  for (const email of invalid) {
    it(`rejects ${email.slice(0, 30)}`, () => {
      assert.strictEqual(checkSyntax(email).isValid, false);
    });
  }

  it("splits local and domain", () => {
    const r = checkSyntax("Alice.Smith@Mail.Example.COM");
    assert.strictEqual(r.local, "Alice.Smith");
    assert.strictEqual(r.domain, "Mail.Example.COM");
  });
});

describe("classification lists", () => {
  it("flags disposable domains (case-insensitive)", () => {
    assert.strictEqual(checkDisposable("mailinator.com"), true);
    assert.strictEqual(checkDisposable("Guerrillamail.COM"), true);
    assert.strictEqual(checkDisposable("gmail.com"), false);
  });

  it("supports an extra disposable set", () => {
    const extra = new Set(["mycompany-temp.dev"]);
    assert.strictEqual(checkDisposable("mycompany-temp.dev", extra), true);
    assert.strictEqual(checkDisposable("other.dev", extra), false);
  });

  it("flags free/webmail domains", () => {
    assert.strictEqual(checkFreeEmail("gmail.com"), true);
    assert.strictEqual(checkFreeEmail("outlook.com"), true);
    assert.strictEqual(checkFreeEmail("acme-corp.com"), false);
  });

  it("flags role-account local parts (case-insensitive)", () => {
    assert.strictEqual(checkRoleAccount("admin"), true);
    assert.strictEqual(checkRoleAccount("SUPPORT"), true);
    assert.strictEqual(checkRoleAccount("no-reply"), true);
    assert.strictEqual(checkRoleAccount("alice"), false);
  });
});

describe("computeIsSafeToSend", () => {
  const base = () => {
    const r = emptyResult("user@example.com");
    r.isValidSyntax = true;
    r.isDisposable = false;
    r.mxAcceptsMail = true;
    return r;
  };

  it("is true for a clean, mail-accepting address", () => {
    assert.strictEqual(computeIsSafeToSend(base()), true);
  });

  it("fails on bad syntax", () => {
    const r = base();
    r.isValidSyntax = false;
    assert.strictEqual(computeIsSafeToSend(r), false);
  });

  it("fails on disposable", () => {
    const r = base();
    r.isDisposable = true;
    assert.strictEqual(computeIsSafeToSend(r), false);
  });

  it("fails when the domain accepts no mail (null MX)", () => {
    const r = base();
    r.mxAcceptsMail = false;
    assert.strictEqual(computeIsSafeToSend(r), false);
  });

  it("fails on explicit SMTP rejection / full / disabled", () => {
    for (const key of ["isDeliverable", "hasInboxFull", "isDisabled"] as const) {
      const r = base();
      (r as any)[key] = key === "isDeliverable" ? false : true;
      assert.strictEqual(computeIsSafeToSend(r), false, `${key} should fail`);
    }
  });

  it("does NOT auto-fail role accounts or catch-all domains", () => {
    const r = base();
    r.isRoleAccount = true;
    r.isCatchAll = true;
    assert.strictEqual(computeIsSafeToSend(r), true);
  });

  it("treats unknown SMTP fields (null) as non-blocking", () => {
    const r = base(); // all SMTP fields null
    assert.strictEqual(computeIsSafeToSend(r), true);
  });
});
