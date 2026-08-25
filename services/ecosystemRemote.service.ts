import axios from "axios";

const trimBase = (value: string): string => value.replace(/\/+$/, "");

const EMMM_API_BASE_URL = trimBase(
  process.env.EMMM_API_BASE_URL || "https://test.api.emmm.io"
);
const EMMM_API_ORIGIN = String(
  process.env.EMMM_API_ORIGIN || "https://test.emmm.io"
).trim();
const SHOPERPAL_API_BASE_URL = trimBase(
  process.env.SHOPERPAL_API_BASE_URL || "https://test.api.shoperpal.com"
);

const integrationKey = (product: "emmm" | "shoperpal"): string => {
  const specific =
    product === "emmm"
      ? process.env.EMMM_YAYS_API_KEY
      : process.env.SHOPERPAL_YAYS_API_KEY;
  return String(specific || process.env.YAYS_ECOSYSTEM_API_KEY || "").trim();
};

const fetchSnapshot = async <T>(baseUrl: string, product: "emmm" | "shoperpal", email: string): Promise<T> => {
  const key = integrationKey(product);
  if (!key) throw new Error(`${product.toUpperCase()} ecosystem API key is not configured`);

  const response = await axios.get(`${baseUrl}/api/integrations/yays/snapshot`, {
    params: { email },
    headers: {
      "x-yays-key": key,
      ...(product === "emmm" ? { Origin: EMMM_API_ORIGIN } : {}),
    },
    timeout: 8000,
  });
  return response.data?.data ?? response.data;
};

export const getEmmmSnapshot = (email: string): Promise<any> =>
  fetchSnapshot(EMMM_API_BASE_URL, "emmm", email);

export const getShoperpalSnapshot = (email: string): Promise<any> =>
  fetchSnapshot(SHOPERPAL_API_BASE_URL, "shoperpal", email);
