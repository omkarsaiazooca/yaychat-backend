/**
 * Static reference data for the email validator, ported verbatim from the
 * reference Python implementation (DEFAULT_DISPOSABLE_DOMAINS etc.).
 *
 * These are a reasonable starting point but WILL go stale. For production use,
 * override/extend the disposable set with a maintained list (e.g. the
 * community "disposable-email-domains" list) via MARKETING_EMAIL_DISPOSABLE_LIST
 * — see loadDomainListFile() and the fast-pass wiring in the service.
 */

export const DEFAULT_DISPOSABLE_DOMAINS: ReadonlySet<string> = new Set([
  "mailinator.com", "guerrillamail.com", "guerrillamail.net", "guerrillamail.org",
  "10minutemail.com", "10minutemail.net", "temp-mail.org", "tempmail.com",
  "throwawaymail.com", "yopmail.com", "yopmail.fr", "trashmail.com", "trashmail.net",
  "sharklasers.com", "dispostable.com", "fakeinbox.com", "getnada.com", "maildrop.cc",
  "moakt.com", "mintemail.com", "mailnesia.com", "mailcatch.com", "spamgourmet.com",
  "getairmail.com", "emailondeck.com", "mytemp.email", "mohmal.com", "tempinbox.com",
  "burnermail.io", "discardmail.com", "spam4.me", "trbvm.com", "einrot.com",
  "fakemailgenerator.com", "mailsac.com", "tempr.email", "20minutemail.com",
  "anonbox.net", "mailnull.com", "noclickemail.com", "spambox.us", "tempmailaddress.com",
  "throwam.com", "jetable.org", "grr.la", "guerrillamailblock.com", "pokemail.net",
  "byom.de", "mytrashmail.com", "mailin8r.com", "sogetthis.com", "spamherelots.com",
]);

export const DEFAULT_FREE_EMAIL_DOMAINS: ReadonlySet<string> = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "yahoo.co.uk", "yahoo.co.in",
  "hotmail.com", "hotmail.co.uk", "outlook.com", "live.com", "msn.com",
  "aol.com", "icloud.com", "me.com", "mac.com", "protonmail.com", "proton.me",
  "gmx.com", "gmx.net", "mail.com", "zoho.com", "yandex.com", "yandex.ru",
  "rediffmail.com", "qq.com", "163.com", "126.com", "sina.com", "naver.com",
  "hey.com", "fastmail.com", "tutanota.com", "inbox.com", "rocketmail.com",
]);

// Note: the reference Python list contained a stray "info@" entry that could
// never match a bare local part; it is dropped here ("info" is already present).
export const DEFAULT_ROLE_ACCOUNT_LOCALPARTS: ReadonlySet<string> = new Set([
  "admin", "administrator", "support", "info", "sales", "contact", "help",
  "noreply", "no-reply", "donotreply", "marketing", "webmaster", "postmaster",
  "hostmaster", "abuse", "security", "billing", "accounts", "jobs", "careers",
  "hr", "office", "team", "feedback", "enquiries", "inquiries", "service",
  "newsletter", "subscribe", "unsubscribe", "root", "mail", "mailer-daemon",
  "list", "majordomo", "bounce", "bounces", "press", "media", "legal",
  "privacy", "compliance", "orders", "returns", "shipping",
]);
