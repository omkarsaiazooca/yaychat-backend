export const ENFORCE_TEST_GUARD =
  (process.env.NOTIFY_TEST_GUARD ?? "1") === "1"; // toggle with env

export const TEST_TOPIC =
  process.env.NOTIFY_TEST_TOPIC || "test-notifications";

const RAW_ALLOWED = [
  "sunkuomkarsai12121@gmail.com",
  "sunkuomkarsai5@gmail.com",
  "sunkuomkarsai@gmail.com",
  "zainrazzaq2003@gmail.com",
  "zainrazzaq54321@gmail.com",
];

export const TEST_ALLOWED_EMAILS = new Set(
  RAW_ALLOWED.map((e) => e.toLowerCase())
);

export function isTestAllowed(email: string | undefined | null): boolean {
  if (!ENFORCE_TEST_GUARD) return true;
  if (!email) return false;
  return TEST_ALLOWED_EMAILS.has(String(email).toLowerCase());
}
