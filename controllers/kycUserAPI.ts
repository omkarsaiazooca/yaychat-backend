import { Request, Response } from "express";
import { KycApplicationService } from "../services/kycApplication.service";
import { KycDocumentService } from "../services/kycDocument.service";
import { KycAuditLogService } from "../services/kycAuditLog.service";
import { S3KycService } from "../services/s3Kyc.service";
import { KycStatus, PersonalInfo } from "../data/kycApplication";
import { KycDocumentType } from "../data/kycDocument";
import { KycAuditAction, KycAuditActorType } from "../data/kycAuditLog";
import { UserService } from "../services/user.service";
import { SendEmail } from "../platform/email.operations";

// TODO: Remove this helper after uncommenting auth middleware
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
      // Use a simple decode without verification for testing
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

const kycApplicationService = new KycApplicationService();
const kycDocumentService = new KycDocumentService();
const kycAuditLogService = new KycAuditLogService();
const s3KycService = new S3KycService();
const userService = new UserService();

// Required documents for KYC submission
const REQUIRED_ID_DOCUMENT_TYPES = [
  KycDocumentType.ID_FRONT,
  KycDocumentType.ID_BACK,
  KycDocumentType.PASSPORT,
];
const REQUIRED_SELFIE_DOCUMENT = KycDocumentType.SELFIE;

export class KYCUserController {
  constructor() {
    this.createApplication = this.createApplication.bind(this);
    this.updateApplication = this.updateApplication.bind(this);
    this.getPresignedUploadUrl = this.getPresignedUploadUrl.bind(this);
    this.confirmDocumentUpload = this.confirmDocumentUpload.bind(this);
    this.uploadDocumentDirect = this.uploadDocumentDirect.bind(this);
    this.getApplicationDocuments = this.getApplicationDocuments.bind(this);
    this.deleteApplicationDocument = this.deleteApplicationDocument.bind(this);
    this.submitApplication = this.submitApplication.bind(this);
    this.getStatus = this.getStatus.bind(this);
    this.updateSelection = this.updateSelection.bind(this);
  }
  /**
   * Update lightweight selection info (e.g., country, document type) before uploading documents
   * PUT /api/v1/inex/userkyc/applications/:id/selection
   */
  async updateSelection(req: Request, res: Response) {
    try {
      const email = getEmailFromRequest(req);
      const { id } = req.params;
      const { country, documentType, documentCategory } = req.body || {};

      if (!email) {
        return res.status(401).json({
          status: 401,
          data: { message: "Unauthorized - email is required" },
        });
      }

      if (!id) {
        return res.status(400).json({
          status: 400,
          data: { message: "Application ID is required" },
        });
      }

      const user = await userService.findOne({ email });
      if (!user) {
        return res.status(404).json({
          status: 404,
          data: { message: "User not found" },
        });
      }
      const userId = (user as any)._id?.toString();

      const application = await kycApplicationService.findOne({ _id: id });
      if (!application) {
        return res.status(404).json({
          status: 404,
          data: { message: "KYC application not found" },
        });
      }

      const appUserId = (application as any).userId?.toString ? (application as any).userId.toString() : String((application as any).userId);
      if (appUserId !== userId) {
        return res.status(403).json({
          status: 403,
          data: { message: "Forbidden: You don't own this application" },
        });
      }

      const normalizedCountry = country ? String(country).trim() : null;
      const normalizedDocType = this.normalizeDocumentCategory(documentType || documentCategory);

      if (
        normalizedDocType &&
        ["national_id", "driving_licence"].includes(normalizedDocType) &&
        !normalizedCountry
      ) {
        return res.status(400).json({
          status: 400,
          data: { message: "country is required for national_id or driving_licence document types" },
        });
      }

      const updates: Record<string, any> = {
        updatedAt: new Date(),
      };
      if (normalizedDocType) {
        updates.selectedDocumentType = normalizedDocType;
      }
      if (normalizedCountry) {
        updates.selectedCountry = normalizedCountry;
      }
      updates.userEmail = email;
      updates.userEmailLower = email ? String(email).toLowerCase().trim() : "";

      await kycApplicationService.updatePart(
        { _id: id },
        { $set: updates }
      );

      const refreshed = await kycApplicationService.findOne({ _id: id });

      return res.status(200).json({
        status: 200,
        data: {
          applicationId: id,
          userEmail: email,
          selectedDocumentType: (refreshed as any)?.selectedDocumentType || normalizedDocType || null,
          selectedCountry: (refreshed as any)?.selectedCountry || normalizedCountry || null,
        },
      });
    } catch (error: any) {
      console.error("Error updating selection:", error);
      return res.status(500).json({
        status: 500,
        data: { message: error.message || "Internal server error" },
      });
    }
  }

  /**
   * Map frontend document type to backend enum
   */
  private mapDocumentType(frontendType: string): KycDocumentType | null {
    const typeMap: { [key: string]: KycDocumentType } = {
      passport: KycDocumentType.PASSPORT,
      "national id": KycDocumentType.ID_FRONT,
      "national_id": KycDocumentType.ID_FRONT,
      "driving licence": KycDocumentType.ID_FRONT,
      "driving_licence": KycDocumentType.ID_FRONT,
      "driving license": KycDocumentType.ID_FRONT,
      "driving_license": KycDocumentType.ID_FRONT,
    };
    
    const normalized = frontendType.toLowerCase().trim();
    return typeMap[normalized] || null;
  }

  /**
   * Normalize document category for summary storage
   */
  private normalizeDocumentCategory(value?: string | null): string | null {
    if (!value || typeof value !== "string") {
      return null;
    }
    const rawValue = `${value}`;
    const normalized = rawValue.toLowerCase().trim();
    const upperValue = rawValue.toUpperCase();

    if (normalized.includes("passport") || value === KycDocumentType.PASSPORT) {
      return "passport";
    }
    if (
      normalized.includes("driving") ||
      upperValue === "DRIVING_LICENCE" ||
      upperValue === "DRIVING_LICENSE"
    ) {
      return "driving_licence";
    }
    if (
      normalized.includes("national") ||
      value === KycDocumentType.ID_FRONT ||
      value === KycDocumentType.ID_BACK
    ) {
      return "national_id";
    }
    if (normalized.includes("selfie") || value === KycDocumentType.SELFIE) {
      return "selfie";
    }

    return normalized || null;
  }

  /**
   * Create / start KYC application
   * POST /api/v1/inex/userkyc/applications
   */
  async createApplication(req: Request, res: Response) {
    try {
      // TODO: For testing - will use req.user.email after uncommenting auth middleware
      const email = getEmailFromRequest(req);

      if (!email) {
        return res.status(401).json({
          status: 401,
          data: { message: "Unauthorized - email is required" },
        });
      }

      // Get user by email to get userId
      const user = await userService.findOne({ email });
      if (!user) {
        return res.status(404).json({
          status: 404,
          data: { message: "User not found" },
        });
      }
      const userId = (user as any)._id?.toString();

      const { levelRequested = 1, personalInfo = {} } = req.body || {};

      // Check if user already has a pending or under_review application
      const existingApp = await kycApplicationService.findOne({
        userId,
        status: { $in: [KycStatus.PENDING, KycStatus.UNDER_REVIEW] },
      });

      if (existingApp) {
        return res.status(200).json({
          status: 200,
          data: existingApp,
        });
      }

      // Create new application
      const newApplication = await kycApplicationService.create({
        userId,
        userEmail: email,
        userEmailLower: String(email).toLowerCase().trim(),
        levelRequested,
        personalInfo: personalInfo as PersonalInfo,
        status: KycStatus.DRAFT,
        riskScore: 0,
        rejectionReason: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      // Log audit
      await kycAuditLogService.create({
        actorId: userId,
        actorType: KycAuditActorType.USER,
        action: KycAuditAction.KYC_CREATED,
        userId,
        kycApplicationId: (newApplication as any)._id?.toString() || null,
        note: `KYC application created for level ${levelRequested}`,
        createdAt: new Date(),
      } as any);

      return res.status(201).json({
        status: 201,
        data: newApplication,
      });
    } catch (error: any) {
      console.error("Error creating KYC application:", error);
      return res.status(500).json({
        status: 500,
        data: { message: error.message || "Internal server error" },
      });
    }
  }

  /**
   * Update KYC application personal info
   * PATCH /api/v1/inex/userkyc/applications/:id
   */
  async updateApplication(req: Request, res: Response) {
    try {
      // TODO: For testing - will use req.user.email after uncommenting auth middleware
      const email = getEmailFromRequest(req);
      const { id } = req.params;
      const { personalInfo } = req.body;

      if (!email) {
        return res.status(401).json({
          status: 401,
          data: { message: "Unauthorized - email is required" },
        });
      }

      // Get user by email to get userId
      const user = await userService.findOne({ email });
      if (!user) {
        return res.status(404).json({
          status: 404,
          data: { message: "User not found" },
        });
      }
      const userId = (user as any)._id?.toString();

      // Find application and verify ownership
      let application = await kycApplicationService.findOne({ _id: id });
      if (!application) {
        return res.status(404).json({
          status: 404,
          data: { message: "KYC application not found" },
        });
      }

      const appUserId = (application as any).userId?.toString ? (application as any).userId.toString() : String((application as any).userId);
      if (appUserId !== userId) {
        return res.status(403).json({
          status: 403,
          data: { message: "Forbidden: You don't own this application" },
        });
      }

      // Only allow updates if status is draft or need_more_info
      if (![KycStatus.DRAFT, KycStatus.NEED_MORE_INFO].includes(application.status)) {
        return res.status(400).json({
          status: 400,
          data: { message: "Application can only be updated when status is 'draft' or 'need_more_info'" },
        });
      }

      // Update personal info
      if (personalInfo) {
        await kycApplicationService.updatePart(
          { _id: id },
          { $set: { personalInfo, updatedAt: new Date() } }
        );
      }

      const updated = await kycApplicationService.findOne({ _id: id });

      return res.status(200).json({
        status: 200,
        data: updated,
      });
    } catch (error: any) {
      console.error("Error updating KYC application:", error);
      return res.status(500).json({
        status: 500,
        data: { message: error.message || "Internal server error" },
      });
    }
  }

  /**
   * Get pre-signed upload URL for a document
   * POST /api/v1/inex/userkyc/applications/:id/documents/presign
   */
  async getPresignedUploadUrl(req: Request, res: Response) {
    try {
      // TODO: For testing - will use req.user.email after uncommenting auth middleware
      const email = getEmailFromRequest(req);
      const { id } = req.params;
      const { type, mimeType } = req.body;

      if (!email) {
        return res.status(401).json({
          status: 401,
          data: { message: "Unauthorized - email is required" },
        });
      }

      // Get user by email to get userId
      const user = await userService.findOne({ email });
      if (!user) {
        return res.status(404).json({
          status: 404,
          data: { message: "User not found" },
        });
      }
      const userId = (user as any)._id?.toString();

      if (!type || !mimeType) {
        return res.status(400).json({
          status: 400,
          data: { message: "type and mimeType are required" },
        });
      }

      // Validate document type
      if (!Object.values(KycDocumentType).includes(type)) {
        return res.status(400).json({
          status: 400,
          data: { message: "Invalid document type" },
        });
      }

      // Verify application ownership
      let application = await kycApplicationService.findOne({ _id: id });
      if (!application) {
        return res.status(404).json({
          status: 404,
          data: { message: "KYC application not found" },
        });
      }

      const appUserId = (application as any).userId?.toString ? (application as any).userId.toString() : String((application as any).userId);
      if (appUserId !== userId) {
        return res.status(403).json({
          status: 403,
          data: { message: "Forbidden: You don't own this application" },
        });
      }

      // Generate pre-signed URL
      const { uploadUrl, key } = await s3KycService.generatePresignedPutUrl(
        email,
        type,
        mimeType
      );

      return res.status(200).json({
        status: 200,
        data: { uploadUrl, key },
      });
    } catch (error: any) {
      console.error("Error generating presigned URL:", error);
      return res.status(500).json({
        status: 500,
        data: { message: error.message || "Internal server error" },
      });
    }
  }

  /**
   * Confirm document uploaded
   * POST /api/v1/inex/userkyc/applications/:id/documents
   */
  async confirmDocumentUpload(req: Request, res: Response) {
    try {
      // TODO: For testing - will use req.user.email after uncommenting auth middleware
      const email = getEmailFromRequest(req);
      const { id } = req.params;
      const { type, s3Key, mimeType, fileSize } = req.body;

      if (!email) {
        return res.status(401).json({
          status: 401,
          data: { message: "Unauthorized - email is required" },
        });
      }

      // Get user by email to get userId
      const user = await userService.findOne({ email });
      if (!user) {
        return res.status(404).json({
          status: 404,
          data: { message: "User not found" },
        });
      }
      const userId = (user as any)._id?.toString();

      if (!type || !s3Key || !mimeType || !fileSize) {
        return res.status(400).json({
          status: 400,
          data: { message: "type, s3Key, mimeType, and fileSize are required" },
        });
      }

      // Validate document type
      if (!Object.values(KycDocumentType).includes(type)) {
        return res.status(400).json({
          status: 400,
          data: { message: "Invalid document type" },
        });
      }

      // Verify application ownership
      let application = await kycApplicationService.findOne({ _id: id });
      if (!application) {
        return res.status(404).json({
          status: 404,
          data: { message: "KYC application not found" },
        });
      }

      const appUserId = (application as any).userId?.toString ? (application as any).userId.toString() : String((application as any).userId);
      if (appUserId !== userId) {
        return res.status(403).json({
          status: 403,
          data: { message: "Forbidden: You don't own this application" },
        });
      }

      // Create document record
      const document = await kycDocumentService.create({
        kycApplicationId: id,
        userId,
        type,
        s3Key,
        mimeType,
        fileSize,
        createdAt: new Date(),
      } as any);

      // Log audit
      await kycAuditLogService.create({
        actorId: userId,
        actorType: KycAuditActorType.USER,
        action: KycAuditAction.DOC_UPLOADED,
        userId,
        kycApplicationId: id,
        note: `Document ${type} uploaded`,
        createdAt: new Date(),
      } as any);

      return res.status(201).json({
        status: 201,
        data: document,
      });
    } catch (error: any) {
      console.error("Error confirming document upload:", error);
      return res.status(500).json({
        status: 500,
        data: { message: error.message || "Internal server error" },
      });
    }
  }

  /**
   * Upload document directly from camera (base64 image)
   * POST /api/v1/inex/userkyc/documents/upload
   * 
   * Body:
   *   - image: string (base64 image data, e.g., "data:image/jpeg;base64,/9j/4AAQ...")
   *   - documentType: string (e.g., "passport", "national_id", "driving_licence")
   *   - country?: string (required for national_id or driving_licence selections)
   *   - documentCategory?: string (optional high-level type to store with application)
   *   - side?: string (optional, "front" or "back" for ID cards)
   *   - levelRequested?: number (optional, defaults to 1 if creating new application)
   * 
   * Returns: application ID in response for use with other APIs
   */
  async uploadDocumentDirect(req: Request, res: Response) {
    try {
      // TODO: For testing - will use req.user.email after uncommenting auth middleware
      const email = getEmailFromRequest(req);
      const { image, documentType, side, levelRequested, country, documentCategory } = req.body;

      if (!email) {
        return res.status(401).json({
          status: 401,
          data: { message: "Unauthorized - email is required" },
        });
      }

      // Get user by email to get userId
      const user = await userService.findOne({ email });
      if (!user) {
        return res.status(404).json({
          status: 404,
          data: { message: "User not found" },
        });
      }
      const userId = (user as any)._id?.toString();

      if (!image || !documentType) {
        return res.status(400).json({
          status: 400,
          data: { message: "image and documentType are required" },
        });
      }

      // Map frontend document type to backend enum
      let docType: KycDocumentType | null = null;
      
      // First try direct enum value
      if (Object.values(KycDocumentType).includes(documentType)) {
        docType = documentType as KycDocumentType;
      } else {
        // Map from frontend format
        docType = this.mapDocumentType(documentType);
      }

      // Handle ID cards with front/back
      if (docType === KycDocumentType.ID_FRONT && side) {
        if (side.toLowerCase() === "back") {
          docType = KycDocumentType.ID_BACK;
        }
      }

      if (!docType) {
        return res.status(400).json({
          status: 400,
          data: { 
            message: "Invalid documentType. Use: 'passport', 'national_id', 'driving_licence', 'ID_FRONT', 'ID_BACK', 'PASSPORT', 'SELFIE', or 'PROOF_OF_ADDRESS'",
            received: documentType
          },
        });
      }

      // Find or create KYC application
      let application = await kycApplicationService.findLatest({ 
        userId,
        status: { $in: [KycStatus.DRAFT, KycStatus.PENDING, KycStatus.UNDER_REVIEW] }
      });

      if (!application) {
        // Create a new draft application
        application = await kycApplicationService.create({
          userId,
          userEmail: email,
          userEmailLower: String(email).toLowerCase().trim(),
          levelRequested: levelRequested || 1,
          personalInfo: {
            firstName: "",
            lastName: "",
            dob: "",
            address: "",
            city: "",
            country: "",
            postalCode: "",
            nationality: "",
          },
          status: KycStatus.DRAFT,
          riskScore: 0,
          rejectionReason: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any);
      }

      const applicationId = (application as any)._id?.toString();

      const summaryDocumentType = this.normalizeDocumentCategory(documentCategory || documentType);
      const normalizedCountry = country ? String(country).trim() : null;

      if (
        summaryDocumentType &&
        ["national_id", "driving_licence"].includes(summaryDocumentType) &&
        !normalizedCountry
      ) {
        return res.status(400).json({
          status: 400,
          data: { message: "country is required for national_id or driving_licence document types" },
        });
      }

      const summaryUpdates: Record<string, any> = {
        userEmail: email,
        userEmailLower: String(email).toLowerCase().trim(),
        updatedAt: new Date(),
      };
      if (summaryDocumentType) {
        summaryUpdates.selectedDocumentType = summaryDocumentType;
      }
      if (normalizedCountry) {
        summaryUpdates.selectedCountry = normalizedCountry;
      }

      await kycApplicationService.updatePart(
        { _id: applicationId },
        { $set: summaryUpdates }
      );

      // Parse base64 image
      let fileBuffer: Buffer;
      let mimeType: string;

      if (typeof image === 'string') {
        // Handle data URL format: "data:image/jpeg;base64,/9j/4AAQ..."
        if (image.startsWith('data:')) {
          const matches = image.match(/^data:([^;]+);base64,(.+)$/);
          if (matches) {
            mimeType = matches[1];
            const base64Data = matches[2];
            fileBuffer = Buffer.from(base64Data, 'base64');
          } else {
            return res.status(400).json({
              status: 400,
              data: { message: "Invalid base64 image format. Expected: data:image/type;base64,..." },
            });
          }
        } else {
          // Plain base64 string
          fileBuffer = Buffer.from(image, 'base64');
          mimeType = req.body.mimeType || "image/jpeg";
        }
      } else {
        return res.status(400).json({
          status: 400,
          data: { message: "image must be a base64 string" },
        });
      }

      if (!fileBuffer || fileBuffer.length === 0) {
        return res.status(400).json({
          status: 400,
          data: { message: "Invalid image data" },
        });
      }

      // Upload to S3
      const s3Key = await s3KycService.uploadFileDirectly(
        email,
        docType,
        fileBuffer,
        mimeType
      );

      // Create document record
      const document = await kycDocumentService.create({
        kycApplicationId: applicationId,
        userId,
        type: docType,
        s3Key,
        mimeType,
        fileSize: fileBuffer.length,
        createdAt: new Date(),
      } as any);

      const latestApplication = await kycApplicationService.findOne({ _id: applicationId });

      // Log audit
      await kycAuditLogService.create({
        actorId: userId,
        actorType: KycAuditActorType.USER,
        action: KycAuditAction.DOC_UPLOADED,
        userId,
        kycApplicationId: applicationId,
        note: `Document ${docType} uploaded from camera`,
        createdAt: new Date(),
      } as any);

      return res.status(201).json({
        status: 201,
        data: {
          applicationId: applicationId, // Return application ID for use with other APIs
          userEmail: email,
          selectedDocumentType: (latestApplication as any)?.selectedDocumentType || summaryDocumentType || null,
          selectedCountry: (latestApplication as any)?.selectedCountry || normalizedCountry || null,
          document: {
            _id: (document as any)._id?.toString(),
            type: document.type,
            s3Key: document.s3Key,
            mimeType: document.mimeType,
            fileSize: document.fileSize,
            createdAt: document.createdAt,
          },
          message: "Document uploaded successfully",
        },
      });
    } catch (error: any) {
      console.error("Error uploading document:", error);
      return res.status(500).json({
        status: 500,
        data: { message: error.message || "Internal server error" },
      });
    }
  }

  /**
   * Get all documents/images for a KYC application
   * GET /api/v1/inex/userkyc/applications/:id/documents
   * 
   * Query params:
   *   - includeUrls?: boolean (optional, default: true) - Include pre-signed S3 URLs for viewing images
   */
  async getApplicationDocuments(req: Request, res: Response) {
    try {
      // TODO: For testing - will use req.user.email after uncommenting auth middleware
      const email = getEmailFromRequest(req);
      const { id } = req.params;
      const includeUrls = req.query.includeUrls !== 'false'; // Default to true

      if (!email) {
        return res.status(401).json({
          status: 401,
          data: { message: "Unauthorized - email is required" },
        });
      }

      // Validate application ID
      if (!id || id === 'null' || id === 'undefined') {
        return res.status(400).json({
          status: 400,
          data: { message: "Invalid application ID" },
        });
      }

      // Validate ObjectId format
      if (!/^[0-9a-fA-F]{24}$/.test(id)) {
        return res.status(400).json({
          status: 400,
          data: { message: "Invalid application ID format. Must be a valid MongoDB ObjectId." },
        });
      }

      // Get user by email to get userId
      const user = await userService.findOne({ email });
      if (!user) {
        return res.status(404).json({
          status: 404,
          data: { message: "User not found" },
        });
      }
      const userId = (user as any)._id?.toString();

      // Verify application ownership
      let application = await kycApplicationService.findOne({ _id: id });
      if (!application) {
        return res.status(404).json({
          status: 404,
          data: { message: "KYC application not found" },
        });
      }

      const appUserId = (application as any).userId?.toString ? (application as any).userId.toString() : String((application as any).userId);
      if (appUserId !== userId) {
        return res.status(403).json({
          status: 403,
          data: { message: "Forbidden: You don't own this application" },
        });
      }

      // Get all documents for this application
      const documents = await kycDocumentService.find({ kycApplicationId: id });

      // Generate pre-signed URLs if requested
      const documentsWithUrls = await Promise.all(
        documents.map(async (doc) => {
          const docData: any = {
            _id: (doc as any)._id?.toString(),
            type: doc.type,
            mimeType: doc.mimeType,
            fileSize: doc.fileSize,
            createdAt: doc.createdAt,
            s3Key: doc.s3Key,
          };

          if (includeUrls) {
            try {
              const viewUrl = await s3KycService.generatePresignedGetUrl(doc.s3Key);
              docData.viewUrl = viewUrl;
            } catch (error) {
              console.error(`Error generating URL for document ${doc._id}:`, error);
              docData.viewUrl = null;
            }
          }

          return docData;
        })
      );

      return res.status(200).json({
        status: 200,
        data: {
          applicationId: id,
          userEmail: (application as any).userEmail || email,
          selectedDocumentType: (application as any).selectedDocumentType || null,
          selectedCountry: (application as any).selectedCountry || null,
          documents: documentsWithUrls,
          totalDocuments: documentsWithUrls.length,
        },
      });
    } catch (error: any) {
      console.error("Error getting application documents:", error);
      return res.status(500).json({
        status: 500,
        data: { message: error.message || "Internal server error" },
      });
    }
  }

  /**
   * Delete a document for a KYC application
   * DELETE /api/v1/inex/userkyc/applications/:id/documents/:documentId
   */
  async deleteApplicationDocument(req: Request, res: Response) {
    try {
      const email = getEmailFromRequest(req);
      const { id, documentId } = req.params;

      if (!email) {
        return res.status(401).json({
          status: 401,
          data: { message: "Unauthorized - email is required" },
        });
      }

      if (!id || id === "null" || id === "undefined") {
        return res.status(400).json({
          status: 400,
          data: { message: "Invalid application ID" },
        });
      }

      if (!documentId || documentId === "null" || documentId === "undefined") {
        return res.status(400).json({
          status: 400,
          data: { message: "Invalid document ID" },
        });
      }

      if (!/^[0-9a-fA-F]{24}$/.test(id)) {
        return res.status(400).json({
          status: 400,
          data: { message: "Invalid application ID format. Must be a valid MongoDB ObjectId." },
        });
      }

      if (!/^[0-9a-fA-F]{24}$/.test(documentId)) {
        return res.status(400).json({
          status: 400,
          data: { message: "Invalid document ID format. Must be a valid MongoDB ObjectId." },
        });
      }

      const user = await userService.findOne({ email });
      if (!user) {
        return res.status(404).json({
          status: 404,
          data: { message: "User not found" },
        });
      }
      const userId = (user as any)._id?.toString();

      const application = await kycApplicationService.findOne({ _id: id });
      if (!application) {
        return res.status(404).json({
          status: 404,
          data: { message: "KYC application not found" },
        });
      }

      const appUserId = (application as any).userId?.toString ? (application as any).userId.toString() : String((application as any).userId);
      if (appUserId !== userId) {
        return res.status(403).json({
          status: 403,
          data: { message: "Forbidden: You don't own this application" },
        });
      }

      const document = await kycDocumentService.findOne({ _id: documentId, kycApplicationId: id });
      if (!document) {
        return res.status(404).json({
          status: 404,
          data: { message: "Document not found" },
        });
      }

      if ((document as any).s3Key) {
        try {
          await s3KycService.deleteObject((document as any).s3Key);
        } catch (error) {
          console.error("Error deleting KYC document from S3:", error);
          return res.status(500).json({
            status: 500,
            data: { message: "Failed to delete document file" },
          });
        }
      }

      await kycDocumentService.deleteOne({ _id: documentId });

      return res.status(200).json({
        status: 200,
        data: { message: "Document deleted successfully", documentId },
      });
    } catch (error: any) {
      console.error("Error deleting KYC document:", error);
      return res.status(500).json({
        status: 500,
        data: { message: error.message || "Internal server error" },
      });
    }
  }

  /**
   * Submit KYC application
   * POST /api/v1/inex/userkyc/applications/:id/submit
   */
  async submitApplication(req: Request, res: Response) {
    try {
      // TODO: For testing - will use req.user.email after uncommenting auth middleware
      const email = getEmailFromRequest(req);
      const { id } = req.params;

      if (!email) {
        return res.status(401).json({
          status: 401,
          data: { message: "Unauthorized - email is required" },
        });
      }

      // Get user by email to get userId
      const user = await userService.findOne({ email });
      if (!user) {
        return res.status(404).json({
          status: 404,
          data: { message: "User not found" },
        });
      }
      const userId = (user as any)._id?.toString();

      // Verify application ownership
      let application = await kycApplicationService.findOne({ _id: id });
      if (!application) {
        return res.status(404).json({
          status: 404,
          data: { message: "KYC application not found" },
        });
      }

      const appUserId = (application as any).userId?.toString ? (application as any).userId.toString() : String((application as any).userId);
      if (appUserId !== userId) {
        return res.status(403).json({
          status: 403,
          data: { message: "Forbidden: You don't own this application" },
        });
      }

      // Check required documents
      const documents = await kycDocumentService.find({ kycApplicationId: id });
      const uploadedTypes = documents.map((doc) => doc.type);

      const hasIdDocument = uploadedTypes.some((type) =>
        REQUIRED_ID_DOCUMENT_TYPES.includes(type as KycDocumentType)
      );
      const hasSelfie = uploadedTypes.includes(REQUIRED_SELFIE_DOCUMENT);

      const missingDocs: string[] = [];
      if (!hasIdDocument) {
        missingDocs.push("ID document (ID_FRONT or PASSPORT)");
      }
      if (!hasSelfie) {
        missingDocs.push(REQUIRED_SELFIE_DOCUMENT);
      }

      if (missingDocs.length > 0) {
        return res.status(400).json({
          status: 400,
          data: {
            message: `Missing required documents: ${missingDocs.join(", ")}`,
            missingDocuments: missingDocs,
          },
        });
      }

      // Update status to pending
      await kycApplicationService.updatePart(
        { _id: id },
        { $set: { status: KycStatus.PENDING, userEmail: email, userEmailLower: String(email).toLowerCase().trim(), updatedAt: new Date() } }
      );

      // Log audit
      await kycAuditLogService.create({
        actorId: userId,
        actorType: KycAuditActorType.USER,
        action: KycAuditAction.KYC_SUBMITTED,
        userId,
        kycApplicationId: id,
        note: "KYC application submitted for review",
        createdAt: new Date(),
      } as any);

      // Send email notification to user
      try {
        const emailBody = `
          <p>Dear Valued User,</p>
          <p>We have successfully received your KYC (Know Your Customer) application and all submitted documents.</p>
          <p>Your application is now <strong>pending review</strong> by our compliance team. We will carefully review your submitted documents and information.</p>
          <p>You will receive an email notification once the review process is complete. Typically, this process takes 1-3 business days.</p>
          <p>If you have any questions or need assistance during this time, please don't hesitate to contact our support team at <a href="mailto:support@indexx.ai">support@indexx.ai</a>.</p>
          <p>Thank you for your patience and for choosing Indexx Exchange.</p>
          <p>Best regards,<br />The Indexx.ai Compliance Team</p>
        `;
        
        await new SendEmail().sendGenericEmail({
          toEmail: email,
          subject: "KYC Application Received - Indexx.ai",
          bodyContent: emailBody,
          senderName: "Indexx.ai",
          senderEmail: "accounts@indexx.ai",
          replyToEmail: "wallet@indexx.ai",
        });
      } catch (emailError) {
        console.error("Error sending KYC submission confirmation email:", emailError);
        // Don't fail the request if email fails
      }

      const updated = await kycApplicationService.findOne({ _id: id });

      return res.status(200).json({
        status: 200,
        data: updated,
      });
    } catch (error: any) {
      console.error("Error submitting KYC application:", error);
      return res.status(500).json({
        status: 500,
        data: { message: error.message || "Internal server error" },
      });
    }
  }

  /**
   * Get current user KYC status
   * GET /api/v1/inex/userkyc/status
   */
  async getStatus(req: Request, res: Response) {
    try {
      // TODO: For testing - will use req.user.email after uncommenting auth middleware
      const email = getEmailFromRequest(req);

      if (!email) {
        return res.status(401).json({
          status: 401,
          data: { message: "Unauthorized - email is required" },
        });
      }

      // Get user by email to get userId
      const user = await userService.findOne({ email });
      if (!user) {
        return res.status(404).json({
          status: 404,
          data: { message: "User not found" },
        });
      }
      const userId = (user as any)._id?.toString();

      // Find latest application
      const application = await kycApplicationService.findLatest({ userId });

      if (!application) {
        return res.status(200).json({
          status: 200,
          data: {
            applicationId: null,
            levelRequested: null,
            status: null,
            rejectionReason: null,
            createdAt: null,
            updatedAt: null,
          },
        });
      }

      return res.status(200).json({
        status: 200,
        data: {
          applicationId: (application as any)._id?.toString(),
          levelRequested: application.levelRequested,
          status: application.status,
          rejectionReason: application.rejectionReason,
          createdAt: application.createdAt,
          updatedAt: application.updatedAt,
        },
      });
    } catch (error: any) {
      console.error("Error getting KYC status:", error);
      return res.status(500).json({
        status: 500,
        data: { message: error.message || "Internal server error" },
      });
    }
  }
}

