import { v1 as uuidv1 } from "uuid";
import * as jwt from "jsonwebtoken";
import { keys } from "../config/keys";
import { User } from "../data/user";
import * as _ from "lodash";

export class JwtAuthUtil {
  async refreshToken(apiToken: string) {
    if (!apiToken) {
      let status = 403;
      let message = "missing authorization header";
      return { status: status, message: message };
    }
    var loginRequest: any = await this.verifyToken(apiToken);
    if (!loginRequest) {
      let status = 403;
      let message = "Forbidden";
      return { status: status, message: message };
    }
    return await this.CreateTokens(loginRequest);
  }

  async issueToken(userObj: User) {
    try {
      var res = this.CreateTokens(userObj);
      return res;
    } catch (err) {
      throw err;
    }
  }

  async createShortToken(userObj: User) {
    try {
      var res = this.createShortTokens(userObj);
      return res;
    } catch (err) {
      throw err;
    }
  }

  async emailToken(userObj: User) {
    try {
      var res = this.createEmailToken(userObj);
      return res;
    } catch (err) {
      throw err;
    }
  }

  async forgotToken(userObj: User) {
    try {
      var res = this.createForgotPwdToken(userObj);
      return res;
    } catch (err) {
      throw err;
    }
  }

  async verifyToken(apiToken: string) {
    try {
      return jwt.verify(apiToken, keys.jwt.secret);
    } catch (err) {
      return;
    }
  }

  //createTokens will create both issueToken and refreshToken
  private CreateTokens(user: User) {
    const GUID_access = uuidv1();
    const iat_val = Math.floor(Date.now() / 1000);
    const exp_val = Math.floor(Date.now() / 1000) + 60 * 60 * 8; // 8 hrs from now
    var issueTokenClaims = {
      email: user.email,
      role: user.role,
      username: user.username,
      language: user.language,
      userType: user?.userType,
      nbf: iat_val,
      iat: iat_val,
      exp: exp_val,
      sub: "access",
      iss: "indexx-exchange",
      aud: "indexx-exchange",
      jti: GUID_access,
      isWebinarUser: user.referralCodeUsed === "FREE500" ? true : false,
      isTestFundActive: user.isTestFundActive ? user.isTestFundActive : false,
      isFreeTrailEnded: user.isFreeTrailEnded ? user.isFreeTrailEnded : false,
      tutorialWatched: user?.tutorialWatched ? true : false,
    };

    const refresh_exp_val = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30; // 30 days from now
    const GUID_refresh = uuidv1();
    const refreshTokenClaims = {
      email: user.email,
      role: user.role,
      username: user.username,
      language: user.language,
      userType: user?.userType,
      nbf: iat_val,
      iat: iat_val,
      exp: refresh_exp_val,
      sub: "refresh",
      iss: "indexx-exchange",
      aud: "indexx-exchange",
      jti: GUID_refresh,
      isWebinarUser: user.referralCodeUsed === "FREE500" ? true : false,
      isTestFundActive: user.isTestFundActive ? user.isTestFundActive : false,
      isFreeTrailEnded: user.isFreeTrailEnded ? user.isFreeTrailEnded : false,
      tutorialWatched: user?.tutorialWatched ? true : false,
    };

    const access_token = jwt.sign(issueTokenClaims, keys.jwt.secret, {
      algorithm: "HS256",
    });
    const refresh_token = jwt.sign(refreshTokenClaims, keys.jwt.secret, {
      algorithm: "HS256",
    });

    var res = this.createShortTokens(user);

    return {
      access_token: access_token,
      refresh_token: refresh_token,
      email: user.email,
      role: user.role,
      username: user.username,
      userType: user?.userType,
      shortToken: res,
    };
  }

  //emailToken for email verification(new users registeration)
  private createEmailToken(user: User) {
    const GUID_email = uuidv1();
    const iat_val = Math.floor(Date.now() / 1000);
    const exp_val = Math.floor(Date.now() / 1000) + 60 * 60 * 8; // 8 hrs from now
    const emailTokenClaims = {
      email: user.email,
      role: user.role,
      language: user.language,
      iat: iat_val,
      exp: exp_val,
      sub: "email",
      iss: "cc",
      aud: "cc",
      jti: GUID_email,
    };
    var email_token = jwt.sign(emailTokenClaims, keys.jwt.secret, {
      algorithm: "HS256",
    });

    return { email_token: email_token };
  }

  private createShortTokens = (user: User) => {
    const GUID_access = uuidv1();
    const iat_val = Math.floor(Date.now() / 1000);
    const exp_val = Math.floor(Date.now() / 1000) + 60 * 60 * 8; // 8 hrs from now

    // Create short token
    const shortTokenClaims = {
      email: user.email,
      userType: user.userType,
      username: user.username,
      iat: iat_val,
      exp: exp_val,
      jti: GUID_access,
      isWebinarUser: user.referralCodeUsed === "FREE500" ? true : false,
      isTestFundActive: user.isTestFundActive ? user.isTestFundActive : false,
      isFreeTrailEnded: user.isFreeTrailEnded ? user.isFreeTrailEnded : false,
      tutorialWatched: user?.tutorialWatched ? true : false,
    };
    const short_token = jwt.sign(shortTokenClaims, keys.jwt.secret, {
      algorithm: "HS256",
    });

    return short_token;
  };

  //forgotToken for forgot password
  private createForgotPwdToken(user: User) {
    const GUID_email = uuidv1();
    const iat_val = Math.floor(Date.now() / 1000);
    const exp_val = Math.floor(Date.now() / 1000) + 60 * 60 * 8; // 8 hrs from now
    const forgotTokenClaims = {
      email: user.email,
      role: user.role,
      language: user.language,
      iat: iat_val,
      exp: exp_val,
      sub: "forgot",
      iss: "cc",
      aud: "cc",
      jti: GUID_email,
    };
    var forgot_token = jwt.sign(forgotTokenClaims, keys.jwt.secret, {
      algorithm: "HS256",
    });

    return { forgot_token: forgot_token };
  }
}
