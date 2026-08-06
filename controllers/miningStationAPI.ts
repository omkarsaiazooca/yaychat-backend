import { Request, Response } from "express";
import { UserRoleTypes } from "../data/user";
import { MiningStationEarningsService } from "../services/miningStationEarnings.service";
import { WithdrawService } from "../services/miningWithdrawRequest.service";

const miningStationService = new MiningStationEarningsService();
const withdrawService = new WithdrawService();

const isPrivilegedRole = (role: string) =>
  role === UserRoleTypes.Admin ||
  role === UserRoleTypes.SuperAdmin ||
  role === "Admin" ||
  role === "SuperAdmin";

const getTargetEmail = (req: Request) => {
  const requesterEmail = String(req.user?.email || "").trim().toLowerCase();
  const requestedEmail = String(req.query.email || "").trim().toLowerCase();
  const targetEmail = requestedEmail || requesterEmail;
  const requesterRole = String(req.user?.role || "");

  return { requesterEmail, requesterRole, targetEmail };
};

const getQueryOptions = (req: Request) => ({
  range: typeof req.query.range === "string" ? req.query.range : undefined,
  from: typeof req.query.from === "string" ? req.query.from : undefined,
  to: typeof req.query.to === "string" ? req.query.to : undefined,
  timezone: typeof req.query.timezone === "string" ? req.query.timezone : undefined,
  page: typeof req.query.page === "string" ? parseInt(req.query.page, 10) : 0,
  pageSize: typeof req.query.pageSize === "string" ? parseInt(req.query.pageSize, 10) : 20,
});

const normalizePagination = (req: Request) => {
  const page = Math.max(0, parseInt(String(req.query.page ?? "0"), 10) || 0);
  const pageSize = Math.min(
    200,
    Math.max(1, parseInt(String(req.query.pageSize ?? "50"), 10) || 50)
  );
  return { page, pageSize };
};

export class MiningStationController {
  async getOverview(req: Request, res: Response) {
    try {
      const { requesterEmail, requesterRole, targetEmail } = getTargetEmail(req);
      if (!requesterEmail) {
        return res.status(401).json({ status: 401, data: { message: "Authentication required" } });
      }

      if (targetEmail !== requesterEmail && !isPrivilegedRole(requesterRole)) {
        return res.status(403).json({ status: 403, data: { message: "Forbidden" } });
      }

      const result = await miningStationService.getStationOverview(targetEmail, getQueryOptions(req));
      return res.status(result.status).json(result);
    } catch (error: any) {
      console.error("MiningStationController.getOverview error:", error);
      return res.status(500).json({ status: 500, data: { message: error?.message || "Internal Server Error" } });
    }
  }

  async getMiners(req: Request, res: Response) {
    try {
      const { requesterEmail, requesterRole, targetEmail } = getTargetEmail(req);
      if (!requesterEmail) {
        return res.status(401).json({ status: 401, data: { message: "Authentication required" } });
      }

      if (targetEmail !== requesterEmail && !isPrivilegedRole(requesterRole)) {
        return res.status(403).json({ status: 403, data: { message: "Forbidden" } });
      }

      const result = await miningStationService.getStationMiners(targetEmail, getQueryOptions(req));
      return res.status(result.status).json(result);
    } catch (error: any) {
      console.error("MiningStationController.getMiners error:", error);
      return res.status(500).json({ status: 500, data: { message: error?.message || "Internal Server Error" } });
    }
  }

  async getAnalytics(req: Request, res: Response) {
    try {
      const { requesterEmail, requesterRole, targetEmail } = getTargetEmail(req);
      if (!requesterEmail) {
        return res.status(401).json({ status: 401, data: { message: "Authentication required" } });
      }

      if (targetEmail !== requesterEmail && !isPrivilegedRole(requesterRole)) {
        return res.status(403).json({ status: 403, data: { message: "Forbidden" } });
      }

      const result = await miningStationService.getStationAnalytics(targetEmail, getQueryOptions(req));
      return res.status(result.status).json(result);
    } catch (error: any) {
      console.error("MiningStationController.getAnalytics error:", error);
      return res.status(500).json({ status: 500, data: { message: error?.message || "Internal Server Error" } });
    }
  }

  async getReferrals(req: Request, res: Response) {
    try {
      const { requesterEmail, requesterRole, targetEmail } = getTargetEmail(req);
      if (!requesterEmail) {
        return res.status(401).json({ status: 401, data: { message: "Authentication required" } });
      }

      if (targetEmail !== requesterEmail && !isPrivilegedRole(requesterRole)) {
        return res.status(403).json({ status: 403, data: { message: "Forbidden" } });
      }

      const result = await miningStationService.getStationReferrals(targetEmail, getQueryOptions(req));
      return res.status(result.status).json(result);
    } catch (error: any) {
      console.error("MiningStationController.getReferrals error:", error);
      return res.status(500).json({ status: 500, data: { message: error?.message || "Internal Server Error" } });
    }
  }

  async getEarnings(req: Request, res: Response) {
    try {
      const { requesterEmail, requesterRole, targetEmail } = getTargetEmail(req);
      if (!requesterEmail) {
        return res.status(401).json({ status: 401, data: { message: "Authentication required" } });
      }

      if (targetEmail !== requesterEmail && !isPrivilegedRole(requesterRole)) {
        return res.status(403).json({ status: 403, data: { message: "Forbidden" } });
      }

      const result = await miningStationService.getStationEarnings(targetEmail, getQueryOptions(req));
      return res.status(result.status).json(result);
    } catch (error: any) {
      console.error("MiningStationController.getEarnings error:", error);
      return res.status(500).json({ status: 500, data: { message: error?.message || "Internal Server Error" } });
    }
  }

  async getWithdrawals(req: Request, res: Response) {
    try {
      const { requesterEmail, requesterRole, targetEmail } = getTargetEmail(req);
      if (!requesterEmail) {
        return res.status(401).json({ status: 401, data: { message: "Authentication required" } });
      }

      if (targetEmail !== requesterEmail && !isPrivilegedRole(requesterRole)) {
        return res.status(403).json({ status: 403, data: { message: "Forbidden" } });
      }

      const result = await miningStationService.getStationWithdrawals(targetEmail, getQueryOptions(req));
      return res.status(result.status).json(result);
    } catch (error: any) {
      console.error("MiningStationController.getWithdrawals error:", error);
      return res.status(500).json({ status: 500, data: { message: error?.message || "Internal Server Error" } });
    }
  }

  async getAdminWithdrawalRequests(req: Request, res: Response) {
    try {
      const requesterEmail = String(req.user?.email || "").trim().toLowerCase();
      if (!requesterEmail) {
        return res.status(401).json({ status: 401, data: { message: "Authentication required" } });
      }

      const { page, pageSize } = normalizePagination(req);
      const query: any = {};
      const email = String(req.query.email || "").trim().toLowerCase();
      const status = String(req.query.status || "").trim();
      const method = String(req.query.method || "").trim();
      const from = String(req.query.from || "").trim();
      const to = String(req.query.to || "").trim();

      if (email) query.email = email;
      if (status) query.status = status;
      if (method) query.withdrawalMethod = method;

      if (from || to) {
        query.createdAt = {};
        if (from) {
          const fromDate = new Date(from);
          if (!Number.isNaN(fromDate.getTime())) query.createdAt.$gte = fromDate;
        }
        if (to) {
          const toDate = new Date(to);
          if (!Number.isNaN(toDate.getTime())) query.createdAt.$lte = toDate;
        }
        if (!Object.keys(query.createdAt).length) delete query.createdAt;
      }

      const [total, rows] = await Promise.all([
        withdrawService.findCount(query),
        withdrawService.findPaginatedSkip(
          pageSize,
          page * pageSize,
          { createdAt: -1 },
          query,
          {}
        ),
      ]);

      return res.status(200).json({
        status: 200,
        data: {
          pagination: {
            page,
            pageSize,
            total,
            totalPages: Math.ceil(total / pageSize),
          },
          withdrawalRequests: (rows || []).map((row: any) => ({
            id: String(row?._id || ""),
            orderId: String(row?.orderId || ""),
            email: String(row?.email || ""),
            requestedAmount: Number(row?.requestedAmountUsd ?? row?.requestedAmount ?? 0),
            approvedAmount: Number(row?.approvedAmountUsd ?? row?.approvedAmount ?? 0),
            requestedAmountUsd: Number(row?.requestedAmountUsd ?? row?.requestedAmount ?? 0),
            approvedAmountUsd: Number(row?.approvedAmountUsd ?? row?.approvedAmount ?? 0),
            payoutAmount: Number(row?.payoutAmount || 0),
            payoutCurrency: String(row?.payoutCurrency || row?.withdrawalMethod || ""),
            feeAmountUsd: Number(row?.feeAmountUsd || 0),
            feePercentage: Number(row?.feePercentage || 0),
            source: String(row?.source || ""),
            status: String(row?.status || ""),
            withdrawalMethod: String(row?.withdrawalMethod || ""),
            walletAddress: String(row?.walletAddress || ""),
            network: String(row?.network || ""),
            createdAt: row?.createdAt || null,
            processedAt: row?.processedAt || null,
            txHash: String(row?.txHash || ""),
          })),
        },
      });
    } catch (error: any) {
      console.error("MiningStationController.getAdminWithdrawalRequests error:", error);
      return res.status(500).json({ status: 500, data: { message: error?.message || "Internal Server Error" } });
    }
  }

  async approveWithdrawal(req: Request, res: Response) {
    try {
      const requestId = String(req.params?.id || "").trim();
      if (!requestId) {
        return res.status(400).json({ status: 400, data: { message: "id is required" } });
      }

      const txHash = String(req.body?.txHash || "").trim();
      const result = await withdrawService.processWithdrawal(requestId, txHash);
      return res.status(result.status).json(result);
    } catch (error: any) {
      console.error("MiningStationController.approveWithdrawal error:", error);
      return res.status(500).json({ status: 500, data: { message: error?.message || "Internal Server Error" } });
    }
  }

  async rejectWithdrawal(req: Request, res: Response) {
    try {
      const requestId = String(req.params?.id || "").trim();
      if (!requestId) {
        return res.status(400).json({ status: 400, data: { message: "id is required" } });
      }

      const reason = String(req.body?.reason || "").trim();
      const result = await withdrawService.rejectWithdrawal(requestId, reason);
      return res.status(result.status).json(result);
    } catch (error: any) {
      console.error("MiningStationController.rejectWithdrawal error:", error);
      return res.status(500).json({ status: 500, data: { message: error?.message || "Internal Server Error" } });
    }
  }

  async submitWithdrawal(req: Request, res: Response) {
    try {
      const requesterEmail = String(req.user?.email || "").trim().toLowerCase();
      if (!requesterEmail) {
        return res.status(401).json({ status: 401, data: { message: "Authentication required" } });
      }

      const result = await miningStationService.submitStationWithdrawal(requesterEmail, {
        amount: Number(req.body?.amount || 0),
        method: req.body?.method,
        walletAddress: req.body?.walletAddress,
        network: req.body?.network,
      });
      return res.status(result.status).json(result);
    } catch (error: any) {
      console.error("MiningStationController.submitWithdrawal error:", error);
      return res.status(500).json({ status: 500, data: { message: error?.message || "Internal Server Error" } });
    }
  }
}
