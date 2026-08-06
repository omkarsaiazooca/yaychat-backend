const RAW_EMAILS = [
  "omkar@azooca.com",
  "sunkuomkarsai@gmail.com"
];

export const NOTIFICATION_BETA_EMAILS = new Set(
  RAW_EMAILS.map((email) => email.trim().toLowerCase())
);

export const isNotificationBetaEmail = (email?: string | null): boolean => {
  if (!email) return false;
  return NOTIFICATION_BETA_EMAILS.has(String(email).trim().toLowerCase());
};

