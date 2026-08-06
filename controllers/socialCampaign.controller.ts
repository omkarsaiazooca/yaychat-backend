import { SocialCampaignService } from "../services/socialCampaign.service";

const socialCampaignService = new SocialCampaignService();

export class SocialCampaignController {
  constructor() {}

  async requestPresignedUpload(req: any, res: any) {
    try {
      const email = String(req.user?.email || "").trim().toLowerCase();
      const result = await socialCampaignService.requestPresignedUpload({
        email,
        app: req.body?.app,
        mimeType: req.body?.mimeType,
      });

      return res.status(result.status).send(result);
    } catch (err: any) {
      console.error("SocialCampaignController.requestPresignedUpload error:", err);
      return res.status(500).send({ status: 500, data: { message: err?.message || "Unhandled error" } });
    }
  }

  async createSubmission(req: any, res: any) {
    try {
      const email = String(req.user?.email || "").trim().toLowerCase();
      const result = await socialCampaignService.createSubmission({
        email,
        bitcoinyayImageKeys: req.body?.bitcoinyayImageKeys,
        emmmImageKeys: req.body?.emmmImageKeys,
      });

      return res.status(result.status).send(result);
    } catch (err: any) {
      console.error("SocialCampaignController.createSubmission error:", err);
      return res.status(500).send({ status: 500, data: { message: err?.message || "Unhandled error" } });
    }
  }

  async getMySubmission(req: any, res: any) {
    try {
      const email = String(req.user?.email || "").trim().toLowerCase();
      const result = await socialCampaignService.getMySubmission({ email });

      return res.status(result.status).send(result);
    } catch (err: any) {
      console.error("SocialCampaignController.getMySubmission error:", err);
      return res.status(500).send({ status: 500, data: { message: err?.message || "Unhandled error" } });
    }
  }

  async listSubmissions(req: any, res: any) {
    try {
      const result = await socialCampaignService.listSubmissions({
        status: req.query?.status,
        email: req.query?.email,
        page: Number(req.query?.page),
        limit: Number(req.query?.limit),
      });

      return res.status(result.status).send(result);
    } catch (err: any) {
      console.error("SocialCampaignController.listSubmissions error:", err);
      return res.status(500).send({ status: 500, data: { message: err?.message || "Unhandled error" } });
    }
  }

  async getSubmission(req: any, res: any) {
    try {
      const result = await socialCampaignService.getSubmissionById(req.params?.id);
      return res.status(result.status).send(result);
    } catch (err: any) {
      console.error("SocialCampaignController.getSubmission error:", err);
      return res.status(500).send({ status: 500, data: { message: err?.message || "Unhandled error" } });
    }
  }

  async approveSubmission(req: any, res: any) {
    try {
      const reviewerEmail = String(req.user?.email || "").trim().toLowerCase();
      const result = await socialCampaignService.approveSubmission(req.params?.id, reviewerEmail);
      return res.status(result.status).send(result);
    } catch (err: any) {
      console.error("SocialCampaignController.approveSubmission error:", err);
      return res.status(500).send({ status: 500, data: { message: err?.message || "Unhandled error" } });
    }
  }

  async rejectSubmission(req: any, res: any) {
    try {
      const reviewerEmail = String(req.user?.email || "").trim().toLowerCase();
      const result = await socialCampaignService.rejectSubmission(
        req.params?.id,
        reviewerEmail,
        req.body?.rejectionReason
      );
      return res.status(result.status).send(result);
    } catch (err: any) {
      console.error("SocialCampaignController.rejectSubmission error:", err);
      return res.status(500).send({ status: 500, data: { message: err?.message || "Unhandled error" } });
    }
  }
}
