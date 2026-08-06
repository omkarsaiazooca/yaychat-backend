import { Twilio } from 'twilio';

export class SmsService {
  private twilioClient: Twilio | null = null;
  private useBackupProvider: boolean = false;

  constructor() {
    // Initialize Twilio client with credentials from environment variables
    try {
      this.twilioClient = new Twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );
    } catch (error) {
      console.error('Failed to initialize Twilio client:', error);
      this.useBackupProvider = true;
    }
  }

  async sendOtp(phoneNumber: string, otpCode: string): Promise<boolean> {
    try {
      // Try primary provider (Twilio)
      if (!this.useBackupProvider) {
        try {
          const message = await this.twilioClient?.messages.create({
            body: `Your verification code is: ${otpCode}. Do not share this code with anyone`,
            //from: process.env.TWILIO_PHONE_NUMBER,
            messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID,
            to: phoneNumber
          });

          console.log(`SMS sent with SID: ${message?.sid}`);
          return true;
        } catch (error) {
          console.error('Error sending SMS via Twilio:', error);
          this.useBackupProvider = true;
        }
      }

      // Fallback to backup provider (example: AWS SNS or Nexmo)
      if (this.useBackupProvider) {
        return await this.sendOtpViaBackupProvider(phoneNumber, otpCode);
      }

      return false;
    } catch (error) {
      console.error('Error in sendOtp:', error);
      return false;
    }
  }

  private async sendOtpViaBackupProvider(phoneNumber: string, otpCode: string): Promise<boolean> {
    try {
      // This is an example using AWS SNS (replace with actual implementation)
      if (process.env.AWS_SNS_ACCESS_KEY && process.env.AWS_SNS_SECRET_KEY) {
        // AWS SNS implementation
        const AWS = require('aws-sdk');
        const sns = new AWS.SNS({
          accessKeyId: process.env.AWS_SNS_ACCESS_KEY,
          secretAccessKey: process.env.AWS_SNS_SECRET_KEY,
          region: process.env.AWS_SNS_REGION || 'us-east-1'
        });

        await sns.publish({
          Message: `Your verification code is: ${otpCode}`,
          PhoneNumber: phoneNumber
        }).promise();

        console.log(`SMS sent via AWS SNS to ${phoneNumber}`);
        return true;
      }

      // Fallback to another provider like Nexmo/Vonage if AWS not configured
      if (process.env.NEXMO_API_KEY && process.env.NEXMO_API_SECRET) {
        const nexmo = require('nexmo');
        const nexmoClient = new nexmo({
          apiKey: process.env.NEXMO_API_KEY,
          apiSecret: process.env.NEXMO_API_SECRET
        });

        nexmoClient.message.sendSms(
          process.env.NEXMO_FROM_NUMBER,
          phoneNumber,
          `Your verification code is: ${otpCode}`
        );

        console.log(`SMS sent via Nexmo to ${phoneNumber}`);
        return true;
      }

      console.error('No backup SMS provider configured');
      return false;
    } catch (error) {
      console.error('Error sending SMS via backup provider:', error);
      return false;
    }
  }
}

// Export a singleton instance
export const smsService = new SmsService(); 