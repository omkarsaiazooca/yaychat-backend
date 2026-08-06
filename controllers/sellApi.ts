import { z } from "zod";
import { UserRoleTypes } from "../data/user";
import {
  createSellBtcyOrder,
  getSellBtcyOrderStatus,
  cancelSellBtcyOrder,
  approveSellOrder,
  completeSellOrderManually,
  getSellBtcyEligibility,
} from "../platform/sell.operation";
import { SellConfigOperations } from "../platform/sellConfig.operations";
import {
  creditTokenForEmmm,
  debitTokenForEmmm,
  getTokenEligibilityForEmmm,
} from "../services/emmmTokenEligibility.service";
import {
  getNuggetEligibilityForEmmm,
  debitNuggetsForEmmm,
} from "../services/emmmNuggetEligibility.service";

const createSellSchema = z.object({
  email: z.string().email(),
  btcyAmount: z.coerce.number().positive(),
  receiveCurrency: z.enum(["USDT", "USDC"]),
  destinationWallet: z.string().min(32),
  network: z.any().optional().transform(() => "binance" as const),
});

const approveSellSchema = z.object({
  orderId: z.string().trim().min(1),
});

const completeSellSchema = z.object({
  orderId: z.string().trim().min(1),
  txHash: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

const cancelSellSchema = z.object({
  orderId: z.string().trim().min(1),
  email: z.string().email().trim().toLowerCase(),
});

function isAdminRequest(req: any) {
  return [UserRoleTypes.Admin, UserRoleTypes.SuperAdmin, "Admin", "SuperAdmin"].includes(
    req.user?.role
  );
}

const emmmTokenSchema = z.enum(["BTCY", "INEX", "WIBS"]);
const emmmDebitCreditSchema = z.object({
  email: z.string().email().trim().toLowerCase(),
  token: emmmTokenSchema.default("BTCY"),
  tokenAmount: z.coerce.number().positive().optional(),
  btcyAmount: z.coerce.number().positive().optional(),
  externalReferenceId: z.string().trim().optional(),
  notes: z.string().trim().optional(),
}).superRefine((data, ctx) => {
  if (data.tokenAmount === undefined && data.btcyAmount === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "tokenAmount or btcyAmount is required",
      path: ["tokenAmount"],
    });
  }
});

const EMMM_API_KEY =
  process.env.INDEXX_EMMM_API_KEY ||
  process.env.EMMM_API_KEY ||
  "";

export class SellBtcyController {
  constructor() {
    this.getConfig = this.getConfig.bind(this);
    this.getEligibility = this.getEligibility.bind(this);
    this.createSellOrder = this.createSellOrder.bind(this);
    this.getOrderStatus = this.getOrderStatus.bind(this);
    this.cancelOrder = this.cancelOrder.bind(this);
    this.approveOrder = this.approveOrder.bind(this);
    this.completeOrder = this.completeOrder.bind(this);
    this.getEmmmEligibility = this.getEmmmEligibility.bind(this);
    this.debitEmmmToken = this.debitEmmmToken.bind(this);
    this.creditEmmmToken = this.creditEmmmToken.bind(this);
    this.getNuggetEligibility = this.getNuggetEligibility.bind(this);
    this.debitNuggets = this.debitNuggets.bind(this);
  }

  private validateEmmmRequest(req: any, res: any) {
    const apiKey = String(req.headers?.["x-emmm-key"] || "").trim();
    if (!EMMM_API_KEY || apiKey !== EMMM_API_KEY) {
      res.status(401).json({
        status: 401,
        data: { message: "Unauthorized EMMM request" },
      });
      return false;
    }
    return true;
  }

  async getConfig(req: any, res: any) {
    try {
      const sellConfigOps = new SellConfigOperations(req, res);
      const result = await sellConfigOps.getPublicConfig(req, res);
      return res.status(result.status).json(result);
    } catch (err) {
      return res
        .status(500)
        .json({ status: 500, data: { message: "Internal Server Error" } });
    }
  }

  async getEligibility(req: any, res: any) {
    try {
      const email = String(req.query.email || req.params.email || "")
        .trim()
        .toLowerCase();

      const parsed = z.string().email().safeParse(email);
      if (!parsed.success) {
        return res.status(400).json({
          status: 400,
          data: { message: "Valid email is required" },
        });
      }

      const result = await getSellBtcyEligibility(parsed.data);
      return res.status(result.status).json(result);
    } catch (err) {
      console.error(err);
      return res
        .status(500)
        .json({ status: 500, data: { message: "Internal Server Error" } });
    }
  }

  async getEmmmEligibility(req: any, res: any) {
    try {
      if (!this.validateEmmmRequest(req, res)) return;

      const email = String(req.query.email || req.params.email || "")
        .trim()
        .toLowerCase();
      const token = String(req.query.token || req.params.token || "BTCY")
        .trim()
        .toUpperCase();

      const emailParsed = z.string().email().safeParse(email);
      const tokenParsed = emmmTokenSchema.safeParse(token);
      if (!emailParsed.success || !tokenParsed.success) {
        return res.status(400).json({
          status: 400,
          data: { message: "Valid email and token are required" },
        });
      }

      const result = await getTokenEligibilityForEmmm({
        email: emailParsed.data,
        token: tokenParsed.data,
      });
      return res.status(200).json({ status: 200, data: result });
    } catch (err: any) {
      console.error(err);
      return res.status(500).json({
        status: 500,
        data: { message: err?.message || "Internal Server Error" },
      });
    }
  }

  async debitEmmmToken(req: any, res: any) {
    try {
      if (!this.validateEmmmRequest(req, res)) return;
      const parsed = emmmDebitCreditSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({
          status: 400,
          data: { message: "Bad request", error: parsed.error.flatten() },
        });
      }

      const tokenAmount = parsed.data.tokenAmount ?? parsed.data.btcyAmount;
      const result = await debitTokenForEmmm({
        email: parsed.data.email,
        token: parsed.data.token,
        tokenAmount: Number(tokenAmount),
        externalReferenceId: parsed.data.externalReferenceId,
        notes: parsed.data.notes,
      });
      return res.status(200).json({ status: 200, data: result });
    } catch (err: any) {
      console.error(err);
      return res.status(500).json({
        status: 500,
        data: { message: err?.message || "Internal Server Error" },
      });
    }
  }

  async creditEmmmToken(req: any, res: any) {
    try {
      if (!this.validateEmmmRequest(req, res)) return;
      const parsed = emmmDebitCreditSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({
          status: 400,
          data: { message: "Bad request", error: parsed.error.flatten() },
        });
      }
      if (!parsed.data.externalReferenceId) {
        return res.status(400).json({
          status: 400,
          data: { message: "externalReferenceId is required for credit" },
        });
      }

      const tokenAmount = parsed.data.tokenAmount ?? parsed.data.btcyAmount;
      const result = await creditTokenForEmmm({
        email: parsed.data.email,
        token: parsed.data.token,
        tokenAmount: Number(tokenAmount),
        externalReferenceId: parsed.data.externalReferenceId,
        notes: parsed.data.notes,
      });
      return res.status(200).json({ status: 200, data: result });
    } catch (err: any) {
      console.error(err);
      return res.status(500).json({
        status: 500,
        data: { message: err?.message || "Internal Server Error" },
      });
    }
  }

  async getNuggetEligibility(req: any, res: any) {
    try {
      if (!this.validateEmmmRequest(req, res)) return;

      const email = String(req.query.email || req.params.email || "")
        .trim()
        .toLowerCase();

      const emailParsed = z.string().email().safeParse(email);
      if (!emailParsed.success) {
        return res.status(400).json({
          status: 400,
          data: { message: "Valid email is required" },
        });
      }

      const result = await getNuggetEligibilityForEmmm({ email: emailParsed.data });
      return res.status(200).json({ status: 200, data: result });
    } catch (err: any) {
      console.error("[nuggetEligibility]", err);
      return res.status(500).json({
        status: 500,
        data: { message: err?.message || "Internal Server Error" },
      });
    }
  }

  async debitNuggets(req: any, res: any) {
    try {
      if (!this.validateEmmmRequest(req, res)) return;

      const parsed = z.object({
        email: z.string().email().trim().toLowerCase(),
        nuggetAmount: z.coerce.number().positive(),
        externalReferenceId: z.string().trim().optional(),
        notes: z.string().trim().optional(),
      }).safeParse(req.body || {});

      if (!parsed.success) {
        return res.status(400).json({
          status: 400,
          data: { message: "Bad request", error: parsed.error.format() },
        });
      }

      const result = await debitNuggetsForEmmm({
        email: parsed.data.email,
        nuggetAmount: parsed.data.nuggetAmount,
        externalReferenceId: parsed.data.externalReferenceId,
        notes: parsed.data.notes,
      });
      return res.status(200).json({ status: 200, data: result });
    } catch (err: any) {
      console.error("[debitNuggets]", err);
      const statusCode = err?.statusCode || (err?.message?.includes("Insufficient") ? 400 : 500);
      return res.status(statusCode).json({
        status: statusCode,
        data: { message: err?.message || "Internal Server Error" },
      });
    }
  }

  async createSellOrder(req: any, res: any) {
    try {
      const parsed = createSellSchema.safeParse(req.body);
      console.log("req.body", req.body);

      if (!parsed.success) {
        return res.status(400).json({
          status: 400,
          data: { message: "Bad request", error: parsed.error.flatten() },
        });
      }
      const result = await createSellBtcyOrder(parsed.data);

      console.log("result", result);

      return res.status(result.status).json(result);
    } catch (err) {
      console.error(err);
      return res
        .status(500)
        .json({ status: 500, data: { message: "Internal Server Error" } });
    }
  }

  async approveOrder(req: any, res: any) {
    try {
      if (!isAdminRequest(req)) {
        return res
          .status(403)
          .json({ status: 403, data: { message: "Admin access required" } });
      }

      const parsed = approveSellSchema.safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ status: 400, data: { message: "Bad request" } });
      }
      const result = await approveSellOrder(parsed.data.orderId);
      return res.status(result.status).json(result);
    } catch (err) {
      return res
        .status(500)
        .json({ status: 500, data: { message: "Approval failed" } });
    }
  }

  async completeOrder(req: any, res: any) {
    try {
      if (!isAdminRequest(req)) {
        return res
          .status(403)
          .json({ status: 403, data: { message: "Admin access required" } });
      }

      const parsed = completeSellSchema.safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ status: 400, data: { message: "Bad request" } });
      }
      const result = await completeSellOrderManually(parsed.data);
      return res.status(result.status).json(result);
    } catch (err) {
      console.error(err);
      return res
        .status(500)
        .json({ status: 500, data: { message: "Complete failed" } });
    }
  }

  async getOrderStatus(req: any, res: any) {
    try {
      const result = await getSellBtcyOrderStatus(req.params.orderId);
      return res.status(result.status).json(result);
    } catch (err) {
      return res.status(500).json({ status: 500, data: { message: "Error" } });
    }
  }

  async cancelOrder(req: any, res: any) {
    try {
      const parsed = cancelSellSchema.safeParse(req.body);
      console.log(parsed);

      if (!parsed.success)
        return res
          .status(400)
          .json({ status: 400, data: { message: "Bad request" } });
      const result = await cancelSellBtcyOrder(
        parsed.data.orderId,
        parsed.data.email
      );
      return res.status(result.status).json(result);
    } catch (err) {
      return res
        .status(500)
        .json({ status: 500, data: { message: "Cancel failed" } });
    }
  }
}
