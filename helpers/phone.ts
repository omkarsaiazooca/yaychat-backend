import { parsePhoneNumberFromString, CountryCode } from "libphonenumber-js";

/**
 * Phone-number normalisation.
 *
 * Every phone number that enters this backend — signup, login, OTP send, OTP
 * verify, contact sync — must pass through here first. The reason is a failure
 * mode that is completely silent otherwise: a member registers as
 * `+923001234567`, later types `0300 1234567`, and the lookup finds nothing.
 * The account exists, the password is right, and the user is simply told their
 * number is not registered. Storing and querying one canonical E.164 form is
 * what makes those the same number.
 *
 * The trunk prefix is the crux — `0300…` in Pakistan, `07…` in the UK, `09…`
 * in Japan are all national forms whose leading zero is dropped in E.164, and
 * the rules differ per country. That is why this delegates to
 * `libphonenumber-js` instead of a regex.
 */

/** Fallback region for numbers typed without a country code. */
const DEFAULT_REGION = (process.env.YAYS_DEFAULT_PHONE_REGION || "US") as CountryCode;

/**
 * Canonical E.164 (`+923001234567`), or `null` if the input is not a valid
 * dialable number.
 *
 * `null` is deliberate rather than echoing the input back: writing an
 * unparseable string into the phone field creates exactly the duplicate-account
 * problem this module exists to prevent.
 */
export const toE164 = (
  value: unknown,
  region?: string | null
): string | null => {
  const raw = String(value || "").trim();
  if (!raw) {
    return null;
  }
  const parsed = parsePhoneNumberFromString(
    raw,
    (region ? (region.toUpperCase() as CountryCode) : undefined) || DEFAULT_REGION
  );
  if (!parsed || !parsed.isValid()) {
    return null;
  }
  return parsed.number;
};

/**
 * Normalise for storage/lookup, falling back to a digits-only form.
 *
 * Used on read paths that must still find legacy rows written before
 * normalisation existed. Write paths should use `toE164` and reject `null`.
 */
export const normalizePhoneLoose = (value: unknown, region?: string | null): string => {
  const e164 = toE164(value, region);
  if (e164) {
    return e164;
  }
  const digits = String(value || "").replace(/[^\d+]/g, "");
  return digits.startsWith("+") ? digits : digits ? `+${digits}` : "";
};

/**
 * Every stored form a number might already exist under.
 *
 * Rows written before normalisation can hold the raw string, a spaced form, or
 * a national form — so lookups match on the set rather than on one value, and
 * an existing member is never told their number is unregistered.
 */
export const phoneLookupVariants = (value: unknown, region?: string | null): string[] => {
  const raw = String(value || "").trim();
  const variants = new Set<string>();
  if (raw) {
    variants.add(raw);
    variants.add(raw.replace(/[\s()-]/g, ""));
  }
  const e164 = toE164(value, region);
  if (e164) {
    variants.add(e164);
    // The same number without the `+`, which some older clients sent.
    variants.add(e164.slice(1));
    const parsed = parsePhoneNumberFromString(e164);
    if (parsed) {
      variants.add(parsed.nationalNumber as string);
      variants.add(`0${parsed.nationalNumber}`);
    }
  }
  return [...variants].filter(Boolean);
};

/** A Mongo filter that matches any stored form of the number. */
export const phoneQuery = (value: unknown, region?: string | null) => ({
  $in: phoneLookupVariants(value, region),
});

export const isValidPhone = (value: unknown, region?: string | null): boolean =>
  toE164(value, region) !== null;
