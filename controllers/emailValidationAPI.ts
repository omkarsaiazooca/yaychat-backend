import { UserRoleTypes } from "../data/user";
import axios from "axios";
import { validateEmailWithZeroBounce, getZeroBounceCreditsForAllKeys } from "../helpers/zerobounce";
import { keys } from "../config/keys";
import { EmailValidationService } from "../services/emailValidation.service";
import { UserService } from "../services/user.service";

const emailValidationService = new EmailValidationService();
const userService = new UserService();

const MAX_EMAILS_PER_REQUEST = 100;

const normalizeEmail = (email: string) => String(email || "").trim().toLowerCase();

export async function validateEmailDeliverability(req: any, res: any) {
  try {

    const {
      email,
      emails,
      ipAddress,
      accountIndex,
      saveToUser = true,
      includeRaw = false,
    } = req.body || {};

    const list = Array.isArray(emails) ? emails : (email ? [email] : []);
    if (!list.length) {
      return res.status(400).send({ status: 400, data: "Email is required" });
    }

    if (list.length > MAX_EMAILS_PER_REQUEST) {
      return res.status(400).send({
        status: 400,
        data: `Too many emails. Max ${MAX_EMAILS_PER_REQUEST} per request.`,
      });
    }

    const results: any[] = [];
    for (const item of list) {
      const normalized = normalizeEmail(item);
      if (!normalized || !normalized.includes("@")) {
        results.push({ email: String(item || ""), error: "invalid_email" });
        continue;
      }

      try {
        const { data, accountIndex: usedIndex } = await validateEmailWithZeroBounce(
          normalized,
          {
            ipAddress: ipAddress ? String(ipAddress) : undefined,
            accountIndex: typeof accountIndex === "number"
              ? accountIndex
              : (accountIndex !== undefined ? Number(accountIndex) : undefined),
          }
        );

        const checkedAt = new Date();
        const status = String(data?.status || "");
        const subStatus = String(data?.sub_status || "");
        const didYouMean = data?.did_you_mean ? String(data.did_you_mean) : null;
        const account = data?.account ? String(data.account) : undefined;
        const domain = data?.domain ? String(data.domain) : undefined;

        await emailValidationService.upsertValidation({
          email: normalized,
          provider: "ZeroBounce",
          status,
          subStatus,
          didYouMean,
          account,
          domain,
          checkedAt,
          accountIndex: usedIndex,
          raw: data,
        });

        if (saveToUser) {
          await userService.updatePart(
            { email: normalized },
            {
              $set: {
                "verification.emailDeliverability": {
                  status,
                  subStatus,
                  provider: "ZeroBounce",
                  checkedAt,
                  didYouMean,
                  account,
                  domain,
                },
              },
            }
          );
        }

        results.push({
          email: normalized,
          status,
          subStatus,
          didYouMean,
          account,
          domain,
          provider: "ZeroBounce",
          checkedAt,
          accountIndex: usedIndex,
          ...(includeRaw ? { raw: data } : {}),
        });
      } catch (err: any) {
        const message =
          err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          String(err);
        results.push({ email: normalized, error: message });
      }
    }

    return res.status(200).send({
      status: 200,
      data: {
        count: results.length,
        results,
      },
    });
  } catch (err: any) {
    return res.status(500).send({
      status: 500,
      data: { message: "Unhandled error", error: err?.message || String(err) },
    });
  }
}

export async function getBrevoAccountStatus(req: any, res: any) {
  try {
    const apiKey =
      process.env.BREVO_API_KEY;
    if (!apiKey) {
      return res.status(503).send({
        status: 503,
        data: { message: "Brevo API key not configured" },
      });
    }

    const endpoint =
      String(process.env.BREVO_API_BASE || "https://api.brevo.com/v3").replace(/\/+$/, "") +
      "/account";

    try {
      const { data } = await axios.get(endpoint, {
        headers: { "api-key": apiKey },
        timeout: 15_000,
      });

      return res.status(200).send({
        status: 200,
        data: {
          status: "active",
          account: {
            email: data?.email ?? null,
            companyName: data?.companyName ?? null,
            plan: data?.plan ?? null,
          },
        },
      });
    } catch (err: any) {
      const code = err?.response?.status;
      const message =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        String(err);

      const statusLabel =
        code === 401 || code === 403 ? "suspended" : "unknown";

      return res.status(200).send({
        status: 200,
        data: {
          status: statusLabel,
          error: message,
          httpStatus: code ?? null,
        },
      });
    }
  } catch (err: any) {
    return res.status(500).send({
      status: 500,
      data: { message: "Unhandled error", error: err?.message || String(err) },
    });
  }
}

export async function getZeroBounceCreditsStatus(req: any, res: any) {
  try {
    const results = await getZeroBounceCreditsForAllKeys();
    const totalCredits = results.reduce((sum, r) => sum + (r.credits ?? 0), 0);
    const hasCredits = totalCredits > 0;

    return res.status(200).send({
      status: 200,
      data: {
        hasCredits,
        totalCredits,
        message: hasCredits ? "ok" : "no credits",
        accounts: results,
      },
    });
  } catch (err: any) {
    return res.status(500).send({
      status: 500,
      data: { message: "Failed to fetch ZeroBounce credits", error: err?.message || String(err) },
    });
  }
}
