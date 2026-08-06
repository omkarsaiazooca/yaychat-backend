import { Request, Response } from "express";
import { MarketingEmailService } from "../services/marketingEmail.service";

const service = new MarketingEmailService();

const getActorEmail = (req: Request) =>
  String((req as any).user?.email || req.body?.email || "").trim().toLowerCase();

const sendError = (res: Response, error: unknown) =>
  res.status(400).json({
    status: 400,
    data: { message: error instanceof Error ? error.message : "Request failed." },
  });

export class MarketingEmailController {
  async importContacts(req: Request, res: Response) {
    try {
      const result = await service.upsertContacts({
        contacts: req.body.contacts || [],
        source: req.body.source,
      });
      res.json({ status: 200, data: result });
    } catch (error) {
      sendError(res, error);
    }
  }

  async startSmtpVerification(req: Request, res: Response) {
    try {
      const job = await service.startSmtpVerification({
        source: req.body.source,
        contactIds: req.body.contactIds,
        createdBy: getActorEmail(req),
      });
      res.json({ status: 200, data: job });
    } catch (error) {
      sendError(res, error);
    }
  }

  async getVerificationJob(req: Request, res: Response) {
    try {
      const job = await service.getVerificationJob(req.params.id);
      res.json({ status: 200, data: job });
    } catch (error) {
      sendError(res, error);
    }
  }

  async listVerificationJobs(req: Request, res: Response) {
    try {
      const jobs = await service.listVerificationJobs(Number(req.query.limit || 20));
      res.json({ status: 200, data: jobs });
    } catch (error) {
      sendError(res, error);
    }
  }

  async cancelVerificationJob(req: Request, res: Response) {
    try {
      const job = await service.cancelVerificationJob(req.params.id);
      res.json({ status: 200, data: job });
    } catch (error) {
      sendError(res, error);
    }
  }

  async listContacts(req: Request, res: Response) {
    try {
      const contacts = await service.listContacts({
        status: req.query.status as string,
        search: req.query.search as string,
        limit: Number(req.query.limit || 100),
      });
      res.json({ status: 200, data: contacts });
    } catch (error) {
      sendError(res, error);
    }
  }

  async createContact(req: Request, res: Response) {
    try {
      const contact = await service.createContact(req.body);
      res.json({ status: 200, data: contact });
    } catch (error) {
      sendError(res, error);
    }
  }

  async updateContact(req: Request, res: Response) {
    try {
      const contact = await service.updateContact(req.params.id, req.body);
      res.json({ status: 200, data: contact });
    } catch (error) {
      sendError(res, error);
    }
  }

  async bulkUpdateContacts(req: Request, res: Response) {
    try {
      const result = await service.bulkUpdateContacts({
        contactIds: req.body.contactIds,
        status: req.body.status,
        addTags: req.body.addTags,
      });
      res.json({ status: 200, data: result });
    } catch (error) {
      sendError(res, error);
    }
  }

  async deleteContacts(req: Request, res: Response) {
    try {
      const result = await service.deleteContacts(req.body.contactIds);
      res.json({ status: 200, data: result });
    } catch (error) {
      sendError(res, error);
    }
  }

  async createTemplate(req: Request, res: Response) {
    try {
      const template = await service.createTemplate({
        name: req.body.name,
        subject: req.body.subject,
        bodyHtml: req.body.bodyHtml,
        type: req.body.type,
        createdBy: getActorEmail(req),
      });
      res.json({ status: 200, data: template });
    } catch (error) {
      sendError(res, error);
    }
  }

  async listTemplates(req: Request, res: Response) {
    try {
      const templates = await service.listTemplates();
      res.json({ status: 200, data: templates });
    } catch (error) {
      sendError(res, error);
    }
  }

  async deleteTemplate(req: Request, res: Response) {
    try {
      const result = await service.deleteTemplate(req.params.id);
      res.json({ status: 200, data: result });
    } catch (error) {
      sendError(res, error);
    }
  }

  async createCampaign(req: Request, res: Response) {
    try {
      const campaign = await service.createCampaign({
        name: req.body.name,
        templateId: req.body.templateId,
        fromEmail: req.body.fromEmail,
        fromName: req.body.fromName,
        subject: req.body.subject,
        contactIds: req.body.contactIds,
        emails: req.body.emails,
        createdBy: getActorEmail(req),
      });
      res.json({ status: 200, data: campaign });
    } catch (error) {
      sendError(res, error);
    }
  }

  async listCampaigns(req: Request, res: Response) {
    try {
      const campaigns = await service.listCampaigns();
      res.json({ status: 200, data: campaigns });
    } catch (error) {
      sendError(res, error);
    }
  }

  async getCampaign(req: Request, res: Response) {
    try {
      const campaign = await service.getCampaign(req.params.id);
      res.json({ status: 200, data: campaign });
    } catch (error) {
      sendError(res, error);
    }
  }

  async sendCampaign(req: Request, res: Response) {
    try {
      const campaign = await service.sendCampaign(req.params.id, Number(req.body.limit || 100));
      res.json({ status: 200, data: campaign });
    } catch (error) {
      sendError(res, error);
    }
  }

  async sendTestEmail(req: Request, res: Response) {
    try {
      const result = await service.sendTestEmail({
        toEmail: req.body.toEmail,
        subject: req.body.subject,
        bodyHtml: req.body.bodyHtml,
        fromEmail: req.body.fromEmail,
        fromName: req.body.fromName,
      });
      res.json({ status: 200, data: result });
    } catch (error) {
      sendError(res, error);
    }
  }

  async unsubscribe(req: Request, res: Response) {
    try {
      const result = await service.unsubscribe(
        String(req.query.email || req.body.email || ""),
        String(req.query.campaignId || req.body.campaignId || "")
      );
      res.json({ status: 200, data: result });
    } catch (error) {
      sendError(res, error);
    }
  }

  async sesWebhook(req: Request, res: Response) {
    try {
      const result = await service.handleSesEvent(req.body);
      res.json({ status: 200, data: result });
    } catch (error) {
      sendError(res, error);
    }
  }
}
