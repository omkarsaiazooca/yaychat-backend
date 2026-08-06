import { Request, Response } from "express";
import { ShoperPalBtcyCreditService } from "../services/shoperpalBtcyCredit.service";

const shoperpalBtcyCreditService = new ShoperPalBtcyCreditService();

export class ShoperPalBtcyNuggetsController {
  async credit(req: Request, res: Response) {
    try {
      const result = await shoperpalBtcyCreditService.credit({
        ...req.body,
        idempotencyKey: req.body?.idempotencyKey || String(req.headers["x-idempotency-key"] || ""),
      });

      return res.status(200).json({
        status: 200,
        data: result,
      });
    } catch (err: any) {
      const message = err?.message || "Unable to credit ShoperPal BTCY Nuggets";
      const status = message === "Indexx user not found" ? 404 : 400;
      return res.status(status).json({ status, message });
    }
  }

  async balance(req: Request, res: Response) {
    try {
      const email = String(req.query.email || "");
      if (!email) return res.status(400).json({ status: 400, message: "Email is required" });

      const result = await shoperpalBtcyCreditService.getBalance(email);
      return res.status(200).json({ status: 200, data: result });
    } catch (err: any) {
      const message = err?.message || "Unable to get ShoperPal BTCY Nuggets balance";
      const status = message === "Indexx user not found" ? 404 : 400;
      return res.status(status).json({ status, message });
    }
  }

  async history(req: Request, res: Response) {
    try {
      const email = String(req.query.email || "");
      if (!email) return res.status(400).json({ status: 400, message: "Email is required" });

      const limit = Number(req.query.limit || 50);
      const result = await shoperpalBtcyCreditService.getHistory(email, limit);
      return res.status(200).json({ status: 200, data: result });
    } catch (err: any) {
      const message = err?.message || "Unable to get ShoperPal BTCY Nuggets history";
      return res.status(400).json({ status: 400, message });
    }
  }
}
