import { Request, Response } from "express";
import { AffilateOperations } from "../platform/affilate.operations";
import { UserOperations } from "../platform/user.operations";

export class AffiliateController {
  constructor() {}

  async addAffiliateuser(req: Request, res: Response) {
    try {
      const affilaiteOps: AffilateOperations = new AffilateOperations(req, res);
      const results = await affilaiteOps.createAffilateUser(req, res);
      if (results.status === 200) {
        const userOps = new UserOperations(req, res);
        console.log("result", results);
        let dataResults = await userOps.registerUser(
          req,
          res,
          String(req.body.Email).toLowerCase(),
          req.body.password,
          req.body.Username,
          req.body.referralCode || "",
          true,
          req.body.referralCode ? "CaptainBeeRegister" : ""
        );
        console.log("dataResults", dataResults);

        res.statusCode = results.status;
        res.send(results);
        return;
      } else {
        res.statusCode = results.status;
        res.send(results);
        return;
      }
    } catch (err) {
      console.log("err", err);
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async getAffiliateuser(req: Request, res: Response) {
    try {
      const affilaiteOps: AffilateOperations = new AffilateOperations(req, res);
      const results = await affilaiteOps.getAffilateUser(req, res);
      res.statusCode = results.status;
      res.send(results);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async getAllAffiliateUsers(req: Request, res: Response) {
    try {
      const affilaiteOps: AffilateOperations = new AffilateOperations(req, res);
      const results = await affilaiteOps.getAffilateUsers(req, res);
      res.statusCode = results.status;
      res.send(results);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async getAllAffiliateUser(req: Request, res: Response) {
    try {
      const affilaiteOps: AffilateOperations = new AffilateOperations(req, res);
      const results = await affilaiteOps.getAffilateUserByEmail(req, res);
      res.statusCode = results.status;
      res.send(results);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async getAllAffiliateDashboardData(req: Request, res: Response) {
    try {
      let { username, isPublicProfile, userType } = req.params;
      console.log(username, isPublicProfile);
      if (
        !username ||
        username === undefined ||
        !isPublicProfile ||
        isPublicProfile === undefined
      ) {
        res.statusCode = 400;
        res.send({ status: 400, data: "Bad Request" });
        return;
      }
      const affilaiteOps: AffilateOperations = new AffilateOperations(req, res);
      const results = await affilaiteOps.getAffilateUserDashboardData(
        req,
        res,
        username,
        isPublicProfile,
        userType
      );
      res.statusCode = results.status;
      res.send(results);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async getAllAffiliateDashboardData01(req: Request, res: Response) {
    try {
      let { username, isPublicProfile } = req.params;
      console.log(username, isPublicProfile);
      if (
        !username ||
        username === undefined ||
        !isPublicProfile ||
        isPublicProfile === undefined
      ) {
        res.statusCode = 400;
        res.send({ status: 400, data: "Bad Request" });
        return;
      }
      const affilaiteOps: AffilateOperations = new AffilateOperations(req, res);
      const results = await affilaiteOps.getAffilateUserDashboardData01(
        req,
        res,
        username,
        isPublicProfile
      );
      res.statusCode = results.status;
      res.send(results);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async updateAffiliateUser(req: Request, res: Response) {
    try {
      let { email, username } = req.body;
      email = String(email).toLowerCase();
      if (!username || username == undefined || !email || email == undefined) {
        res.statusCode = 400;
        res.send({ status: 400, data: "Bad Request" });
        return;
      }
      const affilaiteOps: AffilateOperations = new AffilateOperations(req, res);
      const results = await affilaiteOps.updateAffiliateUserData(
        req,
        res,
        username,
        email
      );
      res.statusCode = results.status;
      res.send(results);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async convertNormalUser(req: Request, res: Response) {
    try {
      let { Email, Username } = req.body;
      Email = String(Email).toLowerCase();
      if (!Email || Email == undefined) {
        res.statusCode = 400;
        res.send({ status: 400, data: "Bad Request" });
        return;
      }
      const affilaiteOps: AffilateOperations = new AffilateOperations(req, res);
      const results = await affilaiteOps.convertNormalUser(
        req,
        res,
      );
      res.statusCode = results.status;
      res.send(results);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async shareGreetingCard(req: Request, res: Response) {
    try {
      let {
        receiverName,
        receiverEmail,
        email,
        greetingWords,
        userType,
        greetingCode,
        greetingCardImageUrl,
      } = req.body;
      if (
        !receiverName ||
        receiverName == undefined ||
        !receiverEmail ||
        receiverEmail == undefined ||
        !greetingWords ||
        greetingWords == undefined ||
        !userType ||
        userType == undefined ||
        !greetingCode ||
        greetingCode == undefined ||
        !greetingCardImageUrl ||
        greetingCardImageUrl == undefined ||
        !email ||
        email == undefined
      ) {
        res.statusCode = 400;
        res.send({ status: 400, data: "Bad Request" });
        return;
      }
      const affilaiteOps: AffilateOperations = new AffilateOperations(req, res);
      const results = await affilaiteOps.shareGreetingCard(req, res);
      res.statusCode = results.status;
      res.send(results);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }
}
