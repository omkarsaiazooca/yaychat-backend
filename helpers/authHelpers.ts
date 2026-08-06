import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import jwkToPem from 'jwk-to-pem';

const APPLE_JWK_URL = 'https://appleid.apple.com/auth/keys';
const APPLE_ISSUER = 'https://appleid.apple.com';
const APP_BUNDLE_ID = 'com.bitcoinyay.appname';

export async function verifyAppleToken(appleToken: string): Promise<any> {
  try {
    const { data } = await axios.get(APPLE_JWK_URL);
    const appleKeys = data.keys;

    for (const key of appleKeys) {
      const pem = jwkToPem(key);
      try {
        const decoded: any = jwt.verify(appleToken, pem, {
          algorithms: ['RS256'],
          issuer: APPLE_ISSUER,
          audience: [
            'com.bitcoinyay.appname', 
            'org.reactjs.native.example.yaysapp',
          ],
        });

        console.log('Apple token verified:', decoded);

        return {
          email: decoded.email,
          username: decoded.sub, // Unique Apple user ID
        };
      } catch (err) {
        // Try next key if verification fails
        continue;
      }
    }

    // If none of the keys succeeded
    throw new Error('Apple token verification failed for all keys.');
  } catch (err:any) {
    console.error('Apple token validation error:', err.message);
    throw new Error('Invalid Apple token');
  }
}


// export async function verifyAppleToken(identityToken: string): Promise<{ email: string; username: string }> {
//     try {
//       const JWKS = createRemoteJWKSet(APPLE_JWK_URL);

//       const { payload } = await jwtVerify(identityToken, JWKS, {
//         issuer: 'https://appleid.apple.com',
//         audience: '	4Q588TKPT7.org.reactjs.native.example.yaysapp',
//       });

//       console.log('Apple token payload:', payload);
//       return {
//         email: payload.email as string,
//         username: payload.sub as string, // `sub` is the Apple user ID
//       };
//     } catch (error) {
//       console.error('Error verifying Apple token:', error);
//       throw new Error('Invalid Apple token');
//     }
//   }


const client = new OAuth2Client('232957845996-ctig89g3o6uigoq4gu1pkil3fauv88gi.apps.googleusercontent.com'); // Replace with your Google Client ID

export async function verifyGoogleToken0(googleToken: string): Promise<any> {
    const ticket = await client.verifyIdToken({
        idToken: googleToken,
        audience: '232957845996-ctig89g3o6uigoq4gu1pkil3fauv88gi.apps.googleusercontent.com', // Replace with your Google Client ID
    });

    const payload = ticket.getPayload();
    if (!payload) {
        throw new Error('Invalid Google token');
    }

    return {
        email: payload.email,
        username: payload.name || payload.sub, // Assuming 'sub' contains a unique identifier for the user
    };
}


export async function verifyGoogleToken(accessToken: string): Promise<any> {
    try {
        const response = await axios.get(`https://www.googleapis.com/oauth2/v1/userinfo?access_token=${accessToken}`, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: 'application/json'
            }
        });

        const user = response.data;

        return {
            email: user.email,
            username: user.name || user.id, // Assuming 'id' contains a unique identifier for the user
        };
    } catch (error) {
        console.error('Error verifying Google token:', error);
        throw new Error('Invalid Google token');
    }
}