import { UserOperations } from "../platform/user.operations";
import { JwtAuthUtil } from "../platform/jwt.operations";
import { UserService } from "../services/user.service";
import { createFirstTimeWallets } from "../helpers/createWallet";
import { inivitedUserPointsPerUser, KYCPoints } from "../data/taskCenter";
import { TaskCenterService } from "../services/taskCenter.service";
import { SendEmail } from "../platform/email.operations";

const rp = require("request-promise");
let uservice: UserService = new UserService();
let taskCenterService: TaskCenterService = new TaskCenterService();

const request = async (method: any, recordId: any) => {
  const options = {
    url: `https://kyc.blockpass.org/kyc/1.0/connect/${process.env.BLOCKPASS_CLIENT_ID}/recordId/${recordId}`,
    method: method,
    headers: {
      Authorization: `${process.env.BLOCKPASS_KEY}`,
    },
  };

  return await rp(options);
};

export class KYCController {
  constructor() {}

  async getKYCStatus(res: any, req: any) {}

  async updateKYCStatus(res: any, req: any) {}

  async createKYC(req: any, res: any) {
    try {
      console.log("Create KYC", req.body);
    } catch (err) {
      console.log(err);
    }
  }

  async webhook(req: any, res: any) {
    try {
      let body = req.body;
      let event = body.event;

      const fetchedData = await request("GET", body.recordId);
      const parsedData = JSON.parse(fetchedData);
      const data = parsedData.data;

      console.log(body);
      console.log("========================================");
      console.log("data", data);
      let refId = data.refId;

      let recordId = data.recordId;
      let blockPassID = data.blockPassID;
      let familyName = data.identities.family_name;
      let email = data.identities.email;
      let givenName = data.identities.given_name.value;
      let dob = data.identities.dob.value;
      let drivingLicenseCountry =
        data.identities.driving_license_issuing_country;

      console.log({
        refId: refId,
        recordId: recordId,
        blockPassID: blockPassID,
        familyName: familyName,
        email: email,
        givenName: givenName,
        dob: dob,
        drivingLicenseCountry: drivingLicenseCountry,
      });
      console.log(event);
      if (event === "user.created") {
        const checkUser = await uservice.findOne({ email: email.value });

        if (!checkUser) {
          const getReactUser = await uservice.findOne({
            email: email.value,
          });

          if (getReactUser) {
            getReactUser.set("refId", refId);
            getReactUser.set("recordId", recordId);
            getReactUser.set("blockPassID", blockPassID);
            getReactUser.set("dob", dob);
            getReactUser.set("country", drivingLicenseCountry.value);
            getReactUser.set("teir", 0);
            getReactUser.set("approved", false);
            getReactUser.set("kycStatus", "Waiting");
            getReactUser.set("userRiskLevel", data.customFields.RiskLevel);

            let res = await uservice.updatePart(
              {
                email: email.value,
              },
              {
                $set: {
                  teir: 0,
                  approved: true,
                  isKYC: false,
                  kycStatus: "Waiting",
                  userRiskLevel: data.customFields.RiskLevel,
                  refId: refId,
                  recordId: recordId,
                  blockPassID: blockPassID,
                  dob: dob,
                  country: drivingLicenseCountry.value,
                },
              }
            );

            await getReactUser.save();
            // todo add email to us
          }
          // else {
          //     const newUser = new User({
          //         refId : refId,
          //         recordId : recordId,
          //         blockPassID : blockPassID,
          //         familyName: familyName.value,
          //         email: email.value,
          //         givenName: givenName,
          //         dob: dob,
          //         drivingLicenseCountry: drivingLicenseCountry.value,
          //         teir: 0,
          //         approved: false,
          //         status: 'waiting'
          //     })

          //     await newUser.save()

          //     let contractUpdation = await addUser(
          //         '0x775C72FB1C28c46F5E9976FFa08F348298fBCEC0',
          //         givenName,
          //         dob,
          //         recordId
          //     )

          //     // database checkup to keep reordId as one
          //     console.log('blockchain kyc transaction for user insertion:', contractUpdation);
          // }
        }
      }

      if (event === "user.inReview") {
        const checkUser = await uservice.findOne({ email: email.value });

        if (checkUser) {
          let res = await uservice.updatePart(
            {
              email: email.value,
            },
            {
              $set: {
                teir: 1,
                approved: true,
                isKYC: true,
                kycStatus: "Completed",
              },
            }
          );
        }
      }

      if (event === "review.approved") {
        const checkUser = await uservice.findOne({ email: email.value });

        if (checkUser) {

          let res = await uservice.updatePart(
            {
              email: email.value,
            },
            {
              $set: {
                teir: 1,
                approved: true,
                isKYCPass: true,
                kycStatus: "Completed",
                KYCUpdatedDate: new Date(),
              },
            }
          );
          console.log(res);

          // get and update user task center
          let getUserTaskCenter = await taskCenterService.findOne({
            email: email.value,
          });

          //create points history obj
          let pointsHistoryObj = {
            email: email.value,
            points: KYCPoints,
            type: "KYC Completed Points",
            date: new Date(),
          }

          if (getUserTaskCenter) {
            await taskCenterService.updatePart(
              {
                email: email.value,
              },
              {
                $set: {
                  isKYCPass: true,
                  KYCPoints: KYCPoints,
                  totalPoints: getUserTaskCenter.totalPoints + KYCPoints,
                  pointsHistoryObj: getUserTaskCenter.pointsHistory.concat(pointsHistoryObj)
                },
              }
            );
          }

          await new SendEmail().sendKycVerifiedEmail(email.value);
          // get and update referred user task center
          let getReferredUser = await uservice.findOne({
            referralCode: checkUser.referralCodeUsed,
          });

          let getReferredUserTaskCenter = await taskCenterService.findOne({
            email: getReferredUser.email,
          });
          if (
            getReferredUserTaskCenter &&
            getReferredUserTaskCenter.inivitedUsersEmail.includes(email.value)
          ) {
            let inivitedUserPoints = inivitedUserPointsPerUser;

            let pointsHistoryObj = {
              email: getReferredUserTaskCenter.email,
              points: inivitedUserPoints,
              type: `Invited User Points for inviting user ${email.value}`,
              date: new Date(),
            };
            let updateReferredUserTask = await taskCenterService.updatePart(
              {
                email: getReferredUser.email,
              },
              {
                $set: {
                  inivitedUserPoints:
                    getReferredUserTaskCenter.inivitedUserPoints +
                    inivitedUserPoints,
                  totalPoints:
                    getReferredUserTaskCenter.totalPoints +
                    getReferredUserTaskCenter.inivitedUserPoints +
                    inivitedUserPoints,
                },
                $push: {
                  pointsHistory: pointsHistoryObj,
                },
              }
            );
            console.log(updateReferredUserTask);
          }

          if (checkUser.userWallets.length > 0) {
            console.log("I'm here not creating any wallets");
          } else {
            await createFirstTimeWallets(email.value);
          }
        }
      }

      res.send({ sucess: true });
      return;
    } catch (err) {
      console.log(err);
    }
  }
}
