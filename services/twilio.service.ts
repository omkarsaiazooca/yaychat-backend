const accountSid = ''; 
const authToken = ''; 
const client = require('twilio')(accountSid, authToken); 
 
export class TwilioService {

    public async sendSMS(phoneNumber: string, userName: string) {
        let otpCode = '';
        let message = `Hi ${userName}. Welcome to Indexx Exchange. Please verify yourself using the following code: ${otpCode}`
        const send = await client.messages.create({
            body: message,
            messagingServiceSid: '',
            to: phoneNumber
        });
    }
}