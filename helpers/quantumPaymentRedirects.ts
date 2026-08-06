export type QuantumRedirectProvider = "stripe" | "paypal";

const QUANTUM_WEB_PROD_BASE = "https://bitcoinyay.com/quantum-mining";
const QUANTUM_WEB_TEST_BASE = "https://test.bitcoinyay.com/quantum-mining";

const QUANTUM_MOBILE_REDIRECTS: Record<
  QuantumRedirectProvider,
  { successUrl: string; cancelUrl: string }
> = {
  stripe: {
    successUrl:
      process.env.QUANTUM_STRIPE_MOBILE_SUCCESS_URL ||
      "bitcoinyay://payment/success?method=stripe",
    cancelUrl:
      process.env.QUANTUM_STRIPE_MOBILE_CANCEL_URL ||
      "bitcoinyay://payment/cancel?method=stripe",
  },
  paypal: {
    successUrl:
      process.env.QUANTUM_PAYPAL_MOBILE_SUCCESS_URL ||
      "bitcoinyay://payment/success?method=paypal",
    cancelUrl:
      process.env.QUANTUM_PAYPAL_MOBILE_CANCEL_URL ||
      "bitcoinyay://payment/cancel?method=paypal",
  },
};

export function isMobileQuantumSource(source?: string) {
  return String(source || "").toLowerCase() === "mobile";
}

export function getQuantumRedirectUrls(
  provider: QuantumRedirectProvider,
  source?: string,
  env?: string
) {
  if (isMobileQuantumSource(source)) {
    return QUANTUM_MOBILE_REDIRECTS[provider];
  }

  // env comes from the client: "test" → test URL, "main" → prod URL
  const clientEnv = String(env || "").toLowerCase();
  const base = clientEnv === "test" ? QUANTUM_WEB_TEST_BASE : QUANTUM_WEB_PROD_BASE;

  return {
    successUrl:
      process.env.QUANTUM_WEB_SUCCESS_URL ||
      process.env.QUANTUM_STRIPE_SUCCESS_URL ||
      `${base}?status=success`,
    cancelUrl:
      process.env.QUANTUM_WEB_CANCEL_URL ||
      process.env.QUANTUM_STRIPE_CANCEL_URL ||
      `${base}?status=cancel`,
  };
}
