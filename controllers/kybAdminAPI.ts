import { Request, Response } from "express";
import { UserRoleTypes } from "../data/user";
import { UserService } from "../services/user.service";
import { KybApplicationService } from "../services/kybApplication.service";
import { KybDocumentService } from "../services/kybDocument.service";
import { KybAuditLogService } from "../services/kybAuditLog.service";
import { S3KybService } from "../services/s3Kyb.service";
import { KybComplianceService } from "../services/kybCompliance.service";
import { KybDirectorService } from "../services/kybDirector.service";
import { KybUBOService } from "../services/kybUBO.service";
import { KybStatus } from "../data/kybApplication";
import { KybAuditAction, KybAuditActorType } from "../data/kybAuditLog";
import { ComplianceStatus, ComplianceScreeningResult } from "../data/kybCompliance";
import { SendEmail } from "../platform/email.operations";
import { KybTaxInfoService } from "../services/kybTaxInfo.service";

const userService = new UserService();
const kybApplicationService = new KybApplicationService();
const kybDocumentService = new KybDocumentService();
const kybAuditLogService = new KybAuditLogService();
const s3KybService = new S3KybService();
const kybComplianceService = new KybComplianceService();
const kybDirectorService = new KybDirectorService();
const kybUBOService = new KybUBOService();
const kybTaxInfoService = new KybTaxInfoService();

function getEmailFromRequest(req: Request): string | null {
  if ((req.user as any)?.email) {
    return (req.user as any).email;
  }
  const authHeader = req.headers["authorization"];
  if (authHeader && authHeader.startsWith("Bearer ")) {
    try {
      const token = authHeader.split(" ")[1];
      const decoded = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString());
      return decoded.email || null;
    } catch {
      return null;
    }
  }
  return req.body?.email || req.query?.email || null;
}

async function isAdmin(req: Request): Promise<boolean> {
  const role = (req.user as any)?.role;
  if (role === UserRoleTypes.Admin || role === UserRoleTypes.SuperAdmin) {
    return true;
  }
  const email = getEmailFromRequest(req);
  if (!email) return false;
  const user = await userService.findOne({ email });
  if (!user) return false;
  const userRole = (user as any).role;
  return userRole === UserRoleTypes.Admin || userRole === UserRoleTypes.SuperAdmin;
}

export class KYBAdminController {
  constructor() {
    this.listApplications = this.listApplications.bind(this);
    this.getApplicationsByStatus = this.getApplicationsByStatus.bind(this);
    this.getPendingApplications = this.getPendingApplications.bind(this);
    this.getApprovedApplications = this.getApprovedApplications.bind(this);
    this.getRejectedApplications = this.getRejectedApplications.bind(this);
    this.getApplicationDetail = this.getApplicationDetail.bind(this);
    this.getDocumentViewUrl = this.getDocumentViewUrl.bind(this);
    this.approveApplication = this.approveApplication.bind(this);
    this.rejectApplication = this.rejectApplication.bind(this);
    this.needMoreInfo = this.needMoreInfo.bind(this);
    this.runComplianceScreening = this.runComplianceScreening.bind(this);
    this.getComplianceStatus = this.getComplianceStatus.bind(this);
    this.startManualReview = this.startManualReview.bind(this);
    this.completeManualReview = this.completeManualReview.bind(this);
  }

  private async attachPersonDocumentUrls(
    persons: any[],
    context: "director" | "ubo"
  ): Promise<any[]> {
    return Promise.all(
      persons.map(async (person: any) => {
        const plain =
          typeof person?.toObject === "function"
            ? person.toObject()
            : { ...(person as any) };

        const resolvedDocType =
          typeof plain.idDocumentType === "string" && plain.idDocumentType.length > 0
            ? plain.idDocumentType
            : "passport";

        const enriched: any = {
          ...plain,
          idDocumentType: resolvedDocType,
          idDocumentS3Key: plain.idDocumentS3Key || "",
          idDocumentFrontS3Key: plain.idDocumentFrontS3Key || plain.idDocumentS3Key || "",
          idDocumentBackS3Key: plain.idDocumentBackS3Key || "",
          selfieS3Key: plain.selfieS3Key || "",
          idDocumentViewUrl: null as string | null,
          idDocumentFrontViewUrl: null as string | null,
          idDocumentBackViewUrl: null as string | null,
          selfieViewUrl: null as string | null,
        };

        const urlTargets = [
          { keyProp: "idDocumentS3Key", urlProp: "idDocumentViewUrl" },
          { keyProp: "idDocumentFrontS3Key", urlProp: "idDocumentFrontViewUrl" },
          { keyProp: "idDocumentBackS3Key", urlProp: "idDocumentBackViewUrl" },
          { keyProp: "selfieS3Key", urlProp: "selfieViewUrl" },
        ] as const;

        for (const target of urlTargets) {
          const keyVal = enriched[target.keyProp];
          if (!keyVal) continue;
          try {
            enriched[target.urlProp] = await s3KybService.generatePresignedGetUrl(keyVal);
          } catch (error) {
            console.error(`Error generating KYB ${context} document URL ${plain?._id}:`, error);
          }
        }

        return enriched;
      })
    );
  }

  private async formatApplicationWithDocuments(app: any) {
    const applicationId = (app as any)._id?.toString();
    const documents = await kybDocumentService.find({ kybApplicationId: applicationId });

    const documentsWithUrls = await Promise.all(
      documents.map(async (doc: any) => {
        try {
          const url = await s3KybService.generatePresignedGetUrl(doc.s3Key);
          return {
            _id: (doc as any)._id?.toString(),
            type: doc.type,
            mimeType: doc.mimeType,
            fileSize: doc.fileSize,
            s3Key: doc.s3Key,
            viewUrl: url,
            createdAt: doc.createdAt,
          };
        } catch (error) {
          console.error(`Error generating KYB doc URL ${doc._id}:`, error);
          return {
            _id: (doc as any)._id?.toString(),
            type: doc.type,
            mimeType: doc.mimeType,
            fileSize: doc.fileSize,
            s3Key: doc.s3Key,
            viewUrl: null,
            createdAt: doc.createdAt,
          };
        }
      })
    );

    return {
      _id: applicationId,
      userId: app.userId,
      userEmail: app.userEmail || "",
      businessInfo: app.businessInfo || null,
      complianceInfo: app.complianceInfo || null,
      selectedEntityType: app.selectedEntityType || null,
      selectedCountry: app.selectedCountry || null,
      status: app.status,
      levelRequested: app.levelRequested,
      riskScore: app.riskScore,
      rejectionReason: app.rejectionReason,
      documents: documentsWithUrls,
      totalDocuments: documentsWithUrls.length,
      createdAt: app.createdAt,
      updatedAt: app.updatedAt,
    };
  }

  async listApplications(req: Request, res: Response) {
    try {
      if (!(await isAdmin(req))) {
        return res.status(403).json({ status: 403, data: { message: "Forbidden: Admin access required" } });
      }

      const { status, entityType, country, search, page = "1", limit = "20" } = req.query;
      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const skip = (pageNum - 1) * limitNum;

      const query: Record<string, any> = {};
      if (status) query.status = status;
      if (entityType) query.selectedEntityType = entityType;
      if (country) query.selectedCountry = country;
      if (search) {
        query.$or = [
          { userEmail: { $regex: search, $options: "i" } },
          { "businessInfo.legalName": { $regex: search, $options: "i" } },
        ];
      }

      const applications = await kybApplicationService.findPaginatedSkip(limitNum, skip, { createdAt: -1 }, query, {});
      const total = await kybApplicationService.findCount(query);

      const formatted = await Promise.all(applications.map((app: any) => this.formatApplicationWithDocuments(app)));

      return res.status(200).json({
        status: 200,
        data: {
          applications: formatted,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum),
          },
        },
      });
    } catch (error: any) {
      console.error("Error listing KYB applications:", error);
      return res.status(500).json({ status: 500, data: { message: error.message || "Internal server error" } });
    }
  }

  async getApplicationsByStatus(req: Request, res: Response) {
    try {
      if (!(await isAdmin(req))) {
        return res.status(403).json({ status: 403, data: { message: "Forbidden: Admin access required" } });
      }

      const { limit = "100" } = req.query;
      const limitNum = parseInt(limit as string, 10);

      const pending = await kybApplicationService.findPaginated(limitNum, { createdAt: -1 }, { status: KybStatus.PENDING }, {});
      const approved = await kybApplicationService.findPaginated(
        limitNum,
        { createdAt: -1 },
        { status: KybStatus.APPROVED },
        {}
      );
      const rejected = await kybApplicationService.findPaginated(
        limitNum,
        { createdAt: -1 },
        { status: KybStatus.REJECTED },
        {}
      );

      return res.status(200).json({
        status: 200,
        data: {
          pending: {
            total: await kybApplicationService.findCount({ status: KybStatus.PENDING }),
            applications: await Promise.all(pending.map((app: any) => this.formatApplicationWithDocuments(app))),
          },
          approved: {
            total: await kybApplicationService.findCount({ status: KybStatus.APPROVED }),
            applications: await Promise.all(approved.map((app: any) => this.formatApplicationWithDocuments(app))),
          },
          rejected: {
            total: await kybApplicationService.findCount({ status: KybStatus.REJECTED }),
            applications: await Promise.all(rejected.map((app: any) => this.formatApplicationWithDocuments(app))),
          },
        },
      });
    } catch (error: any) {
      console.error("Error getting KYB applications by status:", error);
      return res.status(500).json({ status: 500, data: { message: error.message || "Internal server error" } });
    }
  }

  async getPendingApplications(req: Request, res: Response) {
    try {
      if (!(await isAdmin(req))) {
        return res.status(403).json({ status: 403, data: { message: "Forbidden: Admin access required" } });
      }

      const { page = "1", limit = "100", skip } = req.query;
      const limitRaw = parseInt(limit as string, 10);
      const limitNum = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : 100;
      const pageRaw = parseInt(page as string, 10);
      const pageNum = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;

      const skipValue = Array.isArray(skip) ? skip[0] : skip;
      const skipRaw = typeof skipValue === "string" ? parseInt(skipValue, 10) : NaN;
      const skipNum =
        Number.isFinite(skipRaw) && skipRaw >= 0 ? skipRaw : (pageNum - 1) * limitNum;
      const currentPage = Math.floor(skipNum / limitNum) + 1;

      const query = { status: KybStatus.PENDING };

      const applications = await kybApplicationService.findPaginatedSkip(
        limitNum,
        skipNum,
        { createdAt: -1 },
        query,
        {}
      );
      const total = await kybApplicationService.findCount(query);

      const formatted = await Promise.all(applications.map((app: any) => this.formatApplicationWithDocuments(app)));

      return res.status(200).json({
        status: 200,
        data: {
          applications: formatted,
          pagination: {
            page: currentPage,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum),
          },
        },
      });
    } catch (error: any) {
      console.error("Error getting pending KYB applications:", error);
      return res.status(500).json({ status: 500, data: { message: error.message || "Internal server error" } });
    }
  }

  async getApprovedApplications(req: Request, res: Response) {
    try {
      if (!(await isAdmin(req))) {
        return res.status(403).json({ status: 403, data: { message: "Forbidden: Admin access required" } });
      }

      const { page = "1", limit = "100" } = req.query;
      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const skip = (pageNum - 1) * limitNum;

      const applications = await kybApplicationService.findPaginatedSkip(
        limitNum,
        skip,
        { createdAt: -1 },
        { status: KybStatus.APPROVED },
        {}
      );
      const total = await kybApplicationService.findCount({ status: KybStatus.APPROVED });

      const formatted = await Promise.all(applications.map((app: any) => this.formatApplicationWithDocuments(app)));

      return res.status(200).json({
        status: 200,
        data: {
          applications: formatted,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum),
          },
        },
      });
    } catch (error: any) {
      console.error("Error getting approved KYB applications:", error);
      return res.status(500).json({ status: 500, data: { message: error.message || "Internal server error" } });
    }
  }

  async getRejectedApplications(req: Request, res: Response) {
    try {
      if (!(await isAdmin(req))) {
        return res.status(403).json({ status: 403, data: { message: "Forbidden: Admin access required" } });
      }

      const { page = "1", limit = "100" } = req.query;
      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const skip = (pageNum - 1) * limitNum;

      const applications = await kybApplicationService.findPaginatedSkip(
        limitNum,
        skip,
        { createdAt: -1 },
        { status: KybStatus.REJECTED },
        {}
      );
      const total = await kybApplicationService.findCount({ status: KybStatus.REJECTED });

      const formatted = await Promise.all(applications.map((app: any) => this.formatApplicationWithDocuments(app)));

      return res.status(200).json({
        status: 200,
        data: {
          applications: formatted,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum),
          },
        },
      });
    } catch (error: any) {
      console.error("Error getting rejected KYB applications:", error);
      return res.status(500).json({ status: 500, data: { message: error.message || "Internal server error" } });
    }
  }

  async getApplicationDetail(req: Request, res: Response) {
    try {
      if (!(await isAdmin(req))) {
        return res.status(403).json({ status: 403, data: { message: "Forbidden: Admin access required" } });
      }

      const { id } = req.params;
      const application = await kybApplicationService.findOne({ _id: id });
      if (!application) {
        return res.status(404).json({ status: 404, data: { message: "KYB application not found" } });
      }

      const formatted = await this.formatApplicationWithDocuments(application);
      const [auditLogs, directorRecords, uboRecords, taxInfo, complianceStatus] = await Promise.all([
        kybAuditLogService.findPaginated(10, { createdAt: -1 }, { kybApplicationId: id }, {}),
        kybDirectorService.find({ kybApplicationId: id }),
        kybUBOService.find({ kybApplicationId: id }),
        kybTaxInfoService.findOne({ kybApplicationId: id }),
        kybComplianceService.findOne({ kybApplicationId: id }),
      ]);
      const [directors, ubos] = await Promise.all([
        this.attachPersonDocumentUrls(directorRecords, "director"),
        this.attachPersonDocumentUrls(uboRecords, "ubo"),
      ]);

      return res.status(200).json({
        status: 200,
        data: {
          application: formatted,
          documents: formatted.documents,
          directors,
          ubos,
          taxInfo: taxInfo || null,
          complianceStatus: complianceStatus || null,
          auditLogs: auditLogs.slice(0, 10),
        },
      });
    } catch (error: any) {
      console.error("Error getting KYB application detail:", error);
      return res.status(500).json({ status: 500, data: { message: error.message || "Internal server error" } });
    }
  }

  async getDocumentViewUrl(req: Request, res: Response) {
    try {
      if (!(await isAdmin(req))) {
        return res.status(403).json({ status: 403, data: { message: "Forbidden: Admin access required" } });
      }

      const { documentId } = req.params;
      const document = await kybDocumentService.findOne({ _id: documentId });
      if (!document) {
        return res.status(404).json({ status: 404, data: { message: "Document not found" } });
      }

      const url = await s3KybService.generatePresignedGetUrl(document.s3Key);
      return res.status(200).json({ status: 200, data: { url } });
    } catch (error: any) {
      console.error("Error generating KYB document URL:", error);
      return res.status(500).json({ status: 500, data: { message: error.message || "Internal server error" } });
    }
  }

  async approveApplication(req: Request, res: Response) {
    try {
      if (!(await isAdmin(req))) {
        return res.status(403).json({ status: 403, data: { message: "Forbidden: Admin access required" } });
      }

      const adminEmail = getEmailFromRequest(req);
      if (!adminEmail) {
        return res.status(401).json({ status: 401, data: { message: "Unauthorized - email is required" } });
      }

      const adminUser = await userService.findOne({ email: adminEmail });
      if (!adminUser) {
        return res.status(404).json({ status: 404, data: { message: "Admin user not found" } });
      }
      const adminId = (adminUser as any)._id?.toString();

      const { id } = req.params;
      const { note } = req.body || {};

      const application = await kybApplicationService.findOne({ _id: id });
      if (!application) {
        return res.status(404).json({ status: 404, data: { message: "KYB application not found" } });
      }

      if (![KybStatus.PENDING, KybStatus.UNDER_REVIEW].includes(application.status)) {
        return res.status(400).json({
          status: 400,
          data: { message: "Application can only be approved from pending or under_review status" },
        });
      }

      await kybApplicationService.updatePart(
        { _id: id },
        {
          $set: {
            status: KybStatus.APPROVED,
            rejectionReason: null,
            updatedAt: new Date(),
          },
        }
      );

      // Update User table when KYB is approved
      const userId = (application as any).userId;
      const userEmail = (application as any).userEmail;
      
      console.log(`KYB Approval: Attempting to update user. userId:`, userId, `userEmail:`, userEmail);
      
      // Try to update user by email first (more reliable), then fallback to userId
      let userUpdated = false;
      try {
        // First, try by email (more reliable since it's a string)
        if (userEmail) {
          const emailLower = String(userEmail).toLowerCase().trim();
          console.log(`KYB Approval: Attempting to update user by email: ${emailLower}`);
          
          // Verify user exists first
          const userExists = await userService.findOne({ email: emailLower });
          if (!userExists) {
            console.error(`KYB Approval: User not found with email: ${emailLower}`);
          } else {
            const updateResult = (await userService.updatePart(
              { email: emailLower },
              {
                $set: {
                  kycStatus: "Completed",
                  isKYCPass: true,
                  KYCUpdatedDate: new Date(),
                },
              }
            )) as any;
            
            console.log(`KYB Approval: Update result by email:`, JSON.stringify(updateResult));
            
            // Check if update was successful
            if (updateResult && (updateResult.modifiedCount > 0 || updateResult.acknowledged)) {
              userUpdated = true;
              console.log(`KYB Approval: ✅ Successfully updated user by email ${emailLower}. Modified: ${updateResult.modifiedCount}`);
              
              // Verify the update
              const updatedUser = await userService.findOne({ email: emailLower });
              console.log(`KYB Approval: Verification - User kycStatus: ${(updatedUser as any)?.kycStatus}, isKYCPass: ${(updatedUser as any)?.isKYCPass}`);
            } else {
              console.error(`KYB Approval: ❌ Update by email ${emailLower} returned no modifications. Result:`, updateResult);
            }
          }
        }
        
        // If email update didn't work, try userId as fallback
        if (!userUpdated && userId) {
          const userIdString = userId.toString ? userId.toString() : String(userId);
          console.log(`KYB Approval: Attempting to update user by userId: ${userIdString}`);
          
          const updateResult = (await userService.updatePart(
            { _id: userIdString },
            {
              $set: {
                kycStatus: "Completed",
                isKYCPass: true,
                KYCUpdatedDate: new Date(),
              },
            }
          )) as any;
          
          console.log(`KYB Approval: Update result by userId:`, JSON.stringify(updateResult));
          
          if (updateResult && (updateResult.modifiedCount > 0 || updateResult.acknowledged)) {
            userUpdated = true;
            console.log(`KYB Approval: ✅ Successfully updated user by userId ${userIdString}. Modified: ${updateResult.modifiedCount}`);
          } else {
            console.error(`KYB Approval: ❌ Update by userId ${userIdString} returned no modifications. Result:`, updateResult);
          }
        }
        
        if (!userUpdated) {
          console.error('KYB Approval: ❌ Failed to update user table. userId:', userId, 'userEmail:', userEmail);
        }
      } catch (userUpdateError) {
        console.error('KYB Approval: ❌ Error updating user table:', userUpdateError);
        // Don't fail the request, but log the error
      }

      await kybAuditLogService.create({
        actorId: adminId,
        actorType: KybAuditActorType.ADMIN,
        kybApplicationId: id,
        userId: (application as any).userId?.toString(),
        action: KybAuditAction.KYB_APPROVED,
        note: note || "KYB approved",
        createdAt: new Date(),
      } as any);

      // Send approval email to user
      if (userEmail) {
        try {
          const emailBody = `
            <p>Dear Valued User,</p>
            <p>We are pleased to inform you that your KYB (Know Your Business) application has been <strong>approved</strong>.</p>
            <p>Your business account has been successfully verified and you can now enjoy full access to all platform features.</p>
            ${note ? `<p><strong>Admin Note:</strong> ${note}</p>` : ''}
            <p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>
            <p>Thank you for your patience during the verification process.</p>
            <p>Best regards,<br />The Indexx.ai Team</p>
          `;
          
          await new SendEmail().sendGenericEmail({
            toEmail: userEmail,
            subject: "KYB Application Approved - Indexx.ai",
            bodyContent: emailBody,
            senderName: "Indexx.ai",
            senderEmail: "accounts@indexx.ai",
            replyToEmail: "wallet@indexx.ai",
          });
        } catch (emailError) {
          console.error("Error sending KYB approval email:", emailError);
          // Don't fail the request if email fails
        }
      }

      const updated = await kybApplicationService.findOne({ _id: id });
      return res.status(200).json({ status: 200, data: updated });
    } catch (error: any) {
      console.error("Error approving KYB application:", error);
      return res.status(500).json({ status: 500, data: { message: error.message || "Internal server error" } });
    }
  }

  async rejectApplication(req: Request, res: Response) {
    try {
      if (!(await isAdmin(req))) {
        return res.status(403).json({ status: 403, data: { message: "Forbidden: Admin access required" } });
      }

      const adminEmail = getEmailFromRequest(req);
      if (!adminEmail) {
        return res.status(401).json({ status: 401, data: { message: "Unauthorized - email is required" } });
      }

      const adminUser = await userService.findOne({ email: adminEmail });
      if (!adminUser) {
        return res.status(404).json({ status: 404, data: { message: "Admin user not found" } });
      }
      const adminId = (adminUser as any)._id?.toString();

      const { id } = req.params;
      const { reason } = req.body || {};

      const application = await kybApplicationService.findOne({ _id: id });
      if (!application) {
        return res.status(404).json({ status: 404, data: { message: "KYB application not found" } });
      }

      await kybApplicationService.updatePart(
        { _id: id },
        {
          $set: {
            status: KybStatus.REJECTED,
            rejectionReason: reason || "Rejected by admin",
            updatedAt: new Date(),
          },
        }
      );

      await kybAuditLogService.create({
        actorId: adminId,
        actorType: KybAuditActorType.ADMIN,
        kybApplicationId: id,
        userId: (application as any).userId?.toString(),
        action: KybAuditAction.KYB_REJECTED,
        note: reason || "KYB rejected",
        createdAt: new Date(),
      } as any);

      // Send rejection email to user
      const userEmail = (application as any).userEmail;
      if (userEmail) {
        try {
          const emailBody = `
            <p>Dear Valued User,</p>
            <p>We regret to inform you that your KYB (Know Your Business) application has been <strong>rejected</strong>.</p>
            <p><strong>Reason for rejection:</strong> ${reason || "Rejected by admin"}</p>
            <p>If you believe this is an error or would like to provide additional information, please contact our support team. You may also submit a new application with the required corrections.</p>
            <p>If you have any questions or need assistance, please don't hesitate to contact our support team at <a href="mailto:support@indexx.ai" style="color: #F66036;">support@indexx.ai</a>.</p>
            <p>Thank you for your understanding.</p>
            <p>Best regards,<br />The Indexx.ai Team</p>
          `;
          
          await new SendEmail().sendGenericEmail({
            toEmail: userEmail,
            subject: "KYB Application Rejected - Indexx.ai",
            bodyContent: emailBody,
            senderName: "Indexx.ai",
            senderEmail: "accounts@indexx.ai",
            replyToEmail: "wallet@indexx.ai",
          });
        } catch (emailError) {
          console.error("Error sending KYB rejection email:", emailError);
          // Don't fail the request if email fails
        }
      }

      const updated = await kybApplicationService.findOne({ _id: id });
      return res.status(200).json({ status: 200, data: updated });
    } catch (error: any) {
      console.error("Error rejecting KYB application:", error);
      return res.status(500).json({ status: 500, data: { message: error.message || "Internal server error" } });
    }
  }

  async needMoreInfo(req: Request, res: Response) {
    try {
      if (!(await isAdmin(req))) {
        return res.status(403).json({ status: 403, data: { message: "Forbidden: Admin access required" } });
      }

      const adminEmail = getEmailFromRequest(req);
      if (!adminEmail) {
        return res.status(401).json({ status: 401, data: { message: "Unauthorized - email is required" } });
      }

      const adminUser = await userService.findOne({ email: adminEmail });
      if (!adminUser) {
        return res.status(404).json({ status: 404, data: { message: "Admin user not found" } });
      }
      const adminId = (adminUser as any)._id?.toString();

      const { id } = req.params;
      const { note } = req.body || {};

      const application = await kybApplicationService.findOne({ _id: id });
      if (!application) {
        return res.status(404).json({ status: 404, data: { message: "KYB application not found" } });
      }

      await kybApplicationService.updatePart(
        { _id: id },
        {
          $set: {
            status: KybStatus.NEED_MORE_INFO,
            rejectionReason: note || null,
            updatedAt: new Date(),
          },
        }
      );

      await kybAuditLogService.create({
        actorId: adminId,
        actorType: KybAuditActorType.ADMIN,
        kybApplicationId: id,
        userId: (application as any).userId?.toString(),
        action: KybAuditAction.KYB_NEED_MORE_INFO,
        note: note || "Need more information",
        createdAt: new Date(),
      } as any);

      const updated = await kybApplicationService.findOne({ _id: id });
      return res.status(200).json({ status: 200, data: updated });
    } catch (error: any) {
      console.error("Error requesting more info for KYB application:", error);
      return res.status(500).json({ status: 500, data: { message: error.message || "Internal server error" } });
    }
  }

  /**
   * Step 7: Run compliance screening
   * POST /api/v1/kyb/admin/applications/:id/compliance-screening
   */
  async runComplianceScreening(req: Request, res: Response) {
    try {
      if (!(await isAdmin(req))) {
        return res.status(403).json({ status: 403, data: { message: "Forbidden: Admin access required" } });
      }

      const adminEmail = getEmailFromRequest(req);
      if (!adminEmail) {
        return res.status(401).json({ status: 401, data: { message: "Unauthorized - email is required" } });
      }

      const adminUser = await userService.findOne({ email: adminEmail });
      if (!adminUser) {
        return res.status(404).json({ status: 404, data: { message: "Admin user not found" } });
      }
      const adminId = (adminUser as any)._id?.toString();

      const { id } = req.params;
      const { screeningProvider, notes } = req.body || {};

      const application = await kybApplicationService.findOne({ _id: id });
      if (!application) {
        return res.status(404).json({ status: 404, data: { message: "KYB application not found" } });
      }

      if (application.status !== KybStatus.PENDING && application.status !== KybStatus.UNDER_REVIEW) {
        return res.status(400).json({
          status: 400,
          data: { message: "Compliance screening can only be run on pending or under_review applications" },
        });
      }

      // Get directors and UBOs for screening
      const directors = await kybDirectorService.find({ kybApplicationId: id });
      const ubos = await kybUBOService.find({ kybApplicationId: id });

      // Run business screening
      const businessScreening: ComplianceScreeningResult = {
        status: ComplianceStatus.PASSED, // TODO: Integrate with actual screening service
        screeningDate: new Date(),
        screeningProvider: screeningProvider || "Internal",
        riskLevel: "low", // TODO: Calculate based on screening results
        matches: [],
        notes: notes || "",
        screenedBy: adminEmail,
      };

      // Run directors screening
      const directorsScreening: ComplianceScreeningResult[] = directors.map((director: any) => ({
        status: ComplianceStatus.PASSED, // TODO: Integrate with actual screening service
        screeningDate: new Date(),
        screeningProvider: screeningProvider || "Internal",
        riskLevel: "low",
        matches: [],
        notes: "",
        screenedBy: adminEmail,
      }));

      // Run UBOs screening
      const ubosScreening: ComplianceScreeningResult[] = ubos.map((ubo: any) => ({
        status: ComplianceStatus.PASSED, // TODO: Integrate with actual screening service
        screeningDate: new Date(),
        screeningProvider: screeningProvider || "Internal",
        riskLevel: "low",
        matches: [],
        notes: "",
        screenedBy: adminEmail,
      }));

      // Determine overall status
      const allResults = [businessScreening, ...directorsScreening, ...ubosScreening];
      const hasFailed = allResults.some((r) => r.status === ComplianceStatus.FAILED);
      const hasManualReview = allResults.some((r) => r.status === ComplianceStatus.MANUAL_REVIEW);
      const overallStatus = hasFailed
        ? ComplianceStatus.FAILED
        : hasManualReview
        ? ComplianceStatus.MANUAL_REVIEW
        : ComplianceStatus.PASSED;

      // Check if compliance record exists
      const existingCompliance = await kybComplianceService.findOne({ kybApplicationId: id });
      const userId = (application as any).userId?.toString();

      if (existingCompliance) {
        // Update existing
        await kybComplianceService.updatePart(
          { _id: (existingCompliance as any)._id },
          {
            $set: {
              businessScreening,
              directorsScreening,
              ubosScreening,
              overallStatus,
              requiresManualReview: overallStatus === ComplianceStatus.MANUAL_REVIEW,
              updatedAt: new Date(),
            },
          }
        );
      } else {
        // Create new
        await kybComplianceService.create({
          kybApplicationId: id,
          userId,
          businessScreening,
          directorsScreening,
          ubosScreening,
          overallStatus,
          requiresManualReview: overallStatus === ComplianceStatus.MANUAL_REVIEW,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any);
      }

      // Update application status if screening failed
      if (overallStatus === ComplianceStatus.FAILED) {
        await kybApplicationService.updatePart(
          { _id: id },
          {
            $set: {
              status: KybStatus.REJECTED,
              rejectionReason: "Compliance screening failed",
              updatedAt: new Date(),
            },
          }
        );
      } else if (overallStatus === ComplianceStatus.MANUAL_REVIEW) {
        await kybApplicationService.updatePart(
          { _id: id },
          {
            $set: {
              status: KybStatus.UNDER_REVIEW,
              updatedAt: new Date(),
            },
          }
        );
      }

      await kybAuditLogService.create({
        actorId: adminId,
        actorType: KybAuditActorType.ADMIN,
        kybApplicationId: id,
        userId,
        action: KybAuditAction.COMPLIANCE_SCREENING_RUN,
        note: `Compliance screening completed. Status: ${overallStatus}`,
        createdAt: new Date(),
      } as any);

      const updatedCompliance = await kybComplianceService.findOne({ kybApplicationId: id });

      return res.status(200).json({
        status: 200,
        data: {
          compliance: updatedCompliance,
          applicationStatus: (await kybApplicationService.findOne({ _id: id }))?.status,
        },
      });
    } catch (error: any) {
      console.error("Error running compliance screening:", error);
      return res.status(500).json({ status: 500, data: { message: error.message || "Internal server error" } });
    }
  }

  /**
   * Get compliance status for an application
   * GET /api/v1/kyb/admin/applications/:id/compliance
   */
  async getComplianceStatus(req: Request, res: Response) {
    try {
      if (!(await isAdmin(req))) {
        return res.status(403).json({ status: 403, data: { message: "Forbidden: Admin access required" } });
      }

      const { id } = req.params;

      const application = await kybApplicationService.findOne({ _id: id });
      if (!application) {
        return res.status(404).json({ status: 404, data: { message: "KYB application not found" } });
      }

      const compliance = await kybComplianceService.findOne({ kybApplicationId: id });

      return res.status(200).json({
        status: 200,
        data: compliance || null,
      });
    } catch (error: any) {
      console.error("Error getting compliance status:", error);
      return res.status(500).json({ status: 500, data: { message: error.message || "Internal server error" } });
    }
  }

  /**
   * Step 8: Start manual review
   * POST /api/v1/kyb/admin/applications/:id/manual-review/start
   */
  async startManualReview(req: Request, res: Response) {
    try {
      if (!(await isAdmin(req))) {
        return res.status(403).json({ status: 403, data: { message: "Forbidden: Admin access required" } });
      }

      const adminEmail = getEmailFromRequest(req);
      if (!adminEmail) {
        return res.status(401).json({ status: 401, data: { message: "Unauthorized - email is required" } });
      }

      const adminUser = await userService.findOne({ email: adminEmail });
      if (!adminUser) {
        return res.status(404).json({ status: 404, data: { message: "Admin user not found" } });
      }
      const adminId = (adminUser as any)._id?.toString();

      const { id } = req.params;
      const { reviewNotes } = req.body || {};

      const application = await kybApplicationService.findOne({ _id: id });
      if (!application) {
        return res.status(404).json({ status: 404, data: { message: "KYB application not found" } });
      }

      // Update application status
      await kybApplicationService.updatePart(
        { _id: id },
        {
          $set: {
            status: KybStatus.UNDER_REVIEW,
            updatedAt: new Date(),
          },
        }
      );

      // Update compliance record
      const compliance = await kybComplianceService.findOne({ kybApplicationId: id });
      if (compliance) {
        await kybComplianceService.updatePart(
          { _id: (compliance as any)._id },
          {
            $set: {
              requiresManualReview: true,
              reviewNotes: reviewNotes || "",
              reviewedBy: adminEmail,
              reviewedAt: new Date(),
              updatedAt: new Date(),
            },
          }
        );
      }

      await kybAuditLogService.create({
        actorId: adminId,
        actorType: KybAuditActorType.ADMIN,
        kybApplicationId: id,
        userId: (application as any).userId?.toString(),
        action: KybAuditAction.MANUAL_REVIEW_STARTED,
        note: reviewNotes || "Manual review started",
        createdAt: new Date(),
      } as any);

      const updated = await kybApplicationService.findOne({ _id: id });

      return res.status(200).json({
        status: 200,
        data: updated,
      });
    } catch (error: any) {
      console.error("Error starting manual review:", error);
      return res.status(500).json({ status: 500, data: { message: error.message || "Internal server error" } });
    }
  }

  /**
   * Step 8: Complete manual review
   * POST /api/v1/kyb/admin/applications/:id/manual-review/complete
   */
  async completeManualReview(req: Request, res: Response) {
    try {
      if (!(await isAdmin(req))) {
        return res.status(403).json({ status: 403, data: { message: "Forbidden: Admin access required" } });
      }

      const adminEmail = getEmailFromRequest(req);
      if (!adminEmail) {
        return res.status(401).json({ status: 401, data: { message: "Unauthorized - email is required" } });
      }

      const adminUser = await userService.findOne({ email: adminEmail });
      if (!adminUser) {
        return res.status(404).json({ status: 404, data: { message: "Admin user not found" } });
      }
      const adminId = (adminUser as any)._id?.toString();

      const { id } = req.params;
      const { reviewNotes, reviewDecision } = req.body || {};

      if (!reviewDecision || !["approve", "reject", "need_more_info"].includes(reviewDecision)) {
        return res.status(400).json({
          status: 400,
          data: { message: "reviewDecision is required and must be 'approve', 'reject', or 'need_more_info'" },
        });
      }

      const application = await kybApplicationService.findOne({ _id: id });
      if (!application) {
        return res.status(404).json({ status: 404, data: { message: "KYB application not found" } });
      }

      // Update compliance record
      const compliance = await kybComplianceService.findOne({ kybApplicationId: id });
      if (compliance) {
        await kybComplianceService.updatePart(
          { _id: (compliance as any)._id },
          {
            $set: {
              reviewNotes: reviewNotes || "",
              reviewedBy: adminEmail,
              reviewedAt: new Date(),
              updatedAt: new Date(),
            },
          }
        );
      }

      // Update application based on review decision
      let newStatus: KybStatus;
      if (reviewDecision === "approve") {
        newStatus = KybStatus.APPROVED;
        await kybApplicationService.updatePart(
          { _id: id },
          {
            $set: {
              status: newStatus,
              rejectionReason: null,
              updatedAt: new Date(),
            },
          }
        );
      } else if (reviewDecision === "reject") {
        newStatus = KybStatus.REJECTED;
        await kybApplicationService.updatePart(
          { _id: id },
          {
            $set: {
              status: newStatus,
              rejectionReason: reviewNotes || "Rejected after manual review",
              updatedAt: new Date(),
            },
          }
        );
      } else {
        newStatus = KybStatus.NEED_MORE_INFO;
        await kybApplicationService.updatePart(
          { _id: id },
          {
            $set: {
              status: newStatus,
              rejectionReason: reviewNotes || null,
              updatedAt: new Date(),
            },
          }
        );
      }

      await kybAuditLogService.create({
        actorId: adminId,
        actorType: KybAuditActorType.ADMIN,
        kybApplicationId: id,
        userId: (application as any).userId?.toString(),
        action: KybAuditAction.MANUAL_REVIEW_COMPLETED,
        note: `Manual review completed. Decision: ${reviewDecision}. ${reviewNotes || ""}`,
        createdAt: new Date(),
      } as any);

      const updated = await kybApplicationService.findOne({ _id: id });

      return res.status(200).json({
        status: 200,
        data: updated,
      });
    } catch (error: any) {
      console.error("Error completing manual review:", error);
      return res.status(500).json({ status: 500, data: { message: error.message || "Internal server error" } });
    }
  }
}


