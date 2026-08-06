const RAW_EMAILS = [
  "sunkuomkarsai@gmail.com",
  "omkar@azooca.com",
  "sunkuomkarsai5@gmail.com",
  "sunkuomkarsai12121@gmail.com",
  "sunkuomkarsai@outlook.com",
  "omkarsunku@yahoo.com",
  "mounikashetty34@gmail.com",
  "lambert.nabil@doodrops.org",
  "wepan59130@mardiek.com",
  "izac.dinero@dropmeon.com",
  "alidanishriza@gmail.com",
  "britain.teran@dsitip.com",
  "ammanullah60@gmail.com",
  "limiheg538@creteanu.com",
  "sheikh.kashir.sk@gmail.com"
];

const EMAIL_SET = new Set(
  RAW_EMAILS.map((email) => String(email || "").trim().toLowerCase()).filter(Boolean)
);

export function isMiningAdTestEmail(email?: string | null): boolean {
  if (!email) return false;
  return EMAIL_SET.has(String(email).trim().toLowerCase());
}

export function getMiningAdTestEmails(): string[] {
  return Array.from(EMAIL_SET);
}
