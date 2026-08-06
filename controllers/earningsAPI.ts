import { Request, Response } from "express";
import { UserRoleTypes } from "../data/user";
import { MiningStationEarningsService } from "../services/miningStationEarnings.service";

const earningsService = new MiningStationEarningsService();

const isPrivilegedRole = (role: string) =>
  role === UserRoleTypes.Admin ||
  role === UserRoleTypes.SuperAdmin ||
  role === "Admin" ||
  role === "SuperAdmin";

export class EarningsController {
  async getUserEarnings(req: Request, res: Response) {
    try {
      const requesterEmail = String(req.user?.email || "").trim().toLowerCase();
      if (!requesterEmail) {
        return res.status(401).json({ status: 401, data: { message: "Authentication required" } });
      }

      const requestedEmail = String(req.query.email || "").trim().toLowerCase();
      const targetEmail = requestedEmail || requesterEmail;
      const requesterRole = String(req.user?.role || "");

      if (targetEmail !== requesterEmail && !isPrivilegedRole(requesterRole)) {
        return res.status(403).json({ status: 403, data: { message: "Forbidden" } });
      }

      const result = await earningsService.getUserEarnings(targetEmail, {
        range: typeof req.query.range === "string" ? req.query.range : undefined,
        from: typeof req.query.from === "string" ? req.query.from : undefined,
        to: typeof req.query.to === "string" ? req.query.to : undefined,
        timezone: typeof req.query.timezone === "string" ? req.query.timezone : undefined,
      });

      return res.status(result.status).json(result);
    } catch (error: any) {
      console.error("EarningsController.getUserEarnings error:", error);
      return res.status(500).json({ status: 500, data: { message: error?.message || "Internal Server Error" } });
    }
  }

  async getAllUsersEarnings(req: Request, res: Response) {
    try {
      const requesterRole = String(req.user?.role || "");
      if (!isPrivilegedRole(requesterRole)) {
        return res.status(403).json({ status: 403, data: { message: "Forbidden: Admin only" } });
      }

      const result = await earningsService.getAllUsersEarnings({
        range: typeof req.query.range === "string" ? req.query.range : undefined,
        from: typeof req.query.from === "string" ? req.query.from : undefined,
        to: typeof req.query.to === "string" ? req.query.to : undefined,
        timezone: typeof req.query.timezone === "string" ? req.query.timezone : undefined,
        page: typeof req.query.page === "string" ? parseInt(req.query.page) : 0,
        pageSize: typeof req.query.pageSize === "string" ? parseInt(req.query.pageSize) : 100,
      });

      return res.status(result.status).json(result);
    } catch (error: any) {
      console.error("EarningsController.getAllUsersEarnings error:", error);
      return res.status(500).json({ status: 500, data: { message: error?.message || "Internal Server Error" } });
    }
  }

  async getOverview(req: Request, res: Response) {
    try {
      const requesterEmail = String(req.user?.email || "").trim().toLowerCase();
      if (!requesterEmail) {
        return res.status(401).json({
          status: 401,
          data: { message: "Authentication required" },
        });
      }

      const requestedEmail = String(req.query.email || "").trim().toLowerCase();
      const targetEmail = requestedEmail || requesterEmail;
      const requesterRole = String(req.user?.role || "");

      if (targetEmail !== requesterEmail && !isPrivilegedRole(requesterRole)) {
        return res.status(403).json({
          status: 403,
          data: { message: "Forbidden" },
        });
      }

      const result = await earningsService.getOverview(targetEmail, {
        range: typeof req.query.range === "string" ? req.query.range : undefined,
        from: typeof req.query.from === "string" ? req.query.from : undefined,
        to: typeof req.query.to === "string" ? req.query.to : undefined,
        timezone: typeof req.query.timezone === "string" ? req.query.timezone : undefined,
        page: typeof req.query.page === "string" ? parseInt(req.query.page) : 0,
        pageSize: typeof req.query.pageSize === "string" ? parseInt(req.query.pageSize) : 20,
      });

      return res.status(result.status).json(result);
    } catch (error: any) {
      console.error("EarningsController.getOverview error:", error);
      return res.status(500).json({
        status: 500,
        data: { message: error?.message || "Internal Server Error" },
      });
    }
  }
}
