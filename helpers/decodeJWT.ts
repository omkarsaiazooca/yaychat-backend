import { jwtDecode as decode } from 'jwt-decode';
export function decodeJWT(access_token: string) {
  let userObj: any = decode(access_token);
  return userObj;
}
