import { Request, Response } from "express";
import { yaysEcosystem } from "../services/yaysEcosystem.service";

const emailOf = (req: Request): string =>
  String((req as any).user?.email || "").trim().toLowerCase();

const failed = (res: Response, error: any, context: string) => {
  console.error(`[yays/ecosystem] ${context}`, error);
  return res.status(500).json({
    message: "Ecosystem data is unavailable right now.",
    code: "server",
  });
};

/**
 * Read-only ecosystem dashboards.
 *
 * Every response separates what was *read* from what has *no source yet*: a
 * null field means "this backend cannot answer", and the client renders an em
 * dash. That distinction is the whole point of the module — these screens sit
 * next to real balances, so a fabricated figure would read as fact.
 */
export class YaysEcosystemController {
  constructor() {
    // Express drops `this` when handlers are passed as bare references.
    const self = this as any;
    for (const key of Object.getOwnPropertyNames(YaysEcosystemController.prototype)) {
      if (key !== "constructor" && typeof self[key] === "function") {
        self[key] = self[key].bind(this);
      }
    }
  }

  /** Public: which product dashboards this deployment can serve with real data. */
  async getConfig(_req: Request, res: Response) {
    return res.status(200).json({
      data: {
        products: {
          // Backed by mining, nuggets, alchemy pool, and referrals.
          btcy: "live",
          // Buyer side reads real shop orders; supplier state has no source.
          shoperpal: "partial",
          // Only nugget eligibility is knowable here; the game state is EMMM's.
          emmm: "partial",
          // Editorial content, not account state — nothing to read.
          rehuman: "content",
        },
      },
    });
  }

  async getBtcy(req: Request, res: Response) {
    try {
      return res.status(200).json({ data: await yaysEcosystem.btcy(emailOf(req)) });
    } catch (error) {
      return failed(res, error, "btcy");
    }
  }

  async getShoperpal(req: Request, res: Response) {
    try {
      return res
        .status(200)
        .json({ data: await yaysEcosystem.shoperpal(emailOf(req)) });
    } catch (error) {
      return failed(res, error, "shoperpal");
    }
  }

  async getEmmm(req: Request, res: Response) {
    try {
      return res.status(200).json({ data: await yaysEcosystem.emmm(emailOf(req)) });
    } catch (error) {
      return failed(res, error, "emmm");
    }
  }

  async getProfile(req: Request, res: Response) {
    try {
      return res
        .status(200)
        .json({ data: await yaysEcosystem.indexxProfile(emailOf(req)) });
    } catch (error) {
      return failed(res, error, "profile");
    }
  }
}
