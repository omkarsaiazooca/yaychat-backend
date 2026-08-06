import { Request, Response } from "express";
import { KycApplicationService } from "../services/kycApplication.service";
import { KycDocumentService } from "../services/kycDocument.service";
import { KycAuditLogService } from "../services/kycAuditLog.service";
import { S3KycService } from "../services/s3Kyc.service";
import { UserService } from "../services/user.service";
import { KycStatus } from "../data/kycApplication";
import { KycAuditAction, KycAuditActorType } from "../data/kycAuditLog";
import { UserRoleTypes } from "../data/user";
import { SendEmail } from "../platform/email.operations";

const kycApplicationService = new KycApplicationService();
const kycDocumentService = new KycDocumentService();
const kycAuditLogService = new KycAuditLogService();
const s3KycService = new S3KycService();
const userService = new UserService();

/**
 * Get email from request (for testing - same as user controller)
 */
function getEmailFromRequest(req: Request): string | null {
  // Try from req.user (when auth middleware is active)
  if ((req.user as any)?.email) {
    return (req.user as any).email;
  }

  // Try from body (for testing)
  if (req.body?.email) {
    return req.body.email;
  }

  // Try from query (for GET requests)
  if (req.query?.email) {
    return req.query.email as string;
  }

  // Try to parse JWT token from Authorization header (for testing)
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.split(' ')[1];
      const decoded = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
      if (decoded.email) {
        return decoded.email;
      }
    } catch (e) {
      // Ignore JWT parsing errors
    }
  }

  return null;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildSearchEmailCondition(searchEmail: unknown): any | null {
  if (!searchEmail) {
    return null;
  }

  const rawValue = Array.isArray(searchEmail) ? searchEmail[0] : searchEmail;
  if (typeof rawValue !== "string") {
    return null;
  }

  let normalized = rawValue.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  let isPrefix = false;
  if (normalized.endsWith("*") || normalized.endsWith("%")) {
    isPrefix = true;
    normalized = normalized.slice(0, -1).trim();
  }

  if (!normalized) {
    return null;
  }

  const escaped = escapeRegex(normalized);
  const emailRegex = new RegExp(`^${escaped}${isPrefix ? "" : "$"}`, "i");
  const lowerFilter = isPrefix
    ? { $regex: new RegExp(`^${escaped}`) }
    : normalized;

  return {
    $or: [
      { userEmailLower: lowerFilter },
      { userEmail: { $regex: emailRegex } },
    ],
  };
}

/**
 * Helper to check if user is admin
 */
async function isAdmin(req: Request): Promise<boolean> {
  // First try from req.user (when auth middleware is active)
  const role = (req.user as any)?.role;
  if (role === UserRoleTypes.Admin || role === UserRoleTypes.SuperAdmin) {
    return true;
  }

  // If not in req.user, extract from JWT token
  const email = getEmailFromRequest(req);
  if (!email) {
    return false;
  }

  // Get user from database to check role
  const user = await userService.findOne({ email });
  if (!user) {
    return false;
  }

  const userRole = (user as any).role;
  return userRole === UserRoleTypes.Admin || userRole === UserRoleTypes.SuperAdmin;
}

export class KYCAdminController {
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
  }

  /**
   * Helper function to format application with documents
   */
  private async formatApplicationWithDocuments(app: any) {
    const applicationId = (app as any)._id?.toString();

    // Get all documents for this application
    const documents = await kycDocumentService.find({ kycApplicationId: applicationId });

    // Generate pre-signed URLs for each document
    const documentsWithUrls = await Promise.all(
      documents.map(async (doc: any) => {
        try {
          const viewUrl = await s3KycService.generatePresignedGetUrl(doc.s3Key);
          return {
            _id: (doc as any)._id?.toString(),
            type: doc.type,
            mimeType: doc.mimeType,
            fileSize: doc.fileSize,
            s3Key: doc.s3Key,
            viewUrl: viewUrl,
            createdAt: doc.createdAt,
          };
        } catch (error) {
          console.error(`Error generating URL for document ${doc._id}:`, error);
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
      selectedDocumentType: app.selectedDocumentType || null,
      selectedCountry: app.selectedCountry || null,
      personalInfo: {
        firstName: app.personalInfo?.firstName || "",
        lastName: app.personalInfo?.lastName || "",
        dob: app.personalInfo?.dob || "",
        address: app.personalInfo?.address || "",
        city: app.personalInfo?.city || "",
        country: app.personalInfo?.country || "",
        postalCode: app.personalInfo?.postalCode || "",
        nationality: app.personalInfo?.nationality || "",
      },
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

  /**
   * List KYC applications
   * GET /api/v1/inex/admin/kyc/applications
   * Query params:
   *   - searchEmail?: string (exact match, or prefix with trailing * / %)
   */
  async listApplications(req: Request, res: Response) {
    try {
      if (!(await isAdmin(req))) {
        return res.status(403).json({
          status: 403,
          data: { message: "Forbidden: Admin access required" },
        });
      }

      const {
        status,
        country,
        search,
        searchEmail,
        page = "1",
        limit = "20",
      } = req.query;
      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const skip = (pageNum - 1) * limitNum;

      // Build query
      const query: any = {};
      const andConditions: any[] = [];
      if (status) {
        query.status = status;
      }
      if (country) {
        query.selectedCountry = country;
      }
      if (search) {
        andConditions.push({
          $or: [
          { userEmail: { $regex: search, $options: "i" } },
          { "personalInfo.firstName": { $regex: search, $options: "i" } },
          { "personalInfo.lastName": { $regex: search, $options: "i" } },
          ],
        });
      }

      const searchEmailCondition = buildSearchEmailCondition(searchEmail);
      if (searchEmailCondition) {
        andConditions.push(searchEmailCondition);
      }

      if (andConditions.length) {
        query.$and = andConditions;
      }

      // Get applications with pagination
      const applications = await kycApplicationService.findPaginatedSkip(
        limitNum,
        skip,
        { createdAt: -1 },
        query,
        {}
      );

      // Get total count
      const total = await kycApplicationService.findCount(query);

      // Format response with documents
      const formatted = await Promise.all(
        applications.map((app: any) => this.formatApplicationWithDocuments(app))
      );

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
      console.error("Error listing KYC applications:", error);
      return res.status(500).json({
        status: 500,
        data: { message: error.message || "Internal server error" },
      });
    }
  }

  /**
   * Get all KYC applications grouped by status (pending, approved, rejected)
   * GET /api/v1/inex/admin/kyc/applications/status-summary
   */
  async getApplicationsByStatus(req: Request, res: Response) {
    try {
      if (!(await isAdmin(req))) {
        return res.status(403).json({
          status: 403,
          data: { message: "Forbidden: Admin access required" },
        });
      }

      const { limit = "100" } = req.query;
      const limitNum = parseInt(limit as string, 10);

      // Get pending applications
      const pendingApps = await kycApplicationService.findPaginated(
        limitNum,
        { createdAt: -1 },
        { status: KycStatus.PENDING },
        {}
      );
      const pendingFormatted = await Promise.all(
        pendingApps.map((app: any) => this.formatApplicationWithDocuments(app))
      );

      // Get approved applications
      const approvedApps = await kycApplicationService.findPaginated(
        limitNum,
        { createdAt: -1 },
        { status: KycStatus.APPROVED },
        {}
      );
      const approvedFormatted = await Promise.all(
        approvedApps.map((app: any) => this.formatApplicationWithDocuments(app))
      );

      // Get rejected applications
      const rejectedApps = await kycApplicationService.findPaginated(
        limitNum,
        { createdAt: -1 },
        { status: KycStatus.REJECTED },
        {}
      );
      const rejectedFormatted = await Promise.all(
        rejectedApps.map((app: any) => this.formatApplicationWithDocuments(app))
      );

      // Get counts
      const pendingCount = await kycApplicationService.findCount({ status: KycStatus.PENDING });
      const approvedCount = await kycApplicationService.findCount({ status: KycStatus.APPROVED });
      const rejectedCount = await kycApplicationService.findCount({ status: KycStatus.REJECTED });

      return res.status(200).json({
        status: 200,
        data: {
          pending: {
            applications: pendingFormatted,
            total: pendingCount,
          },
          approved: {
            applications: approvedFormatted,
            total: approvedCount,
          },
          rejected: {
            applications: rejectedFormatted,
            total: rejectedCount,
          },
        },
      });
    } catch (error: any) {
      console.error("Error getting KYC applications by status:", error);
      return res.status(500).json({
        status: 500,
        data: { message: error.message || "Internal server error" },
      });
    }
  }

  /**
   * Get pending KYC applications
   * GET /api/v1/inex/admin/kyc/applications/pending
   * Query params:
   *   - searchEmail?: string (exact match, or prefix with trailing * / %)
   */
  async getPendingApplications(req: Request, res: Response) {
    try {
      if (!(await isAdmin(req))) {
        return res.status(403).json({
          status: 403,
          data: { message: "Forbidden: Admin access required" },
        });
      }

      const { page = "1", limit = "500", searchEmail } = req.query;
      const pageNumRaw = parseInt(page as string, 10);
      const pageNum = Number.isFinite(pageNumRaw) && pageNumRaw > 0 ? pageNumRaw : 1;
      const limitRaw = parseInt(limit as string, 10);
      const MAX_LIMIT = 500;
      const limitNum = Number.isFinite(limitRaw) && limitRaw > 0
        ? Math.min(limitRaw, MAX_LIMIT)
        : MAX_LIMIT;
      const skip = (pageNum - 1) * limitNum;
      const query: any = { status: KycStatus.PENDING };
      const searchEmailCondition = buildSearchEmailCondition(searchEmail);
      if (searchEmailCondition) {
        query.$and = [searchEmailCondition];
      }

      // Get pending applications
      const applications = await kycApplicationService.findPaginatedSkip(
        limitNum,
        skip,
        { createdAt: -1 },
        query,
        {}
      );

      // Get total count
      const total = await kycApplicationService.findCount(query);

      // Format with documents
      const formatted = await Promise.all(
        applications.map((app: any) => this.formatApplicationWithDocuments(app))
      );

      const hasMore = skip + applications.length < total;
      return res.status(200).json({
        status: 200,
        data: {
          applications: formatted,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum),
            nextPage: hasMore ? pageNum + 1 : null,
            prevPage: pageNum > 1 ? pageNum - 1 : null,
            hasMore,
          },
        },
      });
    } catch (error: any) {
      console.error("Error getting pending KYC applications:", error);
      return res.status(500).json({
        status: 500,
        data: { message: error.message || "Internal server error" },
      });
    }
  }

  /**
   * Get approved KYC applications
   * GET /api/v1/inex/admin/kyc/applications/approved
   * Query params:
   *   - searchEmail?: string (exact match, or prefix with trailing * / %)
   */
  async getApprovedApplications(req: Request, res: Response) {
    try {
      if (!(await isAdmin(req))) {
        return res.status(403).json({
          status: 403,
          data: { message: "Forbidden: Admin access required" },
        });
      }

      const { page = "1", limit = "500", searchEmail } = req.query;
      const pageNumRaw = parseInt(page as string, 10);
      const pageNum = Number.isFinite(pageNumRaw) && pageNumRaw > 0 ? pageNumRaw : 1;
      const limitRaw = parseInt(limit as string, 10);
      const MAX_LIMIT = 500;
      const limitNum = Number.isFinite(limitRaw) && limitRaw > 0
        ? Math.min(limitRaw, MAX_LIMIT)
        : MAX_LIMIT;
      const skip = (pageNum - 1) * limitNum;
      const query: any = { status: KycStatus.APPROVED };
      const searchEmailCondition = buildSearchEmailCondition(searchEmail);
      if (searchEmailCondition) {
        query.$and = [searchEmailCondition];
      }

      // Get approved applications
      const applications = await kycApplicationService.findPaginatedSkip(
        limitNum,
        skip,
        { createdAt: -1 },
        query,
        {}
      );

      // Get total count
      const total = await kycApplicationService.findCount(query);

      // Format with documents
      const formatted = await Promise.all(
        applications.map((app: any) => this.formatApplicationWithDocuments(app))
      );

      const hasMore = skip + applications.length < total;
      return res.status(200).json({
        status: 200,
        data: {
          applications: formatted,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum),
            nextPage: hasMore ? pageNum + 1 : null,
            prevPage: pageNum > 1 ? pageNum - 1 : null,
            hasMore,
          },
        },
      });
    } catch (error: any) {
      console.error("Error getting approved KYC applications:", error);
      return res.status(500).json({
        status: 500,
        data: { message: error.message || "Internal server error" },
      });
    }
  }

  /**
   * Get rejected KYC applications
   * GET /api/v1/inex/admin/kyc/applications/rejected
   * Query params:
   *   - searchEmail?: string (exact match, or prefix with trailing * / %)
   */
  async getRejectedApplications(req: Request, res: Response) {
    try {
      if (!(await isAdmin(req))) {
        return res.status(403).json({
          status: 403,
          data: { message: "Forbidden: Admin access required" },
        });
      }

      const { page = "1", limit = "500", searchEmail } = req.query;
      const pageNumRaw = parseInt(page as string, 10);
      const pageNum = Number.isFinite(pageNumRaw) && pageNumRaw > 0 ? pageNumRaw : 1;
      const limitRaw = parseInt(limit as string, 10);
      const MAX_LIMIT = 500;
      const limitNum = Number.isFinite(limitRaw) && limitRaw > 0
        ? Math.min(limitRaw, MAX_LIMIT)
        : MAX_LIMIT;
      const skip = (pageNum - 1) * limitNum;
      const query: any = { status: KycStatus.REJECTED };
      const searchEmailCondition = buildSearchEmailCondition(searchEmail);
      if (searchEmailCondition) {
        query.$and = [searchEmailCondition];
      }

      // Get rejected applications
      const applications = await kycApplicationService.findPaginatedSkip(
        limitNum,
        skip,
        { createdAt: -1 },
        query,
        {}
      );

      // Get total count
      const total = await kycApplicationService.findCount(query);

      // Format with documents
      const formatted = await Promise.all(
        applications.map((app: any) => this.formatApplicationWithDocuments(app))
      );

      const hasMore = skip + applications.length < total;
      return res.status(200).json({
        status: 200,
        data: {
          applications: formatted,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum),
            nextPage: hasMore ? pageNum + 1 : null,
            prevPage: pageNum > 1 ? pageNum - 1 : null,
            hasMore,
          },
        },
      });
    } catch (error: any) {
      console.error("Error getting rejected KYC applications:", error);
      return res.status(500).json({
        status: 500,
        data: { message: error.message || "Internal server error" },
      });
    }
  }

  /**
   * Get KYC application detail
   * GET /api/v1/inex/admin/kyc/applications/:id
   */
  async getApplicationDetail(req: Request, res: Response) {
    try {
      if (!(await isAdmin(req))) {
        return res.status(403).json({
          status: 403,
          data: { message: "Forbidden: Admin access required" },
        });
      }

      const { id } = req.params;

      // Get application
      const application = await kycApplicationService.findOne({ _id: id });
      if (!application) {
        return res.status(404).json({
          status: 404,
          data: { message: "KYC application not found" },
        });
      }
      const formattedApplication = await this.formatApplicationWithDocuments(application);

      // Get last 10 audit logs
      const auditLogs = await kycAuditLogService.findPaginated(
        10,
        { createdAt: -1 },
        { kycApplicationId: id },
        {}
      );

      return res.status(200).json({
        status: 200,
        data: {
          application: formattedApplication,
          documents: formattedApplication.documents,
          auditLogs: auditLogs.slice(0, 10),
        },
      });
    } catch (error: any) {
      console.error("Error getting KYC application detail:", error);
      return res.status(500).json({
        status: 500,
        data: { message: error.message || "Internal server error" },
      });
    }
  }

  /**
   * Get pre-signed VIEW URL for a document
   * GET /api/v1/inex/admin/kyc/documents/:documentId/view-url
   */
  async getDocumentViewUrl(req: Request, res: Response) {
    try {
      if (!(await isAdmin(req))) {
        return res.status(403).json({
          status: 403,
          data: { message: "Forbidden: Admin access required" },
        });
      }

      const { documentId } = req.params;

      // Get document
      const document = await kycDocumentService.findOne({ _id: documentId });
      if (!document) {
        return res.status(404).json({
          status: 404,
          data: { message: "Document not found" },
        });
      }

      // Generate pre-signed GET URL
      const url = await s3KycService.generatePresignedGetUrl(document.s3Key);

      return res.status(200).json({
        status: 200,
        data: { url },
      });
    } catch (error: any) {
      console.error("Error generating document view URL:", error);
      return res.status(500).json({
        status: 500,
        data: { message: error.message || "Internal server error" },
      });
    }
  }

  /**
   * Approve KYC
   * POST /api/v1/inex/admin/kyc/applications/:id/approve
   */
  async approveApplication(req: Request, res: Response) {
    try {
      if (!(await isAdmin(req))) {
        return res.status(403).json({
          status: 403,
          data: { message: "Forbidden: Admin access required" },
        });
      }

      const adminEmail = getEmailFromRequest(req);
      if (!adminEmail) {
        return res.status(401).json({
          status: 401,
          data: { message: "Unauthorized - email is required" },
        });
      }
      const { id } = req.params;
      const { note } = req.body;

      // Get admin user by email to get adminId
      const adminUser = await userService.findOne({ email: adminEmail });
      if (!adminUser) {
        return res.status(404).json({
          status: 404,
          data: { message: "Admin user not found" },
        });
      }
      const adminId = (adminUser as any)._id?.toString();

      // Get application
      const application = await kycApplicationService.findOne({ _id: id });
      if (!application) {
        return res.status(404).json({
          status: 404,
          data: { message: "KYC application not found" },
        });
      }

      // Only allow approval from pending or under_review
      if (![KycStatus.PENDING, KycStatus.UNDER_REVIEW].includes(application.status)) {
        return res.status(400).json({
          status: 400,
          data: { message: "Application can only be approved from 'pending' or 'under_review' status" },
        });
      }

      // Update application status
      await kycApplicationService.updatePart(
        { _id: id },
        {
          $set: {
            status: KycStatus.APPROVED,
            updatedAt: new Date(),
          },
        }
      );

      // Update User
      // TODO: Integrate with UserService to update:
      // - kycStatus = "Completed"
      // - currentKycLevel = levelRequested
      // - isKYCPass = true
      // - KYCUpdatedDate = new Date()
      const userId = (application as any).userId;
      const userEmail = (application as any).userEmail;

      console.log(`KYC Approval: Attempting to update user. userId:`, userId, `userEmail:`, userEmail);

      // Try to update user by email first (more reliable), then fallback to userId
      let userUpdated = false;
      try {
        // First, try by email (more reliable since it's a string)
        if (userEmail) {
          const emailLower = String(userEmail).toLowerCase().trim();
          console.log(`KYC Approval: Attempting to update user by email: ${emailLower}`);

          // Verify user exists first
          const userExists = await userService.findOne({ email: emailLower });
          if (!userExists) {
            console.error(`KYC Approval: User not found with email: ${emailLower}`);
          } else {
            const updateResult: any = await userService.updatePart(
              { email: emailLower },
              {
                $set: {
                  kycStatus: "Completed",
                  isKYCPass: true,
                  KYCUpdatedDate: new Date(),
                },
              }
            );

            console.log(`KYC Approval: Update result by email:`, JSON.stringify(updateResult));

            // Check if update was successful
            if (updateResult && (updateResult.modifiedCount > 0 || updateResult.acknowledged)) {
              userUpdated = true;
              console.log(`KYC Approval: ✅ Successfully updated user by email ${emailLower}. Modified: ${updateResult.modifiedCount}`);

              // Verify the update
              const updatedUser = await userService.findOne({ email: emailLower });
              console.log(`KYC Approval: Verification - User kycStatus: ${(updatedUser as any)?.kycStatus}, isKYCPass: ${(updatedUser as any)?.isKYCPass}`);
            } else {
              console.error(`KYC Approval: ❌ Update by email ${emailLower} returned no modifications. Result:`, updateResult);
            }
          }
        }

        // If email update didn't work, try userId as fallback
        if (!userUpdated && userId) {
          const userIdString = userId.toString ? userId.toString() : String(userId);
          console.log(`KYC Approval: Attempting to update user by userId: ${userIdString}`);

          const updateResult: any = await userService.updatePart(
            { _id: userIdString },
            {
              $set: {
                kycStatus: "Completed",
                isKYCPass: true,
                KYCUpdatedDate: new Date(),
                // TODO: Add currentKycLevel field to User model if needed
              },
            }
          );

          console.log(`KYC Approval: Update result by userId:`, JSON.stringify(updateResult));

          if (updateResult && (updateResult.modifiedCount > 0 || updateResult.acknowledged)) {
            userUpdated = true;
            console.log(`KYC Approval: ✅ Successfully updated user by userId ${userIdString}. Modified: ${updateResult.modifiedCount}`);
          } else {
            console.error(`KYC Approval: ❌ Update by userId ${userIdString} returned no modifications. Result:`, updateResult);
          }
        }

        if (!userUpdated) {
          console.error('KYC Approval: ❌ Failed to update user table. userId:', userId, 'userEmail:', userEmail);
        }
      } catch (userUpdateError) {
        console.error('KYC Approval: ❌ Error updating user table:', userUpdateError);
        // Don't fail the request, but log the error
      }

      // Log audit
      await kycAuditLogService.create({
        actorId: adminId,
        actorType: KycAuditActorType.ADMIN,
        action: KycAuditAction.KYC_APPROVED,
        userId: (application as any).userId?.toString(),
        kycApplicationId: id,
        note: note || "KYC application approved",
        createdAt: new Date(),
      } as any);

      // Send approval email to user
      if (userEmail) {
        try {
          const emailBody = `
            <p>Dear Valued User,</p>
            <p>We are pleased to inform you that your KYC (Know Your Customer) application has been <strong>approved</strong>.</p>
            <p>Your account has been successfully verified and you can now enjoy full access to all platform features.</p>
            ${note ? `<p><strong>Admin Note:</strong> ${note}</p>` : ''}
            <p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>
            <p>Thank you for your patience during the verification process.</p>
            <p>Best regards,<br />The Indexx.ai Team</p>
          `;

          await new SendEmail().sendGenericEmail({
            toEmail: userEmail,
            subject: "KYC Application Approved - Indexx.ai",
            bodyContent: emailBody,
            senderName: "Indexx.ai",
            senderEmail: "accounts@indexx.ai",
            replyToEmail: "wallet@indexx.ai",
          });
        } catch (emailError) {
          console.error("Error sending KYC approval email:", emailError);
          // Don't fail the request if email fails
        }
      }

      const updated = await kycApplicationService.findOne({ _id: id });

      return res.status(200).json({
        status: 200,
        data: updated,
      });
    } catch (error: any) {
      console.error("Error approving KYC application:", error);
      return res.status(500).json({
        status: 500,
        data: { message: error.message || "Internal server error" },
      });
    }
  }

  /**
   * Reject KYC
   * POST /api/v1/inex/admin/kyc/applications/:id/reject
   */
  async rejectApplication(req: Request, res: Response) {
    try {
      if (!(await isAdmin(req))) {
        return res.status(403).json({
          status: 403,
          data: { message: "Forbidden: Admin access required" },
        });
      }

      const adminEmail = getEmailFromRequest(req);
      if (!adminEmail) {
        return res.status(401).json({
          status: 401,
          data: { message: "Unauthorized - email is required" },
        });
      }
      const { id } = req.params;
      const { reason } = req.body;

      // Get admin user by email to get adminId
      const adminUser = await userService.findOne({ email: adminEmail });
      if (!adminUser) {
        return res.status(404).json({
          status: 404,
          data: { message: "Admin user not found" },
        });
      }
      const adminId = (adminUser as any)._id?.toString();

      if (!reason) {
        return res.status(400).json({
          status: 400,
          data: { message: "reason is required" },
        });
      }

      // Get application
      const application = await kycApplicationService.findOne({ _id: id });
      if (!application) {
        return res.status(404).json({
          status: 404,
          data: { message: "KYC application not found" },
        });
      }

      // Update application status
      await kycApplicationService.updatePart(
        { _id: id },
        {
          $set: {
            status: KycStatus.REJECTED,
            rejectionReason: reason,
            updatedAt: new Date(),
          },
        }
      );

      // Update User
      const userId = (application as any).userId?.toString();
      if (userId) {
        await userService.updatePart(
          { _id: userId },
          {
            $set: {
              kycStatus: "rejected",
              isKYCPass: false,
              KYCUpdatedDate: new Date(),
            },
          }
        );
      }

      // Log audit
      await kycAuditLogService.create({
        actorId: adminId,
        actorType: KycAuditActorType.ADMIN,
        action: KycAuditAction.KYC_REJECTED,
        userId: (application as any).userId?.toString(),
        kycApplicationId: id,
        note: `KYC application rejected: ${reason}`,
        createdAt: new Date(),
      } as any);

      // Send rejection email to user
      const userEmail = (application as any).userEmail;
      if (userEmail) {
        try {
          const emailBody = `
            <p>Dear Valued User,</p>
            <p>We regret to inform you that your KYC (Know Your Customer) application has been <strong>rejected</strong>.</p>
            <p><strong>Reason for rejection:</strong> ${reason}</p>
            <p>Please review the reason provided above and resubmit your KYC application with the necessary corrections or additional documentation.</p>
            <p>If you have any questions or need clarification, please contact our support team. We're here to help you complete the verification process.</p>
            <p>Thank you for your understanding.</p>
            <p>Best regards,<br />The Indexx.ai Team</p>
          `;

          await new SendEmail().sendGenericEmail({
            toEmail: userEmail,
            subject: "KYC Application Rejected - Indexx.ai",
            bodyContent: emailBody,
            senderName: "Indexx.ai",
            senderEmail: "accounts@indexx.ai",
            replyToEmail: "wallet@indexx.ai",
          });
        } catch (emailError) {
          console.error("Error sending KYC rejection email:", emailError);
          // Don't fail the request if email fails
        }
      }

      const updated = await kycApplicationService.findOne({ _id: id });

      return res.status(200).json({
        status: 200,
        data: updated,
      });
    } catch (error: any) {
      console.error("Error rejecting KYC application:", error);
      return res.status(500).json({
        status: 500,
        data: { message: error.message || "Internal server error" },
      });
    }
  }

  /**
   * Mark 'need more info'
   * POST /api/v1/inex/admin/kyc/applications/:id/need-more-info
   */
  async needMoreInfo(req: Request, res: Response) {
    try {
      if (!(await isAdmin(req))) {
        return res.status(403).json({
          status: 403,
          data: { message: "Forbidden: Admin access required" },
        });
      }

      const adminEmail = getEmailFromRequest(req);
      if (!adminEmail) {
        return res.status(401).json({
          status: 401,
          data: { message: "Unauthorized - email is required" },
        });
      }
      const { id } = req.params;
      const { message } = req.body;

      // Get admin user by email to get adminId
      const adminUser = await userService.findOne({ email: adminEmail });
      if (!adminUser) {
        return res.status(404).json({
          status: 404,
          data: { message: "Admin user not found" },
        });
      }
      const adminId = (adminUser as any)._id?.toString();

      if (!message) {
        return res.status(400).json({
          status: 400,
          data: { message: "message is required" },
        });
      }

      // Get application
      const application = await kycApplicationService.findOne({ _id: id });
      if (!application) {
        return res.status(404).json({
          status: 404,
          data: { message: "KYC application not found" },
        });
      }

      // Update application status
      await kycApplicationService.updatePart(
        { _id: id },
        {
          $set: {
            status: KycStatus.NEED_MORE_INFO,
            updatedAt: new Date(),
          },
        }
      );

      // Log audit
      await kycAuditLogService.create({
        actorId: adminId,
        actorType: KycAuditActorType.ADMIN,
        action: KycAuditAction.KYC_NEED_MORE_INFO,
        userId: (application as any).userId?.toString(),
        kycApplicationId: id,
        note: message,
        createdAt: new Date(),
      } as any);

      const updated = await kycApplicationService.findOne({ _id: id });

      return res.status(200).json({
        status: 200,
        data: updated,
      });
    } catch (error: any) {
      console.error("Error marking KYC need more info:", error);
      return res.status(500).json({
        status: 500,
        data: { message: error.message || "Internal server error" },
      });
    }
  }
}
