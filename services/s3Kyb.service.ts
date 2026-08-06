import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { KybDocumentType } from "../data/kybDocument";

export class S3KybService {
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

  private sanitizeEmail(email: string): string {
    return email.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();
  }

  private mapDocTypeToFolder(docType: KybDocumentType): string {
    switch (docType) {
      case KybDocumentType.CERTIFICATE_OF_INCORPORATION:
        return "certificate";
      case KybDocumentType.SHAREHOLDER_REGISTER:
        return "shareholders";
      case KybDocumentType.DIRECTOR_ID_FRONT:
      case KybDocumentType.DIRECTOR_ID_BACK:
      case KybDocumentType.DIRECTOR_SELFIE:
        return "directors";
      case KybDocumentType.UBO_ID_DOCUMENT:
      case KybDocumentType.UBO_ID_FRONT:
      case KybDocumentType.UBO_ID_BACK:
      case KybDocumentType.UBO_SELFIE:
        return "ubos";
      case KybDocumentType.BUSINESS_PROOF_OF_ADDRESS:
        return "proof-of-address";
      case KybDocumentType.TAX_IDENTIFICATION:
        return "tax";
      case KybDocumentType.COMPANY_BANK_STATEMENT:
        return "bank-statement";
      case KybDocumentType.AUTHORIZED_SIGNATORY_SELFIE:
        return "signatory";
      default:
        return "misc";
    }
  }

  private buildObjectKey(userEmail: string, docType: KybDocumentType, mimeType: string): string {
    const sanitizedEmail = this.sanitizeEmail(userEmail);
    const folder = this.mapDocTypeToFolder(docType);
    const extension = mimeType.split("/")[1] || "bin";
    const timestamp = Date.now();
    return `kyb/${sanitizedEmail}/${folder}/${docType}-${timestamp}.${extension}`;
  }

  async generatePresignedPutUrl(
    userEmail: string,
    docType: KybDocumentType,
    mimeType: string
  ): Promise<{ uploadUrl: string; key: string }> {
    const key = this.buildObjectKey(userEmail, docType, mimeType);

    const command = new PutObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME as string,
      Key: key,
      ContentType: mimeType,
    });

    const uploadUrl = await getSignedUrl(this.s3, command, { expiresIn: 3600 });
    return { uploadUrl, key };
  }

  async uploadFileDirectly(
    userEmail: string,
    docType: KybDocumentType,
    fileBuffer: Buffer,
    mimeType: string
  ): Promise<string> {
    const key = this.buildObjectKey(userEmail, docType, mimeType);

    const command = new PutObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME as string,
      Key: key,
      Body: fileBuffer,
      ContentType: mimeType,
    });

    await this.s3.send(command);
    return key;
  }

  async generatePresignedGetUrl(s3Key: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME as string,
      Key: s3Key,
    });

    return getSignedUrl(this.s3, command, { expiresIn: 3600 });
  }

  async deleteObject(s3Key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME as string,
      Key: s3Key,
    });

    await this.s3.send(command);
  }
}


