import * as crypto from 'crypto';
import * as base32 from 'hi-base32';
import otpGenerator from 'otp-generator';

export class Totp {

    public generateHOTP(secret: string, counter: number) {
        const decodedSecret = base32.decode.asBytes(secret);
        const buffer = Buffer.alloc(8);
        for (let i = 0; i < 8; i++) {
            buffer[7 - i] = counter & 0xff;
            counter = counter >> 8;
        }

        // Step 1: Generate an HMAC-SHA-1 value
        const hmac = crypto.createHmac('sha1', Buffer.from(decodedSecret));
        hmac.update(buffer);
        const hmacResult = hmac.digest();

        // Step 2: Generate a 4-byte string (Dynamic Truncation)
        const code = this.dynamicTruncationFn(hmacResult);

        // Step 3: Compute an HOTP value
        return code % 10 ** 6;
    }

    private dynamicTruncationFn(hmacValue: any) {
        const offset = hmacValue[hmacValue.length - 1] & 0xf;

        return (
            ((hmacValue[offset] & 0x7f) << 24) |
            ((hmacValue[offset + 1] & 0xff) << 16) |
            ((hmacValue[offset + 2] & 0xff) << 8) |
            (hmacValue[offset + 3] & 0xff)
        );
    }

    public generateTOTP(secret: string, window: number = 0) {
        const counter = Math.floor(Date.now() / 30000);
        return this.generateHOTP(secret, counter + window);
    }

    public verifyTOTP(token: number, secret: string, window: number = 1) {
        if (Math.abs(+window) > 10) {
            console.error('Window size is too large');
            return false;
        }

        for (let errorWindow = -window; errorWindow <= +window; errorWindow++) {
            const totp = this.generateTOTP(secret, errorWindow);
            if (token === totp) {
                return true;
            }
        }

        return false;
    }

    public async generateOTP() {
       let res = otpGenerator.generate(6, { upperCaseAlphabets: false, specialChars: false });
       return res;
    }
}