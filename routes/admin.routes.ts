import { Router } from "express";
import { AdminController } from "../controllers/adminAPI";
import { OrderController } from "../controllers/orderAPI";
import { MiningController } from "../controllers/miningAPI";
import { MiningStationController } from "../controllers/miningStationAPI";
import { validateAuthHeader, validateAdminRole } from "../helpers/middleware";
import { auditLogMiddleware } from "../services/adminAuditLog.servcie";
import { miningStopQueue } from "../helpers/miningStopScheduler";

const adminRouter: Router = Router();
const adminController: AdminController = new AdminController();
const orderController: OrderController = new OrderController();
const miningController: MiningController = new MiningController();
const miningStationController: MiningStationController = new MiningStationController();

// // Apply the audit log middleware
// adminRouter.use(auditLogMiddleware);

adminRouter.post(
  "/updateIndexxPrice",
  auditLogMiddleware,
  adminController.updateIndexxCoinPrice
);
adminRouter.post("/login", adminController.issueToken);
adminRouter.get("/getAllCaptains", adminController.getAllCaptains);
adminRouter.get("/getAllBTCYMiningUsersCount", adminController.getAllBTCYMiningUsersCount);
adminRouter.get("/newUsersToday", adminController.getBTCYNewUsersToday);
adminRouter.get("/newUsersRange", adminController.getBTCYNewUsersRange);
adminRouter.get("/totalBTCYMined", adminController.getTotalBTCYMined);
adminRouter.get("/btcyMinedRange", adminController.getBTCYMinedRange);
adminRouter.get("/btcyMinedWindows", adminController.getBTCYMinedWindows);
adminRouter.get(
  "/btcy/buy/completed",
  validateAuthHeader,
  adminController.getCompletedBtcyBuyOrders
);
adminRouter.get(
  "/alchemy/config",
  validateAuthHeader,
  adminController.getAlchemyAdminConfig
);
adminRouter.get(
  "/alchemy/sessions",
  validateAuthHeader,
  adminController.getAdminAlchemySessions
);
adminRouter.post(
  "/alchemy/config",
  validateAuthHeader,
  auditLogMiddleware,
  adminController.updateAlchemyAdminConfig
);
adminRouter.get(
  "/sell/config",
  validateAuthHeader,
  adminController.getSellAdminConfig
);
adminRouter.post(
  "/sell/config",
  validateAuthHeader,
  auditLogMiddleware,
  adminController.updateSellAdminConfig
);
adminRouter.get("/getAllBTCYAnalystics", adminController.getActiveAndTotalMiningUsers);
adminRouter.get("/getAllBTCYUsers", adminController.getAllMiiningUsers);
adminRouter.get("/getMiningDetails/:email", adminController.getMiningDetails);
adminRouter.get("/downloadAllBTCYMiningUsersEmails", adminController.downloadAllBTCYMiningUsersEmails);
adminRouter.get("/downloadAllUserEmails", validateAuthHeader, adminController.downloadAllUserEmails);
adminRouter.get("/getAllBTCYSocialPostAirdropRegistrations", adminController.getAllBtcySocialPostAirdropRegistrations);
adminRouter.get(
  "/downloadBTCYSocialPostAirdropRegistrations",
  validateAuthHeader,
  adminController.downloadBtcySocialPostAirdropRegistrations
);
adminRouter.get("/getAllUsers", adminController.getAllUsers);
adminRouter.get("/getAllAdminAuditLog", adminController.getAllAdminAuditLog);
adminRouter.get(
  "/getcaptainpowerpack/:email",
  adminController.getCaptainPowerpackData
);
adminRouter.get(
  "/getAllFiatWithdrawRequests",
  adminController.getAllUsersWithdraws
);
adminRouter.get(
  "/getAllCrytoWithdrawRequests",
  adminController.getAllUsersCryptoWithdraws
);
adminRouter.get(
  "/getAllFiatDepositRequests",
  adminController.getAllUsersFiatDeposits
);
adminRouter.post(
  "/editUserData",
  auditLogMiddleware,
  adminController.editUserData
);
adminRouter.post(
  "/editAffiliateData",
  auditLogMiddleware,
  adminController.editAffiliateData
);
adminRouter.post(
  "/editCommissionData",
  auditLogMiddleware,
  adminController.editCommissionData
);
adminRouter.post(
  "/editStakingData",
  auditLogMiddleware,
  adminController.editStakingData
);
adminRouter.post(
  "/editTransactionHistoryData",
  auditLogMiddleware,
  adminController.editTransactionHistoryData
);
adminRouter.post(
  "/editOrderData",
  auditLogMiddleware,
  adminController.editOrderData
);
adminRouter.post(
  "/editPowerPackData",
  auditLogMiddleware,
  adminController.editPowerPackData
);
adminRouter.post(
  "/addPowerPackData",
  auditLogMiddleware,
  adminController.addPowerPackData
);
adminRouter.post(
  "/updateUserWallet",
  auditLogMiddleware,
  adminController.updateUserWallet
);
adminRouter.get("/getUsersKYC", adminController.getUsersKYCData);
adminRouter.post(
  "/updateUserKYC",
  auditLogMiddleware,
  adminController.updateUserKYC
);
adminRouter.post(
  "/captainbeeinexcommissionpayout",
  auditLogMiddleware,
  adminController.inexCommissionPayout
);
adminRouter.post(
  "/honeybeeinexcommissionpayout",
  auditLogMiddleware,
  adminController.honeyBeeInexCommissionPayout
);
adminRouter.post(
  "/captainbeeusdcommissionpayout",
  auditLogMiddleware,
  adminController.usdCommissionPayout
);
adminRouter.post(
  "/honeybeeusdcommissionpayout",
  auditLogMiddleware,
  adminController.honeyBeeUSDCommissionPayout
);
// Admin starts a lottery
adminRouter.post("/startLottery", adminController.startLottery);
// Admin closes a lottery
adminRouter.post("/closeLottery", adminController.closeLotteryByAdmin);
// Admin declares the winner of a lottery
adminRouter.post("/declareWinner", adminController.declareWinner);
adminRouter.get("/getAllPaypalOrders", adminController.getPaypalOrders)
adminRouter.get("/getAllInvestmentRecords", adminController.getInvestmentRecords)
adminRouter.post("/addNewInvestmentRecord", adminController.addNewInvestment)
adminRouter.post("/acceptCaptainBeeRequest", adminController.acceptCaptainBeeRequest)
adminRouter.get("/getCaptainBeeRequests", adminController.getCaptainBeeRequests)
adminRouter.get("/getMediumPost", adminController.getMediumPosts)
adminRouter.get("/getMediumPostById/:id", adminController.getMediumPostById)
adminRouter.put("/addMediumPost", adminController.addNewMediumPosts)
adminRouter.post("/editMediumPost", adminController.editNewMediumPosts)
adminRouter.post("/addsmartcryptoportfolio", adminController.addSmartCryptoPortfolio)
adminRouter.get("/getAllProfitLogs", adminController.getAllProfitLogs)
adminRouter.get("/miningSubscriptionOrders", orderController.getAllMiningSubscriptionOrders)
adminRouter.get("/miningSubscriptionOrderWeb", orderController.getAllMiningSubscriptionOrderWeb)

// Admin notification routes
adminRouter.get("/notification-templates", adminController.getAdminNotificationTemplates);
adminRouter.post("/send-notification", validateAuthHeader, adminController.sendAdminNotification);
adminRouter.get("/notification-status/:jobId", adminController.getNotificationJobStatus);
adminRouter.get("/notification-jobs", adminController.getNotificationJobHistory);
adminRouter.post("/mining/backfill-6h-ads", validateAuthHeader, async (req, res) => {
  try {

    const {
      coinSymbol = "BTCY",
      from,
      to,
      pageSize = 1000,
      concurrency = 25
    } = req.body || {};

    const fromDate = from ? new Date(from) : new Date(Date.now() - 7 * 24 * 3600 * 1000);
    const toDate = to ? new Date(to) : new Date();

    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
      return res.status(400).json({ message: "Invalid from/to" });
    }

    const { backfillAdWatchedOnly } = await import("..");
    const stats = await backfillAdWatchedOnly({ coinSymbol, from: fromDate, to: toDate, pageSize, concurrency });
    res.status(200).json({ message: "Backfill finished", stats });
  } catch (e: any) {
    console.error("backfill-6h-ads endpoint error:", e);
    res.status(500).json({ message: e?.message || "Internal error" });
  }

});

adminRouter.get("/queues/mining-stop", validateAuthHeader, async (req, res) => {
  try {

    const VALID_STATES = ["waiting", "delayed", "active", "completed", "failed", "paused"] as const;

    const state = String(req.query.state || "delayed").toLowerCase();
    const start = Number.isFinite(+req.query.start!) ? Number(req.query.start) : 0;
    const end = Number.isFinite(+req.query.end!) ? Number(req.query.end) : 49;
    const asc = String(req.query.asc || "false").toLowerCase() === "true";

    const types =
      state === "all"
        ? [...VALID_STATES]
        : (VALID_STATES as readonly string[]).includes(state)
          ? [state]
          : ["delayed"];

    // ✔ getJobCounts() without args returns all counts (avoids tuple/spread issue)
    const counts = await miningStopQueue.getJobCounts();

    // ✔ getJobs accepts a single type or an array; cast to any to satisfy TS across Bull versions
    const jobs = await miningStopQueue.getJobs(types as any, start, end, asc);

    const items = await Promise.all(
      jobs.map(async (j: any) => ({
        id: j.id,
        name: j.name ?? null,
        state: await j.getState(),
        timestamp: j.timestamp,            // ms since epoch
        attemptsMade: j.attemptsMade ?? 0,
        progress: typeof j.progress === "function" ? j.progress() : j.progress,
        data: j.data,                      // { email, coin, cycleStart, step }
        opts: {
          jobId: j.opts?.jobId ?? null,
          delay: j.opts?.delay ?? 0,       // ✔ use opts.delay (TS-safe)
          attempts: j.opts?.attempts ?? 0,
          backoff: j.opts?.backoff ?? null,
          removeOnComplete: j.opts?.removeOnComplete ?? false,
          removeOnFail: j.opts?.removeOnFail ?? false,
        },
        returnvalue: j.returnvalue ?? null,
        failedReason: j.failedReason ?? null,
      }))
    );

    res.json({
      queue: "mining-stop",
      typesRequested: types,
      range: { start, end, asc },
      counts,
      totalReturned: items.length,
      items,
    });
  } catch (e: any) {
    console.error("queue inspector error:", e);
    res.status(500).json({ message: e?.message || "Internal error" });
  }
});
// ── Special Mining Eligibility (per-user 168h no-ad mining) ──────────────────
adminRouter.put("/mining/eligibility", validateAuthHeader, miningController.setMiningEligibility);
adminRouter.get("/mining/eligibility", validateAuthHeader, miningController.listMiningEligibility);
adminRouter.get("/mining/eligibility/:email", validateAuthHeader, miningController.getMiningEligibility);
adminRouter.delete("/mining/eligibility/:email", validateAuthHeader, miningController.removeMiningEligibility);

// Mining Station admin routes — Admin/SuperAdmin only
adminRouter.get("/mining/station/withdrawals", validateAdminRole, (req, res) =>
  miningStationController.getAdminWithdrawalRequests(req, res)
);
adminRouter.put("/mining/station/withdrawals/:id/approve", validateAdminRole, (req, res) =>
  miningStationController.approveWithdrawal(req, res)
);
adminRouter.put("/mining/station/withdrawals/:id/reject", validateAdminRole, (req, res) =>
  miningStationController.rejectWithdrawal(req, res)
);

export const adminRoute = adminRouter;
