import apn from 'apn';
import path from 'path';

export const apnProvider = new apn.Provider({
  token: {
    key: path.resolve(process.env.APNS_AUTH_KEY || './certs/AuthKey.p8'),
    keyId: process.env.APNS_KEY_ID as string,
    teamId: process.env.APNS_TEAM_ID as string
  },
  production: process.env.NODE_ENV === 'production'
});
