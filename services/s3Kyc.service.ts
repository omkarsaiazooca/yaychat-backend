import { S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

export class S3KycService {
  private s3: S3Client;

  constructor() {
    this.s3 = new S3Client({
      region: process.env.AWS_REGION as string,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
      },
    });
  }

  /**
   * Generate pre-signed PUT URL for uploading a KYC document
   * @param userId User ID
   * @param kycApplicationId KYC Application ID
   * @param docType Document type (ID_FRONT, ID_BACK, etc.)
   * @param mimeType MIME type of the file
   * @returns Object with uploadUrl and key
   */
  private sanitizeEmail(email: string): string {
    return email.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }

  private folderForDocType(docType: string): string {
    switch (docType) {
      case "PASSPORT":
        return "passport";
      case "ID_FRONT":
      case "ID_BACK":
      case "NATIONAL_ID":
        return "national-id";
      case "SELFIE":
        return "selfie";
      case "DRIVING_LICENCE":
      case "DRIVING_LICENSE":
        return "driving-licence";
      case "PROOF_OF_ADDRESS":
        return "proof-of-address";
      default:
        return docType.toLowerCase();
    }
  }

  private buildObjectKey(email: string, docType: string, mimeType: string): { key: string; extension: string } {
    const timestamp = Date.now();
    const extension = mimeType.split("/")[1] || "bin";
    const sanitizedEmail = this.sanitizeEmail(email);
    const folder = this.folderForDocType(docType);
    const key = `kyc/${sanitizedEmail}/${folder}/${docType}-${timestamp}.${extension}`;
    return { key, extension };
  }

  async generatePresignedPutUrl(
    userEmail: string,
    docType: string,
    mimeType: string
  ): Promise<{ uploadUrl: string; key: string }> {
    const { key } = this.buildObjectKey(userEmail, docType, mimeType);

    const command = new PutObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME as string,
      Key: key,
      ContentType: mimeType,
    });

    const uploadUrl = await getSignedUrl(this.s3, command, { expiresIn: 3600 }); // 1 hour

    return { uploadUrl, key };
  }

  /**
   * Generate pre-signed GET URL for viewing a KYC document (admin only)
   * @param s3Key S3 key of the document
   * @returns Pre-signed GET URL
   */
  async generatePresignedGetUrl(s3Key: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME as string,
      Key: s3Key,
    });

    const url = await getSignedUrl(this.s3, command, { expiresIn: 3600 }); // 1 hour

    return url;
  }

  async deleteObject(s3Key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME as string,
      Key: s3Key,
    });

    await this.s3.send(command);
  }

  /**
   * Upload file directly to S3 (for camera captures)
   * @param userId User ID
   * @param kycApplicationId KYC Application ID
   * @param docType Document type
   * @param fileBuffer File buffer
   * @param mimeType MIME type
   * @returns S3 key
   */
  async uploadFileDirectly(
    userEmail: string,
    docType: string,
    fileBuffer: Buffer,
    mimeType: string
  ): Promise<string> {
    const { key } = this.buildObjectKey(userEmail, docType, mimeType);

    const command = new PutObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME as string,
      Key: key,
      Body: fileBuffer,
      ContentType: mimeType,
    });

    await this.s3.send(command);

    return key;
  }
}

