import { Request, Response } from "express";
import { KybApplicationService } from "../services/kybApplication.service";
import { KybDocumentService } from "../services/kybDocument.service";
import { KybDirectorService } from "../services/kybDirector.service";
import { KybUBOService } from "../services/kybUBO.service";
import { KybTaxInfoService } from "../services/kybTaxInfo.service";
import { KybAuditLogService } from "../services/kybAuditLog.service";
import { S3KybService } from "../services/s3Kyb.service";
import { UserService } from "../services/user.service";
import { KycApplicationService } from "../services/kycApplication.service";
import { KybStatus, BusinessInfo } from "../data/kybApplication";
import { KybDocumentType } from "../data/kybDocument";
import { KybAuditAction, KybAuditActorType } from "../data/kybAuditLog";
import { UboKycStatus } from "../data/kybUBO";
import { KycStatus, PersonalInfo } from "../data/kycApplication";
import { User, UserRoleTypes } from "../data/user";
import { Currency, AuthProviders, Languages } from "../data/common";
import { SendEmail } from "../platform/email.operations";

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

const kybApplicationService = new KybApplicationService();
const kybDocumentService = new KybDocumentService();
const kybDirectorService = new KybDirectorService();
const kybUBOService = new KybUBOService();
const kybTaxInfoService = new KybTaxInfoService();
const kybAuditLogService = new KybAuditLogService();
const s3KybService = new S3KybService();
const userService = new UserService();
const kycApplicationService = new KycApplicationService();

/**
 * Helper function to get or create a user for UBO/Director
 */
async function getOrCreateUserForKyb(email: string, firstName: string, lastName: string): Promise<string> {
  let user = await userService.findOne({ email: email.toLowerCase() });
  
  if (!user) {
    // Create a new user for the UBO/Director with minimal required fields
    const newUser: any = {
      email: email.toLowerCase(),
      username: email.toLowerCase().split('@')[0] + '_' + Date.now(),
      firstName,
      lastName,
      phone: "",
      walletAddress: "",
      isPhonePublic: false,
      isEmailPublic: false,
      language: Languages.US,
      userType: "Centralized",
      role: UserRoleTypes.Standard,
      basic: {
        userId: "",
        email: email.toLowerCase(),
        firstName,
        lastName,
        role: UserRoleTypes.Standard,
        isVerified: false,
        language: Languages.US,
        profilePhoto: "",
      },
      country: "",
      userRiskLevel: "",
      authProviders: [{ provider: AuthProviders.Local }],
      verification: {
        activated: false,
        activatedOn: new Date(),
        emailVerified: false,
        emailVerifiedOn: new Date(),
        emailCode: "",
        emailCodeExpiry: new Date(),
        phoneVerified: false,
        phoneVerifiedOn: new Date(),
        phoneCode: "",
        phoneCodeExpiry: new Date(),
        photoVerified: false,
        photoVerifiedOn: new Date(),
        addressVerified: false,
        addressVerifiedOn: new Date(),
        currencyUpdated: false,
        currencyUpdatedOn: new Date(),
      },
      accounts: [],
      address: {},
      baseCurrency: Currency.USD,
      referralCodeUsed: "",
      userWallets: [],
      freeTrailUserWallets: [],
      userRewards: {},
      relationships: [],
      captainBeeRelationShips: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    user = await userService.create(newUser);
  }
  
  return (user as any)._id?.toString() || String((user as any)._id);
}

/**
 * Helper function to create a KYC application for UBO/Director
 */
async function createKycApplicationForKybPerson(
  userId: string,
  email: string,
  firstName: string,
  lastName: string,
  dateOfBirth?: string,
  nationality?: string,
  address?: string
): Promise<string | null> {
  try {
    // Check if user already has a pending or under_review KYC application
    const existingKyc = await kycApplicationService.findOne({
      userId,
      status: { $in: [KycStatus.DRAFT, KycStatus.PENDING, KycStatus.UNDER_REVIEW] },
    });

    if (existingKyc) {
      // Return existing KYC application ID
      return (existingKyc as any)._id?.toString();
    }

    // Create personal info from available data
    const personalInfo: PersonalInfo = {
      firstName,
      lastName,
      dob: dateOfBirth || "",
      address: address || "",
      city: "",
      country: "",
      postalCode: "",
      nationality: nationality || "",
    };

    // Create new KYC application
    const kycApplication = await kycApplicationService.create({
      userId,
      userEmail: email.toLowerCase(),
      userEmailLower: email.toLowerCase(),
      levelRequested: 1,
      personalInfo,
      selectedDocumentType: null,
      selectedCountry: null,
      status: KycStatus.DRAFT,
      riskScore: 0,
      rejectionReason: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    return (kycApplication as any)._id?.toString();
  } catch (error) {
    console.error("Error creating KYC application for KYB person:", error);
    return null;
  }
}

function parseBoolean(value: any, defaultValue = false): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes"].includes(normalized)) {
      return true;
    }
    if (["false", "0", "no"].includes(normalized)) {
      return false;
    }
  }
  if (typeof value === "number") {
    return value === 1;
  }
  return defaultValue;
}

function parseBase64Image(image?: string, providedMimeType?: string): { buffer: Buffer; mimeType: string } | null {
  if (!image || typeof image !== "string") {
    return null;
  }

  let mimeType = providedMimeType || "image/jpeg";
  let base64Data = image;

  if (image.startsWith("data:")) {
    const matches = image.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) {
      throw new Error("Invalid base64 image format. Expected: data:image/type;base64,...");
    }
    mimeType = matches[1];
    base64Data = matches[2];
  }

  const buffer = Buffer.from(base64Data, "base64");
  if (!buffer || buffer.length === 0) {
    throw new Error("Invalid base64 image data");
  }

  return { buffer, mimeType };
}

async function uploadPersonDocumentIfProvided(
  userEmail: string,
  docType: KybDocumentType,
  image?: string,
  providedMimeType?: string
): Promise<{ key: string; mimeType: string } | null> {
  if (!image) {
    return null;
  }

  const parsed = parseBase64Image(image, providedMimeType);
  if (!parsed) {
    return null;
  }

  const key = await s3KybService.uploadFileDirectly(userEmail, docType, parsed.buffer, parsed.mimeType);
  return { key, mimeType: parsed.mimeType };
}

type PersonDocumentCategory = "passport" | "driving_license" | "national_id";
type PersonDocumentContext = "director" | "ubo";

const PERSON_DOC_CONTEXT_MAP: Record<
  PersonDocumentContext,
  {
    single: KybDocumentType;
    front: KybDocumentType;
    back: KybDocumentType;
    selfie: KybDocumentType;
  }
> = {
  director: {
    single: KybDocumentType.DIRECTOR_ID_FRONT,
    front: KybDocumentType.DIRECTOR_ID_FRONT,
    back: KybDocumentType.DIRECTOR_ID_BACK,
    selfie: KybDocumentType.DIRECTOR_SELFIE,
  },
  ubo: {
    single: KybDocumentType.UBO_ID_DOCUMENT,
    front: KybDocumentType.UBO_ID_FRONT,
    back: KybDocumentType.UBO_ID_BACK,
    selfie: KybDocumentType.UBO_SELFIE,
  },
};

const MULTI_SIDE_DOC_TYPES: ReadonlySet<PersonDocumentCategory> = new Set(["driving_license", "national_id"]);

interface ImagePayload {
  image?: string;
  mimeType?: string;
}

interface ProcessPersonDocumentOptions {
  actorEmail: string;
  context: PersonDocumentContext;
  documentType: PersonDocumentCategory;
  single?: ImagePayload;
  front?: ImagePayload;
  back?: ImagePayload;
}

interface ProcessedPersonDocumentResult {
  documentType: PersonDocumentCategory;
  singleUpload?: { key: string; mimeType: string } | null;
  frontUpload?: { key: string; mimeType: string } | null;
  backUpload?: { key: string; mimeType: string } | null;
}

function normalizePersonDocumentCategory(value?: any): PersonDocumentCategory {
  if (!value) {
    return "passport";
  }
  const normalized = String(value).trim().toLowerCase();
  if (["driving_license", "driving_licence", "driver_license", "driver_licence"].includes(normalized)) {
    return "driving_license";
  }
  if (["national_id", "nationalid", "national-id", "id_card", "idcard"].includes(normalized)) {
    return "national_id";
  }
  return "passport";
}

function documentRequiresFrontAndBack(docType: PersonDocumentCategory): boolean {
  return MULTI_SIDE_DOC_TYPES.has(docType);
}

function buildDocumentFieldValues(result: ProcessedPersonDocumentResult) {
  const primary = result.singleUpload || result.frontUpload || null;
  return {
    idDocumentType: result.documentType,
    idDocumentS3Key: primary?.key || "",
    idDocumentMimeType: primary?.mimeType || "",
    idDocumentFrontS3Key: result.frontUpload?.key || primary?.key || "",
    idDocumentFrontMimeType: result.frontUpload?.mimeType || primary?.mimeType || "",
    idDocumentBackS3Key: result.backUpload?.key || "",
    idDocumentBackMimeType: result.backUpload?.mimeType || "",
  };
}

function deriveUboKycStatus(input: {
  documentType?: PersonDocumentCategory | string | null;
  idDocumentS3Key?: string;
  idDocumentFrontS3Key?: string;
  idDocumentBackS3Key?: string;
  selfieS3Key?: string;
}): UboKycStatus {
  const normalizedDocType = normalizePersonDocumentCategory(input.documentType);
  const requiresBothSides = documentRequiresFrontAndBack(normalizedDocType);
  const hasFront = Boolean(input.idDocumentFrontS3Key);
  const hasBack = Boolean(input.idDocumentBackS3Key);
  const hasSingle = Boolean(input.idDocumentS3Key);
  const hasIdDocument = requiresBothSides ? hasFront && hasBack : hasSingle || hasFront;
  const hasSelfie = Boolean(input.selfieS3Key);

  if (hasIdDocument) {
    return UboKycStatus.COMPLETED;
  }
  if (hasSelfie) {
    return UboKycStatus.IN_PROGRESS;
  }
  return UboKycStatus.PENDING;
}

function shouldUpgradeUboStatus(current: UboKycStatus, next: UboKycStatus): boolean {
  const rank: Record<UboKycStatus, number> = {
    [UboKycStatus.PENDING]: 0,
    [UboKycStatus.IN_PROGRESS]: 1,
    [UboKycStatus.COMPLETED]: 2,
    [UboKycStatus.FAILED]: 0,
  };
  return rank[next] > rank[current];
}

async function processPersonDocumentUploads(options: ProcessPersonDocumentOptions): Promise<ProcessedPersonDocumentResult> {
  const mapping = PERSON_DOC_CONTEXT_MAP[options.context];
  const requiresBothSides = documentRequiresFrontAndBack(options.documentType);

  if (requiresBothSides) {
    if (!options.front?.image || !options.back?.image) {
      throw new Error("Front and back images are required for the selected document type.");
    }

    const [frontUpload, backUpload] = await Promise.all([
      uploadPersonDocumentIfProvided(options.actorEmail, mapping.front, options.front.image, options.front.mimeType),
      uploadPersonDocumentIfProvided(options.actorEmail, mapping.back, options.back.image, options.back.mimeType),
    ]);

    if (!frontUpload || !backUpload) {
      throw new Error("Failed to process ID front/back images. Please try again.");
    }

    return {
      documentType: options.documentType,
      frontUpload,
      backUpload,
    };
  }

  const singleSource = options.single?.image ? options.single : options.front?.image ? options.front : undefined;

  if (!singleSource?.image) {
    throw new Error("An ID document image is required.");
  }

  const upload = await uploadPersonDocumentIfProvided(
    options.actorEmail,
    mapping.single,
    singleSource.image,
    singleSource.mimeType
  );

  if (!upload) {
    throw new Error("Failed to process the ID document image. Please try again.");
  }

  return {
    documentType: options.documentType,
    singleUpload: upload,
    frontUpload: upload,
  };
}

export class KYBUserController {
  constructor() {
    this.createApplication = this.createApplication.bind(this);
    this.updateBusinessInfo = this.updateBusinessInfo.bind(this);
    this.getPresignedUploadUrl = this.getPresignedUploadUrl.bind(this);
    this.uploadDocumentDirect = this.uploadDocumentDirect.bind(this);
    this.getApplicationDocuments = this.getApplicationDocuments.bind(this);
    this.deleteApplicationDocument = this.deleteApplicationDocument.bind(this);
    this.addDirector = this.addDirector.bind(this);
    this.updateDirector = this.updateDirector.bind(this);
    this.deleteDirector = this.deleteDirector.bind(this);
    this.getDirectors = this.getDirectors.bind(this);
    this.addUBO = this.addUBO.bind(this);
    this.updateUBO = this.updateUBO.bind(this);
    this.deleteUBO = this.deleteUBO.bind(this);
    this.getUBOs = this.getUBOs.bind(this);
    this.updateUBOKycStatus = this.updateUBOKycStatus.bind(this);
    this.addTaxInfo = this.addTaxInfo.bind(this);
    this.updateTaxInfo = this.updateTaxInfo.bind(this);
    this.getTaxInfo = this.getTaxInfo.bind(this);
    this.updateComplianceInfo = this.updateComplianceInfo.bind(this);
    this.getComplianceInfo = this.getComplianceInfo.bind(this);
    this.submitApplication = this.submitApplication.bind(this);
    this.getStatus = this.getStatus.bind(this);
    this.updateSelection = this.updateSelection.bind(this);
  }

  /**
   * Step 1: Create KYB application
   * POST /api/v1/kyb/applications
   */
  async createApplication(req: Request, res: Response) {
    try {
      const email = getEmailFromRequest(req);
      if (!email) {
        return res.status(401).json({
          status: 401,
          data: { message: "Unauthorized - email is required" },
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

      const { levelRequested = 1, entityType, country } = req.body || {};

      // Check if user already has a pending or under_review application
      const existingApp = await kybApplicationService.findOne({
        userId,
        status: { $in: [KybStatus.DRAFT, KybStatus.PENDING, KybStatus.UNDER_REVIEW] },
      });

      if (existingApp) {
        return res.status(200).json({
          status: 200,
          data: existingApp,
        });
      }

      // Create new application
      const newApplication = await kybApplicationService.create({
        userId,
        userEmail: email,
        levelRequested,
        selectedEntityType: entityType || null,
        selectedCountry: country || null,
        status: KybStatus.DRAFT,
        riskScore: 0,
        rejectionReason: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const applicationId = (newApplication as any)._id?.toString();

      // Log audit
      await kybAuditLogService.create({
        actorId: userId,
        actorType: KybAuditActorType.USER,
        action: KybAuditAction.KYB_CREATED,
        userId,
        kybApplicationId: applicationId,
        note: `KYB application created for level ${levelRequested}`,
        createdAt: new Date(),
      } as any);

      return res.status(201).json({
        status: 201,
        data: newApplication,
      });
    } catch (error: any) {
      console.error("Error creating KYB application:", error);
      return res.status(500).json({
        status: 500,
        data: { message: error.message || "Internal server error" },
      });
    }
  }

  /**
   * Step 1: Update business information
   * PUT /api/v1/kyb/applications/:id/business-info
   */
  async updateBusinessInfo(req: Request, res: Response) {
    try {
      const email = getEmailFromRequest(req);
      const { id } = req.params;
      const { businessInfo } = req.body;

      if (!email) {
        return res.status(401).json({
          status: 401,
          data: { message: "Unauthorized - email is required" },
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

      const application = await kybApplicationService.findOne({ _id: id });
      if (!application) {
        return res.status(404).json({
          status: 404,
          data: { message: "KYB application not found" },
        });
      }

      const appUserId = (application as any).userId?.toString ? (application as any).userId.toString() : String((application as any).userId);
      if (appUserId !== userId) {
        return res.status(403).json({
          status: 403,
          data: { message: "Forbidden: You don't own this application" },
        });
      }

      if (![KybStatus.DRAFT, KybStatus.NEED_MORE_INFO].includes(application.status)) {
        return res.status(400).json({
          status: 400,
          data: { message: "Application can only be updated when status is 'draft' or 'need_more_info'" },
        });
      }

      if (businessInfo) {
        await kybApplicationService.updatePart(
          { _id: id },
          { $set: { businessInfo: businessInfo as BusinessInfo, updatedAt: new Date() } }
        );
      }

      const updated = await kybApplicationService.findOne({ _id: id });

      await kybAuditLogService.create({
        actorId: userId,
        actorType: KybAuditActorType.USER,
        action: KybAuditAction.KYB_UPDATED,
        userId,
        kybApplicationId: id,
        note: "Business information updated",
        createdAt: new Date(),
      } as any);

      return res.status(200).json({
        status: 200,
        data: updated,
      });
    } catch (error: any) {
      console.error("Error updating business info:", error);
      return res.status(500).json({
        status: 500,
        data: { message: error.message || "Internal server error" },
      });
    }
  }

  /**
   * Update lightweight selection info (entity type, country)
   * PUT /api/v1/kyb/applications/:id/selection
   */
  async updateSelection(req: Request, res: Response) {
    try {
      const email = getEmailFromRequest(req);
      const { id } = req.params;
      const { entityType, country } = req.body || {};

      if (!email) {
        return res.status(401).json({
          status: 401,
          data: { message: "Unauthorized - email is required" },
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

      const application = await kybApplicationService.findOne({ _id: id });
      if (!application) {
        return res.status(404).json({
          status: 404,
          data: { message: "KYB application not found" },
        });
      }

      const appUserId = (application as any).userId?.toString ? (application as any).userId.toString() : String((application as any).userId);
      if (appUserId !== userId) {
        return res.status(403).json({
          status: 403,
          data: { message: "Forbidden: You don't own this application" },
        });
      }

      const updates: Record<string, any> = {
        updatedAt: new Date(),
      };
      if (entityType) {
        updates.selectedEntityType = entityType;
      }
      if (country) {
        updates.selectedCountry = country;
      }

      await kybApplicationService.updatePart({ _id: id }, { $set: updates });

      const refreshed = await kybApplicationService.findOne({ _id: id });

      return res.status(200).json({
        status: 200,
        data: {
          applicationId: id,
          userEmail: email,
          selectedEntityType: (refreshed as any)?.selectedEntityType || entityType || null,
          selectedCountry: (refreshed as any)?.selectedCountry || country || null,
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
   * Step 2: Get pre-signed upload URL for corporate documents
   * POST /api/v1/kyb/applications/:id/documents/presign
   */
  async getPresignedUploadUrl(req: Request, res: Response) {
    try {
      const email = getEmailFromRequest(req);
      const { id } = req.params;
      const { type, mimeType } = req.body;

      if (!email) {
        return res.status(401).json({
          status: 401,
          data: { message: "Unauthorized - email is required" },
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

      if (!type || !mimeType) {
        return res.status(400).json({
          status: 400,
          data: { message: "type and mimeType are required" },
        });
      }

      if (!Object.values(KybDocumentType).includes(type)) {
        return res.status(400).json({
          status: 400,
          data: { message: "Invalid document type" },
        });
      }

      const application = await kybApplicationService.findOne({ _id: id });
      if (!application) {
        return res.status(404).json({
          status: 404,
          data: { message: "KYB application not found" },
        });
      }

      const appUserId = (application as any).userId?.toString ? (application as any).userId.toString() : String((application as any).userId);
      if (appUserId !== userId) {
        return res.status(403).json({
          status: 403,
          data: { message: "Forbidden: You don't own this application" },
        });
      }

      const { uploadUrl, key } = await s3KybService.generatePresignedPutUrl(
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
   * Step 2: Upload document directly (base64 image or multipart/form-data)
   * POST /api/v1/kyb/documents/upload
   */
  async uploadDocumentDirect(req: Request, res: Response) {
    try {
      const email = getEmailFromRequest(req);
      const { applicationId, type, image, mimeType: providedMimeType } = req.body;

      if (!email) {
        return res.status(401).json({
          status: 401,
          data: { message: "Unauthorized - email is required" },
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

      if (!applicationId || !type) {
        return res.status(400).json({
          status: 400,
          data: { message: "applicationId and type are required" },
        });
      }

      if (!Object.values(KybDocumentType).includes(type)) {
        return res.status(400).json({
          status: 400,
          data: { message: "Invalid document type" },
        });
      }

      const application = await kybApplicationService.findOne({ _id: applicationId });
      if (!application) {
        return res.status(404).json({
          status: 404,
          data: { message: "KYB application not found" },
        });
      }

      const appUserId = (application as any).userId?.toString ? (application as any).userId.toString() : String((application as any).userId);
      if (appUserId !== userId) {
        return res.status(403).json({
          status: 403,
          data: { message: "Forbidden: You don't own this application" },
        });
      }

      // Handle base64 image upload (like KYC)
      let fileBuffer: Buffer;
      let mimeType: string;

      if (image && typeof image === 'string') {
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
          mimeType = providedMimeType || "image/jpeg";
        }
      } else if ((req as any).file) {
        // Handle multipart/form-data upload
        const file = (req as any).file;
        fileBuffer = file.buffer;
        mimeType = file.mimetype;
      } else {
        return res.status(400).json({
          status: 400,
          data: { message: "File is required. Provide either 'image' (base64) or upload file via multipart/form-data" },
        });
      }

      if (!fileBuffer || fileBuffer.length === 0) {
        return res.status(400).json({
          status: 400,
          data: { message: "Invalid file data" },
        });
      }

      const s3Key = await s3KybService.uploadFileDirectly(
        email,
        type,
        fileBuffer,
        mimeType
      );

      const document = await kybDocumentService.create({
        kybApplicationId: applicationId,
        userId,
        type,
        s3Key,
        mimeType,
        fileSize: fileBuffer.length,
        createdAt: new Date(),
      } as any);

      await kybAuditLogService.create({
        actorId: userId,
        actorType: KybAuditActorType.USER,
        action: KybAuditAction.DOCUMENT_UPLOADED,
        userId,
        kybApplicationId: applicationId,
        note: `Document uploaded: ${type}`,
        createdAt: new Date(),
      } as any);

      return res.status(201).json({
        status: 201,
        data: document,
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
   * Get all documents for an application
   * GET /api/v1/kyb/applications/:id/documents
   */
  async getApplicationDocuments(req: Request, res: Response) {
    try {
      const email = getEmailFromRequest(req);
      const { id } = req.params;

      if (!email) {
        return res.status(401).json({
          status: 401,
          data: { message: "Unauthorized - email is required" },
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

      const application = await kybApplicationService.findOne({ _id: id });
      if (!application) {
        return res.status(404).json({
          status: 404,
          data: { message: "KYB application not found" },
        });
      }

      const appUserId = (application as any).userId?.toString ? (application as any).userId.toString() : String((application as any).userId);
      if (appUserId !== userId) {
        return res.status(403).json({
          status: 403,
          data: { message: "Forbidden: You don't own this application" },
        });
      }

      const documents = await kybDocumentService.find({ kybApplicationId: id });

      const documentsWithUrls = await Promise.all(
        documents.map(async (doc: any) => {
          try {
            const url = await s3KybService.generatePresignedGetUrl(doc.s3Key);
            return {
              _id: (doc as any)._id?.toString(),
              type: doc.type,
              mimeType: doc.mimeType,
              fileSize: doc.fileSize,
              viewUrl: url,
              createdAt: doc.createdAt,
            };
          } catch (error) {
            console.error(`Error generating document URL ${doc._id}:`, error);
            return {
              _id: (doc as any)._id?.toString(),
              type: doc.type,
              mimeType: doc.mimeType,
              fileSize: doc.fileSize,
              viewUrl: null,
              createdAt: doc.createdAt,
            };
          }
        })
      );

      return res.status(200).json({
        status: 200,
        data: { documents: documentsWithUrls },
      });
    } catch (error: any) {
      console.error("Error getting documents:", error);
      return res.status(500).json({
        status: 500,
        data: { message: error.message || "Internal server error" },
      });
    }
  }

  /**
   * Step 3: Add a director
   * POST /api/v1/kyb/applications/:id/directors
   */
  async addDirector(req: Request, res: Response) {
    try {
      const email = getEmailFromRequest(req);
      const { id } = req.params;
      const {
        firstName,
        lastName,
        email: directorEmail,
        phone,
        dateOfBirth,
        nationality,
        countryOfResidence,
        address,
        position,
        ownershipPercentage,
        idDocumentType,
        idDocumentImage,
        idDocumentMimeType,
        idDocumentFrontImage,
        idDocumentFrontMimeType,
        idDocumentBackImage,
        idDocumentBackMimeType,
        selfieImage,
        selfieMimeType,
        isPep,
        isSanctioned,
      } = req.body;

      if (!email) {
        return res.status(401).json({
          status: 401,
          data: { message: "Unauthorized - email is required" },
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

      if (!firstName || !lastName || !directorEmail || !position || !dateOfBirth || !nationality || !countryOfResidence || !address) {
        return res.status(400).json({
          status: 400,
          data: { message: "firstName, lastName, email, position, dateOfBirth, nationality, countryOfResidence, and address are required" },
        });
      }

      const application = await kybApplicationService.findOne({ _id: id });
      if (!application) {
        return res.status(404).json({
          status: 404,
          data: { message: "KYB application not found" },
        });
      }

      const appUserId = (application as any).userId?.toString ? (application as any).userId.toString() : String((application as any).userId);
      if (appUserId !== userId) {
        return res.status(403).json({
          status: 403,
          data: { message: "Forbidden: You don't own this application" },
        });
      }

      // Get or create user for Director
      const directorUserId = await getOrCreateUserForKyb(directorEmail, firstName, lastName);
      
      // Automatically create KYC application for Director
      const kycApplicationId = await createKycApplicationForKybPerson(
        directorUserId,
        directorEmail,
        firstName,
        lastName,
        dateOfBirth,
        nationality,
        address
      );

      const normalizedDocumentType = normalizePersonDocumentCategory(idDocumentType);
      let documentFieldValues = {
        idDocumentType: normalizedDocumentType,
        idDocumentS3Key: "",
        idDocumentMimeType: "",
        idDocumentFrontS3Key: "",
        idDocumentFrontMimeType: "",
        idDocumentBackS3Key: "",
        idDocumentBackMimeType: "",
      };

      const hasAnyDocumentImage = !!(idDocumentImage || idDocumentFrontImage || idDocumentBackImage);

      if (hasAnyDocumentImage) {
        try {
          const processedDocs = await processPersonDocumentUploads({
            actorEmail: email,
            context: "director",
            documentType: normalizedDocumentType,
            single: { image: idDocumentImage, mimeType: idDocumentMimeType },
            front: { image: idDocumentFrontImage, mimeType: idDocumentFrontMimeType },
            back: { image: idDocumentBackImage, mimeType: idDocumentBackMimeType },
          });
          documentFieldValues = buildDocumentFieldValues(processedDocs);
        } catch (docError: any) {
          return res.status(400).json({
            status: 400,
            data: { message: docError.message || "Failed to process director ID documents" },
          });
        }
      }

      let selfieUpload: { key: string; mimeType: string } | null = null;
      try {
        selfieUpload = await uploadPersonDocumentIfProvided(
          email,
          KybDocumentType.DIRECTOR_SELFIE,
          selfieImage,
          selfieMimeType
        );
      } catch (uploadError: any) {
        return res.status(400).json({
          status: 400,
          data: { message: uploadError.message || "Failed to process director selfie" },
        });
      }

      const pepFlag = parseBoolean(isPep, false);
      const sanctionedFlag = parseBoolean(isSanctioned, false);

      const director = await kybDirectorService.create({
        kybApplicationId: id,
        userId,
        firstName,
        lastName,
        email: directorEmail,
        phone: phone || "",
        dateOfBirth: dateOfBirth || "",
        nationality: nationality || "",
        address: address || "",
        countryOfResidence: countryOfResidence || "",
        position,
        ownershipPercentage: ownershipPercentage || 0,
        idDocumentType: documentFieldValues.idDocumentType,
        idDocumentS3Key: documentFieldValues.idDocumentS3Key,
        idDocumentMimeType: documentFieldValues.idDocumentMimeType,
        idDocumentFrontS3Key: documentFieldValues.idDocumentFrontS3Key,
        idDocumentFrontMimeType: documentFieldValues.idDocumentFrontMimeType,
        idDocumentBackS3Key: documentFieldValues.idDocumentBackS3Key,
        idDocumentBackMimeType: documentFieldValues.idDocumentBackMimeType,
        selfieS3Key: selfieUpload?.key || "",
        selfieMimeType: selfieUpload?.mimeType || "",
        isPep: pepFlag,
        isSanctioned: sanctionedFlag,
        sanctionsScreeningStatus: sanctionedFlag ? "match" : "clear",
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      await kybAuditLogService.create({
        actorId: userId,
        actorType: KybAuditActorType.USER,
        action: KybAuditAction.DIRECTOR_ADDED,
        userId,
        kybApplicationId: id,
        note: `Director added: ${firstName} ${lastName}${kycApplicationId ? ' - KYC application created automatically' : ''}`,
        createdAt: new Date(),
      } as any);

      return res.status(201).json({
        status: 201,
        data: {
          ...director,
          kycApplicationCreated: !!kycApplicationId,
          kycApplicationId: kycApplicationId,
        },
      });
    } catch (error: any) {
      console.error("Error adding director:", error);
      return res.status(500).json({
        status: 500,
        data: { message: error.message || "Internal server error" },
      });
    }
  }

  /**
   * Update a director
   * PUT /api/v1/kyb/directors/:directorId
   */
  async updateDirector(req: Request, res: Response) {
    try {
      const email = getEmailFromRequest(req);
      const { directorId } = req.params;
      const {
        idDocumentType: incomingDocType,
        idDocumentImage,
        idDocumentMimeType,
        idDocumentFrontImage,
        idDocumentFrontMimeType,
        idDocumentBackImage,
        idDocumentBackMimeType,
        selfieImage,
        selfieMimeType,
        ...restUpdates
      } = req.body;
      const updateData: any = { ...restUpdates };

      if (!email) {
        return res.status(401).json({
          status: 401,
          data: { message: "Unauthorized - email is required" },
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

      const director = await kybDirectorService.findOne({ _id: directorId });
      if (!director) {
        return res.status(404).json({
          status: 404,
          data: { message: "Director not found" },
        });
      }

      const dirUserId = (director as any).userId?.toString ? (director as any).userId.toString() : String((director as any).userId);
      if (dirUserId !== userId) {
        return res.status(403).json({
          status: 403,
          data: { message: "Forbidden: You don't own this director record" },
        });
      }

      const normalizedDocumentType =
        typeof incomingDocType !== "undefined"
          ? normalizePersonDocumentCategory(incomingDocType)
          : normalizePersonDocumentCategory((director as any).idDocumentType);

      const hasNewDocumentImages = Boolean(idDocumentImage || idDocumentFrontImage || idDocumentBackImage);

      if (typeof incomingDocType !== "undefined") {
        updateData.idDocumentType = normalizedDocumentType;
      }

      if (hasNewDocumentImages) {
        try {
          const processedDocs = await processPersonDocumentUploads({
            actorEmail: email,
            context: "director",
            documentType: normalizedDocumentType,
            single: { image: idDocumentImage, mimeType: idDocumentMimeType },
            front: { image: idDocumentFrontImage, mimeType: idDocumentFrontMimeType },
            back: { image: idDocumentBackImage, mimeType: idDocumentBackMimeType },
          });
          Object.assign(updateData, buildDocumentFieldValues(processedDocs));
        } catch (docError: any) {
          return res.status(400).json({
            status: 400,
            data: { message: docError.message || "Failed to process director ID documents" },
          });
        }
      } else if (
        typeof incomingDocType !== "undefined" &&
        documentRequiresFrontAndBack(normalizedDocumentType)
      ) {
        const existingFront = (director as any).idDocumentFrontS3Key;
        const existingBack = (director as any).idDocumentBackS3Key;
        if (!existingFront || !existingBack) {
          return res.status(400).json({
            status: 400,
            data: { message: "Please upload both front and back images for the selected document type." },
          });
        }
      }

      if (selfieImage) {
        try {
          const selfieUpload = await uploadPersonDocumentIfProvided(
            email,
            KybDocumentType.DIRECTOR_SELFIE,
            selfieImage,
            selfieMimeType
          );
          if (selfieUpload) {
            updateData.selfieS3Key = selfieUpload.key;
            updateData.selfieMimeType = selfieUpload.mimeType;
          }
        } catch (selfieError: any) {
          return res.status(400).json({
            status: 400,
            data: { message: selfieError.message || "Failed to process director selfie" },
          });
        }
      }

      await kybDirectorService.updatePart(
        { _id: directorId },
        { $set: { ...updateData, updatedAt: new Date() } }
      );

      const updated = await kybDirectorService.findOne({ _id: directorId });

      return res.status(200).json({
        status: 200,
        data: updated,
      });
    } catch (error: any) {
      console.error("Error updating director:", error);
      return res.status(500).json({
        status: 500,
        data: { message: error.message || "Internal server error" },
      });
    }
  }

  /**
   * Delete a director
   * DELETE /api/v1/kyb/directors/:directorId
   */
  async deleteDirector(req: Request, res: Response) {
    try {
      const email = getEmailFromRequest(req);
      const { directorId } = req.params;

      if (!email) {
        return res.status(401).json({
          status: 401,
          data: { message: "Unauthorized - email is required" },
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

      const director = await kybDirectorService.findOne({ _id: directorId });
      if (!director) {
        return res.status(404).json({
          status: 404,
          data: { message: "Director not found" },
        });
      }

      const dirUserId = (director as any).userId?.toString ? (director as any).userId.toString() : String((director as any).userId);
      if (dirUserId !== userId) {
        return res.status(403).json({
          status: 403,
          data: { message: "Forbidden: You don't own this director record" },
        });
      }

      await kybDirectorService.deleteOne({ _id: directorId });

      await kybAuditLogService.create({
        actorId: userId,
        actorType: KybAuditActorType.USER,
        action: KybAuditAction.DIRECTOR_REMOVED,
        userId,
        kybApplicationId: (director as any).kybApplicationId?.toString(),
        note: `Director removed: ${(director as any).firstName} ${(director as any).lastName}`,
        createdAt: new Date(),
      } as any);

      return res.status(200).json({
        status: 200,
        data: { message: "Director deleted successfully" },
      });
    } catch (error: any) {
      console.error("Error deleting director:", error);
      return res.status(500).json({
        status: 500,
        data: { message: error.message || "Internal server error" },
      });
    }
  }

  /**
   * Get all directors for an application
   * GET /api/v1/kyb/applications/:id/directors
   */
  async getDirectors(req: Request, res: Response) {
    try {
      const email = getEmailFromRequest(req);
      const { id } = req.params;

      if (!email) {
        return res.status(401).json({
          status: 401,
          data: { message: "Unauthorized - email is required" },
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

      const application = await kybApplicationService.findOne({ _id: id });
      if (!application) {
        return res.status(404).json({
          status: 404,
          data: { message: "KYB application not found" },
        });
      }

      const appUserId = (application as any).userId?.toString ? (application as any).userId.toString() : String((application as any).userId);
      if (appUserId !== userId) {
        return res.status(403).json({
          status: 403,
          data: { message: "Forbidden: You don't own this application" },
        });
      }

      const directors = await kybDirectorService.find({ kybApplicationId: id });

      return res.status(200).json({
        status: 200,
        data: { directors },
      });
    } catch (error: any) {
      console.error("Error getting directors:", error);
      return res.status(500).json({
        status: 500,
        data: { message: error.message || "Internal server error" },
      });
    }
  }

  /**
   * Step 3 & 4: Add a UBO (Ultimate Beneficial Owner)
   * POST /api/v1/kyb/applications/:id/ubos
   */
  async addUBO(req: Request, res: Response) {
    try {
      const email = getEmailFromRequest(req);
      const { id } = req.params;
      const {
        firstName,
        lastName,
        email: uboEmail,
        phone,
        dateOfBirth,
        nationality,
        countryOfResidence,
        address,
        ownershipPercentage,
        relationshipToCompany,
        idDocumentType,
        idDocumentImage,
        idDocumentMimeType,
        idDocumentFrontImage,
        idDocumentFrontMimeType,
        idDocumentBackImage,
        idDocumentBackMimeType,
        selfieImage,
        selfieMimeType,
        isPep,
        isSanctioned,
      } = req.body;

      if (!email) {
        return res.status(401).json({
          status: 401,
          data: { message: "Unauthorized - email is required" },
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

      if (
        !firstName ||
        !lastName ||
        !uboEmail ||
        ownershipPercentage === undefined ||
        ownershipPercentage === null ||
        !relationshipToCompany ||
        !dateOfBirth ||
        !nationality ||
        !countryOfResidence ||
        !address
      ) {
        return res.status(400).json({
          status: 400,
          data: {
            message:
              "firstName, lastName, email, ownershipPercentage, relationshipToCompany, dateOfBirth, nationality, countryOfResidence, and address are required",
          },
        });
      }

      const application = await kybApplicationService.findOne({ _id: id });
      if (!application) {
        return res.status(404).json({
          status: 404,
          data: { message: "KYB application not found" },
        });
      }

      const appUserId = (application as any).userId?.toString ? (application as any).userId.toString() : String((application as any).userId);
      if (appUserId !== userId) {
        return res.status(403).json({
          status: 403,
          data: { message: "Forbidden: You don't own this application" },
        });
      }

      // Get or create user for UBO
      const uboUserId = await getOrCreateUserForKyb(uboEmail, firstName, lastName);
      
      // Automatically create KYC application for UBO
      const kycApplicationId = await createKycApplicationForKybPerson(
        uboUserId,
        uboEmail,
        firstName,
        lastName,
        dateOfBirth,
        nationality,
        address
      );

      const normalizedDocumentType = normalizePersonDocumentCategory(idDocumentType);

      let documentFieldValues = {
        idDocumentType: normalizedDocumentType,
        idDocumentS3Key: "",
        idDocumentMimeType: "",
        idDocumentFrontS3Key: "",
        idDocumentFrontMimeType: "",
        idDocumentBackS3Key: "",
        idDocumentBackMimeType: "",
      };

      const hasAnyDocumentImage = !!(idDocumentImage || idDocumentFrontImage || idDocumentBackImage);

      if (hasAnyDocumentImage) {
        try {
          const processedDocs = await processPersonDocumentUploads({
            actorEmail: email,
            context: "ubo",
            documentType: normalizedDocumentType,
            single: { image: idDocumentImage, mimeType: idDocumentMimeType },
            front: { image: idDocumentFrontImage, mimeType: idDocumentFrontMimeType },
            back: { image: idDocumentBackImage, mimeType: idDocumentBackMimeType },
          });
          documentFieldValues = buildDocumentFieldValues(processedDocs);
        } catch (docError: any) {
          return res.status(400).json({
            status: 400,
            data: { message: docError.message || "Failed to process UBO ID documents" },
          });
        }
      }

      let selfieUpload: { key: string; mimeType: string } | null = null;
      try {
        selfieUpload = await uploadPersonDocumentIfProvided(
          email,
          KybDocumentType.UBO_SELFIE,
          selfieImage,
          selfieMimeType
        );
      } catch (uploadError: any) {
        return res.status(400).json({
          status: 400,
          data: { message: uploadError.message || "Failed to process UBO selfie" },
        });
      }

      const pepFlag = parseBoolean(isPep, false);
      const sanctionedFlag = parseBoolean(isSanctioned, false);

      const uboKycStatus = deriveUboKycStatus({
        documentType: normalizedDocumentType,
        idDocumentS3Key: documentFieldValues.idDocumentS3Key,
        idDocumentFrontS3Key: documentFieldValues.idDocumentFrontS3Key,
        idDocumentBackS3Key: documentFieldValues.idDocumentBackS3Key,
        selfieS3Key: selfieUpload?.key,
      });

      const ubo = await kybUBOService.create({
        kybApplicationId: id,
        userId,
        firstName,
        lastName,
        email: uboEmail,
        phone: phone || "",
        dateOfBirth: dateOfBirth || "",
        nationality: nationality || "",
        address: address || "",
        countryOfResidence: countryOfResidence || "",
        ownershipPercentage,
        relationshipToCompany,
        idDocumentType: documentFieldValues.idDocumentType,
        idDocumentS3Key: documentFieldValues.idDocumentS3Key,
        idDocumentMimeType: documentFieldValues.idDocumentMimeType,
        idDocumentFrontS3Key: documentFieldValues.idDocumentFrontS3Key,
        idDocumentFrontMimeType: documentFieldValues.idDocumentFrontMimeType,
        idDocumentBackS3Key: documentFieldValues.idDocumentBackS3Key,
        idDocumentBackMimeType: documentFieldValues.idDocumentBackMimeType,
        selfieS3Key: selfieUpload?.key || "",
        selfieMimeType: selfieUpload?.mimeType || "",
        isPep: pepFlag,
        isSanctioned: sanctionedFlag,
        sanctionsScreeningStatus: sanctionedFlag ? "match" : "clear",
        kycStatus: uboKycStatus,
        kycApplicationId: kycApplicationId || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      await kybAuditLogService.create({
        actorId: userId,
        actorType: KybAuditActorType.USER,
        action: KybAuditAction.UBO_ADDED,
        userId,
        kybApplicationId: id,
        note: `UBO added: ${firstName} ${lastName}${kycApplicationId ? ' - KYC application created automatically' : ''}`,
        createdAt: new Date(),
      } as any);

      return res.status(201).json({
        status: 201,
        data: {
          ...ubo,
          kycApplicationCreated: !!kycApplicationId,
          kycApplicationId: kycApplicationId,
        },
      });
    } catch (error: any) {
      console.error("Error adding UBO:", error);
      return res.status(500).json({
        status: 500,
        data: { message: error.message || "Internal server error" },
      });
    }
  }

  /**
   * Update a UBO
   * PUT /api/v1/kyb/ubos/:uboId
   */
  async updateUBO(req: Request, res: Response) {
    try {
      const email = getEmailFromRequest(req);
      const { uboId } = req.params;
      const {
        idDocumentType: incomingDocType,
        idDocumentImage,
        idDocumentMimeType,
        idDocumentFrontImage,
        idDocumentFrontMimeType,
        idDocumentBackImage,
        idDocumentBackMimeType,
        selfieImage,
        selfieMimeType,
        ...restUpdates
      } = req.body;
      const updateData: any = { ...restUpdates };

      if (!email) {
        return res.status(401).json({
          status: 401,
          data: { message: "Unauthorized - email is required" },
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

      const ubo = await kybUBOService.findOne({ _id: uboId });
      if (!ubo) {
        return res.status(404).json({
          status: 404,
          data: { message: "UBO not found" },
        });
      }

      const uboUserId = (ubo as any).userId?.toString ? (ubo as any).userId.toString() : String((ubo as any).userId);
      if (uboUserId !== userId) {
        return res.status(403).json({
          status: 403,
          data: { message: "Forbidden: You don't own this UBO record" },
        });
      }

      const normalizedDocumentType =
        typeof incomingDocType !== "undefined"
          ? normalizePersonDocumentCategory(incomingDocType)
          : normalizePersonDocumentCategory((ubo as any).idDocumentType);

      const hasNewDocumentImages = Boolean(idDocumentImage || idDocumentFrontImage || idDocumentBackImage);

      if (typeof incomingDocType !== "undefined") {
        updateData.idDocumentType = normalizedDocumentType;
      }

      if (hasNewDocumentImages) {
        try {
          const processedDocs = await processPersonDocumentUploads({
            actorEmail: email,
            context: "ubo",
            documentType: normalizedDocumentType,
            single: { image: idDocumentImage, mimeType: idDocumentMimeType },
            front: { image: idDocumentFrontImage, mimeType: idDocumentFrontMimeType },
            back: { image: idDocumentBackImage, mimeType: idDocumentBackMimeType },
          });
          Object.assign(updateData, buildDocumentFieldValues(processedDocs));
        } catch (docError: any) {
          return res.status(400).json({
            status: 400,
            data: { message: docError.message || "Failed to process UBO ID documents" },
          });
        }
      } else if (
        typeof incomingDocType !== "undefined" &&
        documentRequiresFrontAndBack(normalizedDocumentType)
      ) {
        const existingFront = (ubo as any).idDocumentFrontS3Key;
        const existingBack = (ubo as any).idDocumentBackS3Key;
        if (!existingFront || !existingBack) {
          return res.status(400).json({
            status: 400,
            data: { message: "Please upload both front and back images for the selected document type." },
          });
        }
      }

      if (selfieImage) {
        try {
          const selfieUpload = await uploadPersonDocumentIfProvided(
            email,
            KybDocumentType.UBO_SELFIE,
            selfieImage,
            selfieMimeType
          );
          if (selfieUpload) {
            updateData.selfieS3Key = selfieUpload.key;
            updateData.selfieMimeType = selfieUpload.mimeType;
          }
        } catch (selfieError: any) {
          return res.status(400).json({
            status: 400,
            data: { message: selfieError.message || "Failed to process UBO selfie" },
          });
        }
      }

      const currentStatus = ((ubo as any).kycStatus as UboKycStatus) || UboKycStatus.PENDING;
      const merged = {
        ...ubo,
        ...updateData,
      } as any;
      const nextStatus = deriveUboKycStatus({
        documentType: merged.idDocumentType,
        idDocumentS3Key: merged.idDocumentS3Key,
        idDocumentFrontS3Key: merged.idDocumentFrontS3Key,
        idDocumentBackS3Key: merged.idDocumentBackS3Key,
        selfieS3Key: merged.selfieS3Key,
      });
      if (shouldUpgradeUboStatus(currentStatus, nextStatus)) {
        updateData.kycStatus = nextStatus;
      }

      await kybUBOService.updatePart(
        { _id: uboId },
        { $set: { ...updateData, updatedAt: new Date() } }
      );

      const updated = await kybUBOService.findOne({ _id: uboId });

      return res.status(200).json({
        status: 200,
        data: updated,
      });
    } catch (error: any) {
      console.error("Error updating UBO:", error);
      return res.status(500).json({
        status: 500,
        data: { message: error.message || "Internal server error" },
      });
    }
  }

  /**
   * Delete a UBO
   * DELETE /api/v1/kyb/ubos/:uboId
   */
  async deleteUBO(req: Request, res: Response) {
    try {
      const email = getEmailFromRequest(req);
      const { uboId } = req.params;

      if (!email) {
        return res.status(401).json({
          status: 401,
          data: { message: "Unauthorized - email is required" },
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

      const ubo = await kybUBOService.findOne({ _id: uboId });
      if (!ubo) {
        return res.status(404).json({
          status: 404,
          data: { message: "UBO not found" },
        });
      }

      const uboUserId = (ubo as any).userId?.toString ? (ubo as any).userId.toString() : String((ubo as any).userId);
      if (uboUserId !== userId) {
        return res.status(403).json({
          status: 403,
          data: { message: "Forbidden: You don't own this UBO record" },
        });
      }

      await kybUBOService.deleteOne({ _id: uboId });

      await kybAuditLogService.create({
        actorId: userId,
        actorType: KybAuditActorType.USER,
        action: KybAuditAction.UBO_REMOVED,
        userId,
        kybApplicationId: (ubo as any).kybApplicationId?.toString(),
        note: `UBO removed: ${(ubo as any).firstName} ${(ubo as any).lastName}`,
        createdAt: new Date(),
      } as any);

      return res.status(200).json({
        status: 200,
        data: { message: "UBO deleted successfully" },
      });
    } catch (error: any) {
      console.error("Error deleting UBO:", error);
      return res.status(500).json({
        status: 500,
        data: { message: error.message || "Internal server error" },
      });
    }
  }

  /**
   * Get all UBOs for an application
   * GET /api/v1/kyb/applications/:id/ubos
   */
  async getUBOs(req: Request, res: Response) {
    try {
      const email = getEmailFromRequest(req);
      const { id } = req.params;

      if (!email) {
        return res.status(401).json({
          status: 401,
          data: { message: "Unauthorized - email is required" },
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

      const application = await kybApplicationService.findOne({ _id: id });
      if (!application) {
        return res.status(404).json({
          status: 404,
          data: { message: "KYB application not found" },
        });
      }

      const appUserId = (application as any).userId?.toString ? (application as any).userId.toString() : String((application as any).userId);
      if (appUserId !== userId) {
        return res.status(403).json({
          status: 403,
          data: { message: "Forbidden: You don't own this application" },
        });
      }

      const ubos = await kybUBOService.find({ kybApplicationId: id });

      return res.status(200).json({
        status: 200,
        data: { ubos },
      });
    } catch (error: any) {
      console.error("Error getting UBOs:", error);
      return res.status(500).json({
        status: 500,
        data: { message: error.message || "Internal server error" },
      });
    }
  }

  /**
   * Step 4: Update UBO KYC status (when UBO completes their KYC)
   * PUT /api/v1/kyb/ubos/:uboId/kyc-status
   */
  async updateUBOKycStatus(req: Request, res: Response) {
    try {
      const email = getEmailFromRequest(req);
      const { uboId } = req.params;
      const { kycStatus, kycApplicationId } = req.body;

      if (!email) {
        return res.status(401).json({
          status: 401,
          data: { message: "Unauthorized - email is required" },
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

      const ubo = await kybUBOService.findOne({ _id: uboId });
      if (!ubo) {
        return res.status(404).json({
          status: 404,
          data: { message: "UBO not found" },
        });
      }

      const uboUserId = (ubo as any).userId?.toString ? (ubo as any).userId.toString() : String((ubo as any).userId);
      if (uboUserId !== userId) {
        return res.status(403).json({
          status: 403,
          data: { message: "Forbidden: You don't own this UBO record" },
        });
      }

      if (kycStatus && !Object.values(UboKycStatus).includes(kycStatus)) {
        return res.status(400).json({
          status: 400,
          data: { message: "Invalid KYC status" },
        });
      }

      // If KYC is completed, verify the KYC application exists and is approved
      if (kycStatus === UboKycStatus.COMPLETED && kycApplicationId) {
        const kycApp = await kycApplicationService.findOne({ _id: kycApplicationId });
        if (!kycApp) {
          return res.status(404).json({
            status: 404,
            data: { message: "KYC application not found" },
          });
        }
        if (kycApp.status !== KycStatus.APPROVED) {
          return res.status(400).json({
            status: 400,
            data: { message: "KYC application must be approved before marking UBO KYC as completed" },
          });
        }
      }

      const updates: Record<string, any> = { updatedAt: new Date() };
      if (kycStatus) {
        updates.kycStatus = kycStatus;
      }
      if (kycApplicationId) {
        updates.kycApplicationId = kycApplicationId;
      }

      await kybUBOService.updatePart({ _id: uboId }, { $set: updates });

      const updated = await kybUBOService.findOne({ _id: uboId });

      await kybAuditLogService.create({
        actorId: userId,
        actorType: KybAuditActorType.USER,
        action: KybAuditAction.UBO_KYC_UPDATED,
        userId,
        kybApplicationId: (ubo as any).kybApplicationId?.toString(),
        note: `UBO KYC status updated to ${kycStatus}`,
        createdAt: new Date(),
      } as any);

      return res.status(200).json({
        status: 200,
        data: updated,
      });
    } catch (error: any) {
      console.error("Error updating UBO KYC status:", error);
      return res.status(500).json({
        status: 500,
        data: { message: error.message || "Internal server error" },
      });
    }
  }

  /**
   * Step 5: Add tax information
   * POST /api/v1/kyb/applications/:id/tax-info
   */
  async addTaxInfo(req: Request, res: Response) {
    try {
      const email = getEmailFromRequest(req);
      const { id } = req.params;
      const { taxIdentificationNumber, taxCountry, taxDocumentS3Key, vatNumber, fatcaStatus } = req.body;

      if (!email) {
        return res.status(401).json({
          status: 401,
          data: { message: "Unauthorized - email is required" },
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

      if (!taxIdentificationNumber || !taxCountry) {
        return res.status(400).json({
          status: 400,
          data: { message: "taxIdentificationNumber and taxCountry are required" },
        });
      }

      const application = await kybApplicationService.findOne({ _id: id });
      if (!application) {
        return res.status(404).json({
          status: 404,
          data: { message: "KYB application not found" },
        });
      }

      const appUserId = (application as any).userId?.toString ? (application as any).userId.toString() : String((application as any).userId);
      if (appUserId !== userId) {
        return res.status(403).json({
          status: 403,
          data: { message: "Forbidden: You don't own this application" },
        });
      }

      // Check if tax info already exists
      const existingTaxInfo = await kybTaxInfoService.findOne({ kybApplicationId: id });
      if (existingTaxInfo) {
        // Update existing
        await kybTaxInfoService.updatePart(
          { _id: (existingTaxInfo as any)._id },
          {
            $set: {
              taxIdentificationNumber,
              taxCountry,
              taxDocumentS3Key: taxDocumentS3Key ?? (existingTaxInfo as any).taxDocumentS3Key,
              vatNumber: vatNumber !== undefined ? vatNumber : (existingTaxInfo as any).vatNumber || "",
              fatcaStatus: fatcaStatus !== undefined ? fatcaStatus : (existingTaxInfo as any).fatcaStatus || "",
              updatedAt: new Date(),
            },
          }
        );
        const updated = await kybTaxInfoService.findOne({ _id: (existingTaxInfo as any)._id });

        await kybAuditLogService.create({
          actorId: userId,
          actorType: KybAuditActorType.USER,
          action: KybAuditAction.TAX_INFO_UPDATED,
          userId,
          kybApplicationId: id,
          note: "Tax information updated",
          createdAt: new Date(),
        } as any);

        return res.status(200).json({
          status: 200,
          data: updated,
        });
      } else {
        // Create new
        const taxInfo = await kybTaxInfoService.create({
          kybApplicationId: id,
          userId,
          taxIdentificationNumber,
          taxCountry,
          taxDocumentS3Key: taxDocumentS3Key || "",
          vatNumber: vatNumber || "",
          fatcaStatus: fatcaStatus || "",
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any);

        await kybAuditLogService.create({
          actorId: userId,
          actorType: KybAuditActorType.USER,
          action: KybAuditAction.TAX_INFO_ADDED,
          userId,
          kybApplicationId: id,
          note: "Tax information added",
          createdAt: new Date(),
        } as any);

        return res.status(201).json({
          status: 201,
          data: taxInfo,
        });
      }
    } catch (error: any) {
      console.error("Error adding tax info:", error);
      return res.status(500).json({
        status: 500,
        data: { message: error.message || "Internal server error" },
      });
    }
  }

  /**
   * Step 6: Update AML / Compliance questionnaire
   * PUT /api/v1/kyb/applications/:id/compliance-info
   */
  async updateComplianceInfo(req: Request, res: Response) {
    try {
      const email = getEmailFromRequest(req);
      const { id } = req.params;
      const {
        purposeOfUse,
        expectedMonthlyVolume,
        expectedTransactionCount,
        expectedTransactionSize,
        sourceOfFunds,
        sourceOfWealth,
        dealsWithCrypto,
        dealsWithCashIntensive,
        dealsWithHighRiskCountries,
      } = req.body || {};

      if (!email) {
        return res.status(401).json({
          status: 401,
          data: { message: "Unauthorized - email is required" },
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

      if (
        !purposeOfUse ||
        !expectedMonthlyVolume ||
        !expectedTransactionCount ||
        !expectedTransactionSize ||
        !sourceOfFunds ||
        !sourceOfWealth
      ) {
        return res.status(400).json({
          status: 400,
          data: { message: "All AML compliance fields are required" },
        });
      }

      const application = await kybApplicationService.findOne({ _id: id });
      if (!application) {
        return res.status(404).json({
          status: 404,
          data: { message: "KYB application not found" },
        });
      }

      const appUserId = (application as any).userId?.toString ? (application as any).userId.toString() : String((application as any).userId);
      if (appUserId !== userId) {
        return res.status(403).json({
          status: 403,
          data: { message: "Forbidden: You don't own this application" },
        });
      }

      const complianceInfo = {
        purposeOfUse,
        expectedMonthlyVolume,
        expectedTransactionCount,
        expectedTransactionSize,
        sourceOfFunds,
        sourceOfWealth,
        dealsWithCrypto: parseBoolean(dealsWithCrypto, false),
        dealsWithCashIntensive: parseBoolean(dealsWithCashIntensive, false),
        dealsWithHighRiskCountries: parseBoolean(dealsWithHighRiskCountries, false),
      };

      await kybApplicationService.updatePart(
        { _id: id },
        {
          $set: {
            complianceInfo,
            updatedAt: new Date(),
          },
        }
      );

      await kybAuditLogService.create({
        actorId: userId,
        actorType: KybAuditActorType.USER,
        action: KybAuditAction.KYB_UPDATED,
        userId,
        kybApplicationId: id,
        note: "AML compliance questionnaire updated",
        createdAt: new Date(),
      } as any);

      const updated = await kybApplicationService.findOne({ _id: id });

      return res.status(200).json({
        status: 200,
        data: updated,
      });
    } catch (error: any) {
      console.error("Error updating compliance info:", error);
      return res.status(500).json({
        status: 500,
        data: { message: error.message || "Internal server error" },
      });
    }
  }

  /**
   * Delete a document for a KYB application
   * DELETE /api/v1/kyb/applications/:id/documents/:documentId
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

      const application = await kybApplicationService.findOne({ _id: id });
      if (!application) {
        return res.status(404).json({
          status: 404,
          data: { message: "KYB application not found" },
        });
      }

      const appUserId = (application as any).userId?.toString ? (application as any).userId.toString() : String((application as any).userId);
      if (appUserId !== userId) {
        return res.status(403).json({
          status: 403,
          data: { message: "Forbidden: You don't own this application" },
        });
      }

      const document = await kybDocumentService.findOne({ _id: documentId, kybApplicationId: id });
      if (!document) {
        return res.status(404).json({
          status: 404,
          data: { message: "Document not found" },
        });
      }

      if ((document as any).s3Key) {
        try {
          await s3KybService.deleteObject((document as any).s3Key);
        } catch (error) {
          console.error("Error deleting KYB document from S3:", error);
          return res.status(500).json({
            status: 500,
            data: { message: "Failed to delete document file" },
          });
        }
      }

      await kybDocumentService.deleteOne({ _id: documentId });

      return res.status(200).json({
        status: 200,
        data: { message: "Document deleted successfully", documentId },
      });
    } catch (error: any) {
      console.error("Error deleting KYB document:", error);
      return res.status(500).json({
        status: 500,
        data: { message: error.message || "Internal server error" },
      });
    }
  }

  /**
   * Step 6: Get AML / Compliance questionnaire
   * GET /api/v1/kyb/applications/:id/compliance-info
   */
  async getComplianceInfo(req: Request, res: Response) {
    try {
      const email = getEmailFromRequest(req);
      const { id } = req.params;

      if (!email) {
        return res.status(401).json({
          status: 401,
          data: { message: "Unauthorized - email is required" },
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

      const application = await kybApplicationService.findOne({ _id: id });
      if (!application) {
        return res.status(404).json({
          status: 404,
          data: { message: "KYB application not found" },
        });
      }

      const appUserId = (application as any).userId?.toString ? (application as any).userId.toString() : String((application as any).userId);
      if (appUserId !== userId) {
        return res.status(403).json({
          status: 403,
          data: { message: "Forbidden: You don't own this application" },
        });
      }

      return res.status(200).json({
        status: 200,
        data: (application as any).complianceInfo || null,
      });
    } catch (error: any) {
      console.error("Error getting compliance info:", error);
      return res.status(500).json({
        status: 500,
        data: { message: error.message || "Internal server error" },
      });
    }
  }

  /**
   * Update tax information
   * PUT /api/v1/kyb/tax-info/:taxInfoId
   */
  async updateTaxInfo(req: Request, res: Response) {
    try {
      const email = getEmailFromRequest(req);
      const { taxInfoId } = req.params;
      const updateData = req.body;

      if (!email) {
        return res.status(401).json({
          status: 401,
          data: { message: "Unauthorized - email is required" },
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

      const taxInfo = await kybTaxInfoService.findOne({ _id: taxInfoId });
      if (!taxInfo) {
        return res.status(404).json({
          status: 404,
          data: { message: "Tax information not found" },
        });
      }

      const taxUserId = (taxInfo as any).userId?.toString ? (taxInfo as any).userId.toString() : String((taxInfo as any).userId);
      if (taxUserId !== userId) {
        return res.status(403).json({
          status: 403,
          data: { message: "Forbidden: You don't own this tax information" },
        });
      }

      await kybTaxInfoService.updatePart(
        { _id: taxInfoId },
        { $set: { ...updateData, updatedAt: new Date() } }
      );

      const updated = await kybTaxInfoService.findOne({ _id: taxInfoId });

      return res.status(200).json({
        status: 200,
        data: updated,
      });
    } catch (error: any) {
      console.error("Error updating tax info:", error);
      return res.status(500).json({
        status: 500,
        data: { message: error.message || "Internal server error" },
      });
    }
  }

  /**
   * Get tax information for an application
   * GET /api/v1/kyb/applications/:id/tax-info
   */
  async getTaxInfo(req: Request, res: Response) {
    try {
      const email = getEmailFromRequest(req);
      const { id } = req.params;

      if (!email) {
        return res.status(401).json({
          status: 401,
          data: { message: "Unauthorized - email is required" },
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

      const application = await kybApplicationService.findOne({ _id: id });
      if (!application) {
        return res.status(404).json({
          status: 404,
          data: { message: "KYB application not found" },
        });
      }

      const appUserId = (application as any).userId?.toString ? (application as any).userId.toString() : String((application as any).userId);
      if (appUserId !== userId) {
        return res.status(403).json({
          status: 403,
          data: { message: "Forbidden: You don't own this application" },
        });
      }

      const taxInfo = await kybTaxInfoService.findOne({ kybApplicationId: id });

      return res.status(200).json({
        status: 200,
        data: taxInfo || null,
      });
    } catch (error: any) {
      console.error("Error getting tax info:", error);
      return res.status(500).json({
        status: 500,
        data: { message: error.message || "Internal server error" },
      });
    }
  }

  /**
   * Step 9: Submit KYB application for review
   * POST /api/v1/kyb/applications/:id/submit
   */
  async submitApplication(req: Request, res: Response) {
    try {
      const email = getEmailFromRequest(req);
      const { id } = req.params;

      if (!email) {
        return res.status(401).json({
          status: 401,
          data: { message: "Unauthorized - email is required" },
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

      const application = await kybApplicationService.findOne({ _id: id });
      if (!application) {
        return res.status(404).json({
          status: 404,
          data: { message: "KYB application not found" },
        });
      }

      const appUserId = (application as any).userId?.toString ? (application as any).userId.toString() : String((application as any).userId);
      if (appUserId !== userId) {
        return res.status(403).json({
          status: 403,
          data: { message: "Forbidden: You don't own this application" },
        });
      }

      if (application.status !== KybStatus.DRAFT && application.status !== KybStatus.NEED_MORE_INFO) {
        return res.status(400).json({
          status: 400,
          data: { message: "Application can only be submitted from 'draft' or 'need_more_info' status" },
        });
      }

      // Basic validation - check if required fields are present
      if (!application.businessInfo) {
        return res.status(400).json({
          status: 400,
          data: { message: "Business information is required" },
        });
      }

      // Check if at least one director is added
      const directors = await kybDirectorService.find({ kybApplicationId: id });
      if (directors.length === 0) {
        return res.status(400).json({
          status: 400,
          data: { message: "At least one director is required" },
        });
      }

      // Check if all UBOs have completed KYC
      const ubos = await kybUBOService.find({ kybApplicationId: id });
      if (ubos.length > 0) {
        const incompleteUBOs = ubos.filter((ubo: any) => ubo.kycStatus !== UboKycStatus.COMPLETED);
        if (incompleteUBOs.length > 0) {
          return res.status(400).json({
            status: 400,
            data: { message: "All UBOs must complete their KYC before submission" },
          });
        }
      }

      // Update status to pending
      await kybApplicationService.updatePart(
        { _id: id },
        {
          $set: {
            status: KybStatus.PENDING,
            updatedAt: new Date(),
          },
        }
      );

      await kybAuditLogService.create({
        actorId: userId,
        actorType: KybAuditActorType.USER,
        action: KybAuditAction.KYB_SUBMITTED,
        userId,
        kybApplicationId: id,
        note: "KYB application submitted for review",
        createdAt: new Date(),
      } as any);

      // Send email notification to user
      try {
        const emailBody = `
          <p>Dear Valued User,</p>
          <p>We have successfully received your KYB (Know Your Business) application and all submitted documents.</p>
          <p>Your application is now <strong>pending review</strong> by our compliance team. We will carefully review your submitted documents, business information, and all associated details.</p>
          <p>You will receive an email notification once the review process is complete. Typically, this process takes 1-3 business days.</p>
          <p>If you have any questions or need assistance during this time, please don't hesitate to contact our support team at <a href="mailto:support@indexx.ai">support@indexx.ai</a>.</p>
          <p>Thank you for your patience and for choosing Indexx Exchange.</p>
          <p>Best regards,<br />The Indexx.ai Compliance Team</p>
        `;
        
        await new SendEmail().sendGenericEmail({
          toEmail: email,
          subject: "KYB Application Received - Indexx.ai",
          bodyContent: emailBody,
          senderName: "Indexx.ai",
          senderEmail: "accounts@indexx.ai",
          replyToEmail: "wallet@indexx.ai",
        });
      } catch (emailError) {
        console.error("Error sending KYB submission confirmation email:", emailError);
        // Don't fail the request if email fails
      }

      const updated = await kybApplicationService.findOne({ _id: id });

      return res.status(200).json({
        status: 200,
        data: updated,
      });
    } catch (error: any) {
      console.error("Error submitting KYB application:", error);
      return res.status(500).json({
        status: 500,
        data: { message: error.message || "Internal server error" },
      });
    }
  }

  /**
   * Get KYB application status
   * GET /api/v1/kyb/status
   */
  async getStatus(req: Request, res: Response) {
    try {
      const email = getEmailFromRequest(req);
      if (!email) {
        return res.status(401).json({
          status: 401,
          data: { message: "Unauthorized - email is required" },
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

      const application = await kybApplicationService.findOne({ userId });

      if (!application) {
        return res.status(200).json({
          status: 200,
          data: {
            hasApplication: false,
            application: null,
          },
        });
      }

      const applicationId = (application as any)._id?.toString();
      const documents = await kybDocumentService.find({ kybApplicationId: applicationId });
      const directors = await kybDirectorService.find({ kybApplicationId: applicationId });
      const ubos = await kybUBOService.find({ kybApplicationId: applicationId });
      const taxInfo = await kybTaxInfoService.findOne({ kybApplicationId: applicationId });

      return res.status(200).json({
        status: 200,
        data: {
          hasApplication: true,
          application: {
            _id: applicationId,
            status: application.status,
            businessInfo: application.businessInfo,
            selectedEntityType: application.selectedEntityType,
            selectedCountry: application.selectedCountry,
            levelRequested: application.levelRequested,
            riskScore: application.riskScore,
            rejectionReason: application.rejectionReason,
            documentsCount: documents.length,
            directorsCount: directors.length,
            ubosCount: ubos.length,
            hasTaxInfo: !!taxInfo,
            allUBOsCompletedKYC: ubos.length > 0 ? ubos.every((ubo: any) => ubo.kycStatus === UboKycStatus.COMPLETED) : true,
            createdAt: application.createdAt,
            updatedAt: application.updatedAt,
          },
        },
      });
    } catch (error: any) {
      console.error("Error getting KYB status:", error);
      return res.status(500).json({
        status: 500,
        data: { message: error.message || "Internal server error" },
      });
    }
  }
}
