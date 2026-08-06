import * as crypto from 'crypto';
import { keys } from '../config/keys';
const secret = keys.cryptography.key;
const rounds = 9921;
const keySize = 32;
const algorithm = 'aes-256-cbc';
const salt = crypto.createHash('sha1').update(secret).digest("hex");

export function encryptData(data: any) {
    try {
        let iv = crypto.randomBytes(16);
        let key = crypto.pbkdf2Sync(secret, salt, rounds, keySize, 'sha512');
        let cipher = crypto.createCipheriv(algorithm, Buffer.from(key), iv);
        let encryptedData = Buffer.concat([cipher.update(JSON.stringify(data)), cipher.final()]);
        return iv.toString('base64') + ':' + encryptedData.toString('base64');
    }
    catch (err) {
        console.error(err)
        return false;
    }
}

export function decryptData(encData: any) {
    try {
        let textParts = encData.split(':');
        if (textParts.length !== 2) {
            throw new Error('Invalid encrypted data format');
        }
        let iv = Buffer.from(textParts.shift(), 'base64');
        if (iv.length !== 16) {
            throw new Error('Invalid IV length');
        }
        let encryptedData = Buffer.from(textParts.join(':'), 'base64');
        let key = crypto.pbkdf2Sync(secret, salt, rounds, keySize, 'sha512');
        let decipher = crypto.createDecipheriv(algorithm, Buffer.from(key), iv);
        let decryptedData = decipher.update(encryptedData);
        decryptedData = Buffer.concat([decryptedData, decipher.final()]);
        return JSON.parse(decryptedData.toString());
    }
    catch (err) {
        console.error('Decryption error:', err);
        return false;
    }
}