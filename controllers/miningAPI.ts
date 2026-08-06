import { MiningOperations } from "../platform/mining.operations";
import { UserService } from "../services/user.service";
import { MiningStreakService } from "../services/miningStreak.service";
import { NuggetTransferService } from "../services/nuggetTransfer.service";

const uservice: UserService = new UserService();
const miningStreakService: MiningStreakService = new MiningStreakService();
const nuggetTransferService: NuggetTransferService = new NuggetTransferService();

const miningOperations = new MiningOperations();
export class MiningController {
  constructor() { }

  async startMining(req: any, res: any) {
    try {
      let results = await miningOperations.startMining(req, res);
      res.status(results.status).send(results);
      return;
    } catch (err) {
      res
        .status(500)
        .send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
    return;
  }

  async stopMining(req: any, res: any) {
    try {
      let results = await miningOperations.stopMining(req, res);
      res.status(results.status).send(results);
      return;
    } catch (err) {
      res
        .status(500)
        .send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
    return;
  }

  async claimMiningRewards(req: any, res: any) {
    try {
      let results = await miningOperations.claimMiningRewards(req, res);
      res.status(results.status).send(results);
      return;
    } catch (err) {
      res
        .status(500)
        .send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
    return;
  }

  async getMiningStatus(req: any, res: any) {
    try {
      let results = await miningOperations.getMiningStatus(req, res);
      res.status(results.status).send(results);
      return;
    } catch (err) {
      res
        .status(500)
        .send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
    return;
  }

  async getMiningDetails(req: any, res: any) {
    try {
      const { email } = req.params;
      if (!email) {
        res.status(400).send({ status: 400, data: { message: "Email is required" } });
        return;
      }

      // check if email is registered
      let user = await uservice.findOneSelect({ email: email }, { email: 1, _id: 1 });
      if (!user) {
        res.status(400).send({ status: 400, data: { message: "Email is not registered" } });
        return;
      }

      let results = await miningOperations.getMiningDetails(req, res);
      res.status(results.status).send(results);
      return;
    } catch (err) {
      res
        .status(500)
        .send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
    return;
  }

  async getMiningHistory(req: any, res: any) {
    try {
      const { email } = req.params;
      if (!email) {
        res.status(400).send({ status: 400, data: { message: "Email is required" } });
        return;
      }
      // check if email is registered
      let user = await uservice.findOneSelect({ email: email }, { email: 1, _id: 1 });
      if (!user) {
        res.status(400).send({ status: 400, data: { message: "Email is not registered" } });
        return;
      }

      let results = await miningOperations.getMiningHistory(req, res);
      res.status(results.status).send(results);
      return;
    } catch (err) {
      res
        .status(500)
        .send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
    return;
  }

  async getUserBalance(req: any, res: any) {
    try {
      let results = await miningOperations.getUserBalance(req, res);
      res.status(results.status).send(results);
      return;
    } catch (err) {
      res
        .status(500)
        .send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
    return;
  }

  async getCurrentMiningRewards(req: any, res: any) {
    try {
      let results = await miningOperations.getCurrentMiningRewards(req, res);
      res.status(results.status).send(results);
      return;
    } catch (err) {
      res
        .status(500)
        .send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
    return;
  }

  async getMiningWindowTotals(req: any, res: any) {
    try {
      let results = await miningOperations.getMiningWindowTotals(req, res);
      res.status(results.status).send(results);
      return;
    } catch (err) {
      res
        .status(500)
        .send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
    return;
  }

  async getMiningRewardSummary(req: any, res: any) {
    try {
      const results = await miningOperations.getMiningRewardSummary(req, res);
      res.status(results.status).send(results);
    } catch (err) {
      res.status(500).send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async extendMiningCycle(req: any, res: any) {
    try {
      const results = await miningOperations.extendMiningCycleByAds(req, res);
      res.status(results.status).send(results);
      return;
    } catch (err) {
      res
        .status(500)
        .send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
    return;
  }

  async getMiningStreak(req: any, res: any) {
    try {
      const { email } = req.params;
      if (!email) {
        res.status(400).send({ status: 400, data: { message: "Email is required" } });
        return;
      }
      const user = await uservice.findOneSelect({ email }, { email: 1, _id: 1 });
      if (!user) {
        res.status(400).send({ status: 400, data: { message: "Email is not registered" } });
        return;
      }
      const status = await miningStreakService.getStreakStatus(email);
      res.status(200).send({ status: 200, data: status });
    } catch (err) {
      res.status(500).send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async syncPowerPlans(req: any, res: any) {
    try {
      const results = await miningOperations.syncPowerMiningPlans(req, res);
      res.status(results.status).send(results);
      return;
    } catch (err) {
      console.error("Unhandled error in syncPowerPlans:", err);
      res
        .status(500)
        .send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
    return;
  }

  async submitNuggetTransfer(req: any, res: any) {
    try {
      const authEmail = String(req.user?.email || "").trim().toLowerCase();
      const idempotencyKey = String(
        req.headers?.["idempotency-key"] || req.body?.idempotencyKey || ""
      ).trim();

      const result = await nuggetTransferService.submitTransfer({
        authEmail,
        senderEmail: req.body?.senderEmail,
        recipientEmail: req.body?.recipientEmail,
        amount: Number(req.body?.amount),
        source: req.body?.source,
        client: req.body?.client,
        idempotencyKey,
      });

      return res.status(result.status).send(result);
    } catch (err: any) {
      console.error("MiningController.submitNuggetTransfer error:", err);
      return res.status(500).send({
        status: 500,
        data: { message: err?.message || "Unhandled error" },
      });
    }
  }

  async getNuggetTransferHistory(req: any, res: any) {
    try {
      const authEmail = String(req.user?.email || "").trim().toLowerCase();
      const email = String(req.query?.email || req.params?.email || "").trim().toLowerCase();
      const result = await nuggetTransferService.getTransferHistory(email, authEmail);

      return res.status(result.status).send(result);
    } catch (err: any) {
      console.error("MiningController.getNuggetTransferHistory error:", err);
      return res.status(500).send({
        status: 500,
        data: { message: err?.message || "Unhandled error" },
      });
    }
  }

  async logNuggetTransferAdWatch(req: any, res: any) {
    try {
      const authEmail = String(req.user?.email || "").trim().toLowerCase();
      const result = await nuggetTransferService.logTransferAdWatch({
        authEmail,
        senderEmail: req.body?.senderEmail,
        recipientEmail: req.body?.recipientEmail,
        amount: Number(req.body?.amount),
        source: req.body?.source,
        adId: req.body?.adId,
        watchId: req.body?.watchId,
        secondsWatched: Number(req.body?.secondsWatched || 0),
      });

      return res.status(result.status).send(result);
    } catch (err: any) {
      console.error("MiningController.logNuggetTransferAdWatch error:", err);
      return res.status(500).send({
        status: 500,
        data: { message: err?.message || "Unhandled error" },
      });
    }
  }

  async getNuggetTransferAdStatus(req: any, res: any) {
    try {
      const authEmail = String(req.user?.email || "").trim().toLowerCase();
      const result = await nuggetTransferService.getTransferAdStatus({
        authEmail,
        senderEmail: req.query?.senderEmail,
        recipientEmail: req.query?.recipientEmail,
        amount: Number(req.query?.amount),
        source: req.query?.source,
      });

      return res.status(result.status).send(result);
    } catch (err: any) {
      console.error("MiningController.getNuggetTransferAdStatus error:", err);
      return res.status(500).send({
        status: 500,
        data: { message: err?.message || "Unhandled error" },
      });
    }
  }

  async setMiningEligibility(req: any, res: any) {
    try {
      const results = await miningOperations.setMiningEligibility(req, res);
      res.status(results.status).send(results);
    } catch (err) {
      res.status(500).send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async getMiningEligibility(req: any, res: any) {
    try {
      const results = await miningOperations.getMiningEligibility(req, res);
      res.status(results.status).send(results);
    } catch (err) {
      res.status(500).send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async listMiningEligibility(req: any, res: any) {
    try {
      const results = await miningOperations.listMiningEligibility(req, res);
      res.status(results.status).send(results);
    } catch (err) {
      res.status(500).send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async removeMiningEligibility(req: any, res: any) {
    try {
      const results = await miningOperations.removeMiningEligibility(req, res);
      res.status(results.status).send(results);
    } catch (err) {
      res.status(500).send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }
}
