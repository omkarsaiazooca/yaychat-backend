import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { SocialCampaignApp } from "../data/socialCampaign";

const ALLOWED_APPS: SocialCampaignApp[] = ["bitcoinyay", "emmm"];
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];

export class S3SocialCampaignService {
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

  isValidApp(app: any): app is SocialCampaignApp {
    return ALLOWED_APPS.includes(app);
  }

  isAllowedMimeType(mimeType: any): boolean {
    return ALLOWED_MIME_TYPES.includes(String(mimeType || "").toLowerCase());
  }

  isKeyForApp(key: string, app: SocialCampaignApp): boolean {
    return String(key || "").startsWith(`social-media-campaign/${app}/`);
  }

  private sanitizeEmail(email: string): string {
    return email.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }

  private buildObjectKey(app: SocialCampaignApp, email: string, mimeType: string): { key: string; extension: string } {
    const timestamp = Date.now();
    const extension = mimeType.split("/")[1] || "bin";
    const sanitizedEmail = this.sanitizeEmail(email);
    const random = Math.random().toString(36).substring(2, 10);
    const key = `social-media-campaign/${app}/${sanitizedEmail}-${timestamp}-${random}.${extension}`;
    return { key, extension };
  }

  async generatePresignedPutUrl(
    app: SocialCampaignApp,
    email: string,
    mimeType: string
  ): Promise<{ uploadUrl: string; key: string }> {
    const { key } = this.buildObjectKey(app, email, mimeType);

    const command = new PutObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME as string,
      Key: key,
      ContentType: mimeType,
    });

    const uploadUrl = await getSignedUrl(this.s3, command, { expiresIn: 3600 });

    return { uploadUrl, key };
  }

  async generatePresignedGetUrl(s3Key: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME as string,
      Key: s3Key,
    });

    return getSignedUrl(this.s3, command, { expiresIn: 3600 });
  }
}
