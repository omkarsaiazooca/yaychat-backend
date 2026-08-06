import { AffilateService } from "../services/affiliate.service";
import { BaseAPIOperations } from "./base.operations";
import { Request, Response } from "express";
import { Affiliate, GreetingCard } from "../data/affiliate";
import { UserService } from "../services/user.service";
import { BeeRelationship, Permissions } from "../data/user";
import { first } from "lodash";
import { PowerPackService } from "../services/powerPack.service";
import { calculateLevelByReferralCode } from "../helpers/affiliateHelpers";
import { WalletUserService } from "../services/walletUser.service";
import { OrderService } from "../services/order.service";
import moment from "moment";
import { downgradeRankLogToFile } from "./log.operations";
import { OrderStatus } from "../data/order";
import { PaypalSubscriptionService } from "../services/paypalSubscription.service";
import { getSubscriptionDetails } from "./paypal.wrapper";
import { MessageConstants } from "../data/constants";
import { SendEmail } from "./email.operations";
import { keys } from "../config/keys";
import { NonPaypalSubscriptionService } from "../services/nonPaypalSubscription.service";
import { TempAffilateService } from "../services/tempaffiliate.service";
const mongoose = require("mongoose");
const affilateService: AffilateService = new AffilateService();
const tempAffilateService: TempAffilateService = new TempAffilateService();
let uservice: UserService = new UserService();
let powerPackService: PowerPackService = new PowerPackService();
let wuserservice: WalletUserService = new WalletUserService();
let orderService: OrderService = new OrderService();
let paypalSubscriptionService: PaypalSubscriptionService =
  new PaypalSubscriptionService();
let nonPaypalSubscriptionService: NonPaypalSubscriptionService =
  new NonPaypalSubscriptionService();
export class AffilateOperations extends BaseAPIOperations {
  constructor(req: Request, res: Response) {
    super(req, res);
  }

  async createAffilateUser(req: any, res: any) {
    try {
      let emailExists = await affilateService.findOne({
        Email: String(req.body.Email).toLowerCase(),
      });
      let ssnExists = await affilateService.findOne({ ssn: req.body.ssn });
      let usernameExist = await affilateService.findOne({
        Username: req.body.Username,
      });
      let register = await uservice.findOne({
        email: String(req.body.Email).toLowerCase(),
      });
      let walletregister = await wuserservice.findOne({
        email: String(req.body.Email).toLowerCase(),
      });

      //let data = { message: "", status: 200 };

      if (emailExists || register || walletregister) {
        const data = {
          message: "Email already exists",
          status: 500,
        };
        return data;
      } else if (ssnExists) {
        const data = {
          message: "SSN already exists",
          status: 500,
        };
        return data;
      } else if (usernameExist) {
        const data = {
          message: "Username already exists",
          status: 500,
        };
        return data;
      } else if (emailExists && ssnExists && usernameExist) {
        const data = {
          message: "Email,Username and SSN already exist",
          status: 500,
        };
        return data;
      } else {
        //const user = await affilateService.create({ ...req.body });

        // Create a new user based on the client request
        let user = { ...req.body };
        let calculatedLevel;
        // Check if a referral code is provided in the client request
        if (req.body.referralCode) {
          // Calculate the level and update the records based on the referral code
          const referringAffiliate = await affilateService.find({});
          let allAffiliateUsers = [];
          for (let index = 0; index < referringAffiliate.length; index++) {
            const element = referringAffiliate[index];
            let findUser = await uservice.findOne({
              email: element.Email,
            });
            element.userData = findUser;
            console.log(element.Email);
            allAffiliateUsers.push(element);
          }
          if (referringAffiliate) {
            // You can implement your level calculation logic here
            // For example, based on the number of referrals, volume, or other criteria
            calculatedLevel = await calculateLevelByReferralCode(
              allAffiliateUsers,
              req.body.referralCode
            );
            // let getPassword = await uservice.createPassword(user.password);
            // user.password = getPassword.hash;
            // user.confirmpass = getPassword.hash;
            // Update the user's level and other relevant properties
            user.level = calculatedLevel.level;
            user.referralCodeUsed = req.body.referralCode;
            user.greetingCards = await this.createGreetingCards();
          }
        }
        console.log("calculatedLevel", calculatedLevel);

        let updateReferredUserLevel = await affilateService.updatePart(
          {
            Email: calculatedLevel?.user.Email,
          },
          {
            $set: {
              totalDownlineCount: calculatedLevel?.user.totalDownlineCount
                ? calculatedLevel?.user.totalDownlineCount + 1
                : 1,
            },
          }
        );

        console.log("updateReferredUserLevel", updateReferredUserLevel);
        // Save the user to the database
        await affilateService.create(user);
        const data = {
          message: "User created",
          status: 200,
        };
        return data;
      }
    } catch (err) {
      const data = {
        message: "User failed",
        status: 500,
      };
      return data;
    }
  }

  async generateUniqueCode(): Promise<string> {
    return Math.random().toString(36).substr(2, 9);
  }

  async createGreetingCards(): Promise<GreetingCard[]> {
    const cards: GreetingCard[] = [];

    // Create 50 INEX Greeting Cards x 2 qty
    for (let i = 0; i < 2; i++) {
      cards.push({
        title: "50 INEX Greeting Card",
        message: "Your special 50 INEX Greeting Card message",
        senderEmail: "",
        receiverEmail: "",
        occasion: "Special Occasion",
        sendDate: new Date(),
        imageUrl: "http://example.com/image.jpg",
        isUsed: false,
        isActive: true,
        code: await this.generateUniqueCode(),
        numberOfTokens: 50,
        tokenSymbol: "INEX",
        tokenName: "Indexx Exchange",
        userType: "Captain",
        receiverActivatedDate: new Date(),
      });
    }

    // Create 30 INEX Greeting Cards x 8 qty
    for (let i = 0; i < 8; i++) {
      cards.push({
        title: "30 INEX Greeting Card",
        message: "Your special 30 INEX Greeting Card message",
        senderEmail: "",
        receiverEmail: "",
        occasion: "Special Occasion",
        sendDate: new Date(),
        imageUrl: "http://example.com/image.jpg",
        isUsed: false,
        isActive: true,
        code: await this.generateUniqueCode(),
        numberOfTokens: 30,
        tokenSymbol: "INEX",
        tokenName: "Indexx Exchange",
        userType: "Captain",
        receiverActivatedDate: new Date(),
      });
    }

    return cards;
  }

  async getAffilateUser(req: any, res: any) {
    try {
      let affilateuser = await affilateService.findOneSelect(
        {
          Email: String(req.body.email).toLowerCase(),
        },
        {}
      );
      if (affilateuser) {
        if (affilateuser.password === req.body.password) {
          const data = {
            message: "Email already exist",
            status: 200,
            data: affilateuser,
          };
          return data;
        } else {
          const data = {
            message: "Incorrect password",
            status: 500,
            data: null,
          };
          return data;
        }
      } else {
        const data = {
          message: "User does not exist",
          status: 500,
          data: null,
        };
        return data;
      }
    } catch (err) {
      const data = {
        message: "User get failed",
        status: 500,
        data: null,
      };
      return data;
    }
  }

  async getAffilateUsers(req: any, res: any) {
    try {
      let affilateusers = await affilateService.find({}); // Fetching as plain JS objects

      if (affilateusers) {
        // Fetching user data in parallel
        const usersData = await Promise.all(
          affilateusers.map(async (element) => {
            return await uservice.findOneSelect(
              { email: element.Email },
              { userWallets: false }
            );
          })
        );

        // Constructing the result array
        const resultAffiliates = affilateusers.map((affiliate, index) => {
          return {
            ...affiliate,
            userData: usersData[index],
          };
        });

        return {
          message: "Affiliate users list",
          status: 200,
          data: resultAffiliates,
        };
      } else {
        const data = {
          message: "No Affiliate Users exists",
          status: 500,
          data: null,
        };
        return data;
      }
    } catch (err) {
      const data = {
        message: "User get failed",
        status: 500,
        data: null,
      };
      return data;
    }
  }

  async getAffilateUserByEmail(req: any, res: any) {
    try {
      let { email } = req.params;
      email = String(email).toLowerCase();

      let affilateuser = await affilateService.findOne({
        Email: email,
      }); // Fetching as plain JS objects

      if (affilateuser) {
        return {
          message: "Affiliate users list",
          status: 200,
          data: affilateuser,
        };
      } else {
        const data = {
          message: "No Affiliate Users exists",
          status: 500,
          data: null,
        };
        return data;
      }
    } catch (err) {
      const data = {
        message: "User get failed",
        status: 500,
        data: null,
      };
      return data;
    }
  }

  async getAffilateUserDashboardData0(
    req: any,
    res: any,
    username: string,
    isPublicProfile: string,
    userType: string = "CaptainBee"
  ) {
    try {
      console.log(userType === "CaptainBee");
      if (userType === "CaptainBee") {
        console.log("captain Bee");

        let getAffilateUserByUsername = await affilateService.findOne({
          Username: username,
        });
        console.log(getAffilateUserByUsername);
        let getPowerPackData = await powerPackService.findOne({
          email: getAffilateUserByUsername.Email,
        });
        if (getAffilateUserByUsername) {
          let getAffilatedUserFullData = await uservice.findOne({
            email: getAffilateUserByUsername.Email,
          });
          let affiliateUsersCount =
            getAffilateUserByUsername?.honeyBees?.length ?? 0;
          let captainUsersCount =
            getAffilateUserByUsername?.captainBees?.length ?? 0;
          let affiliateUserManagedOrders =
            getAffilateUserByUsername?.orderCount === undefined
              ? 0
              : getAffilateUserByUsername?.orderCount;
          const timestamp = mongoose.Types.ObjectId(
            getAffilatedUserFullData._id
          ).getTimestamp();
          getAffilateUserByUsername.accountCreationDate = timestamp;
          getAffilateUserByUsername.Phone =
            isPublicProfile === "yes"
              ? getAffilateUserByUsername?.Phone
              : getAffilateUserByUsername?.isPhonePublic
              ? getAffilateUserByUsername.Phone
              : "";
          getAffilateUserByUsername.Email =
            isPublicProfile === "yes"
              ? getAffilateUserByUsername?.Email
              : getAffilateUserByUsername?.isEmailPublic
              ? getAffilateUserByUsername.Email
              : "";
          let userRegisteredRequiredData = [];
          let captainBeeRegisteredRequiredData = [];
          for (
            let i = 0;
            i < getAffilatedUserFullData.relationships.length;
            i++
          ) {
            let getAllRegisteredUsers = await uservice.findOneSelect(
              {
                email: getAffilatedUserFullData.relationships[i].honeybeeEmail,
              },
              {}
            );

            let currentData = {
              username: getAllRegisteredUsers?.username
                ? getAllRegisteredUsers?.username
                : getAllRegisteredUsers?.email.split("@")[0],
              lastName: getAllRegisteredUsers?.lastName,
              firstName: getAllRegisteredUsers?.firstName,
              email: getAffilatedUserFullData.relationships[i].honeybeeEmail,
              isKYCPass: getAllRegisteredUsers?.isKYCPass,
              kycStatus: getAllRegisteredUsers?.kycStatus,
              permissions:
                getAffilatedUserFullData.relationships[i].permissions,
              profilePic: getAllRegisteredUsers?.profilePic,
            };
            userRegisteredRequiredData.push(currentData);
          }
          for (
            let i = 0;
            i < getAffilatedUserFullData.captainBeeRelationShips.length;
            i++
          ) {
            let getAllRegisteredUsers = await uservice.findOneSelect(
              {
                email:
                  getAffilatedUserFullData.captainBeeRelationShips[i]
                    .captainBeeEmail,
              },
              {}
            );

            let getAffiliateData = await affilateService.findOne({
              Email:
                getAffilatedUserFullData.captainBeeRelationShips[i]
                  .captainBeeEmail,
            });

            let currentData = {
              username: getAffiliateData?.Username
                ? getAffiliateData?.Username
                : getAllRegisteredUsers?.email.split("@")[0],
              lastName: getAffiliateData?.lastname,
              firstName: getAffiliateData?.firstname,
              email:
                getAffilatedUserFullData?.captainBeeRelationShips[i]
                  ?.captainBeeEmail,
              isKYCPass: getAllRegisteredUsers?.isKYCPass,
              kycStatus: getAllRegisteredUsers?.kycStatus,
              permissions:
                getAffilatedUserFullData.captainBeeRelationShips[i].permissions,
              profilePic: getAffiliateData?.photoIdFileurl,
            };
            captainBeeRegisteredRequiredData.push(currentData);
          }
          const date = new Date(timestamp);

          const options = {
            year: "numeric",
            month: "long",
            day: "numeric",
          } as any;
          const formattedDate = date.toLocaleDateString("en-US", options);
          //get inex monthly purchase data
          let nextPurchaseDate = await this.getNextPurchaseDateOrDowngradeTime(
            getAffilateUserByUsername.Email
          );
          let downgradeTime = await this.calculateDowngradeTime(
            getAffilateUserByUsername.Email
          );

          let paypalSubscriptionData = await paypalSubscriptionService.findOne({
            payerEmail: getAffilateUserByUsername.Email,
          });
          let getPaypalSubscriptionDetails;
          if (paypalSubscriptionData) {
            getPaypalSubscriptionDetails = await getSubscriptionDetails(
              paypalSubscriptionData.subscriptionId
            );
          }
          let staticsData = {
            honeyBeesCount: affiliateUsersCount,
            captainsCount: captainUsersCount,
            ordersCount: affiliateUserManagedOrders,
            honeyBeesRegisteredData: userRegisteredRequiredData,
            captainBeeRegisteredRequiredData: captainBeeRegisteredRequiredData,
            affiliateUserProfile: getAffilateUserByUsername,
            accountCreationDate: timestamp,
            formatedAccountCreationDate: formattedDate,
            userFullData: getAffilatedUserFullData,
            powerPackData:
              getPowerPackData === undefined ? undefined : getPowerPackData,
            //affiliateUserTotalEarnings: affiliateUserTotalEarnings,
            remainingTimeForINEXOrder: downgradeTime,
            nextPurchaseDate: nextPurchaseDate,
            paypalSubscriptionDetails: {
              paypalSubscriptionDBData: paypalSubscriptionData,
              paypalSubscriptionDetails: getPaypalSubscriptionDetails,
            },
          };

          return {
            message: "Affiliate users list",
            status: 200,
            data: staticsData,
          };
        } else {
          const data = {
            message: "No Affiliate Users exists",
            status: 500,
            data: null,
          };
          return data;
        }
      } else {
        console.log("Get honeyBee");
        let getUserByUsername = await uservice.findOne({
          username: username,
        });
        let getPowerPackData = await powerPackService.findOne({
          email: getUserByUsername.email,
        });
        if (getUserByUsername) {
          let getAffilatedUserFullData = await uservice.findOne({
            email: getUserByUsername.email,
          });

          let affiliateUsersCount =
            getUserByUsername?.relationships?.length ?? 0;
          let captainUsersCount =
            getUserByUsername?.captainBeeRelationShips?.length ?? 0;
          let affiliateUserManagedOrders = 0;
          const timestamp = mongoose.Types.ObjectId(
            getAffilatedUserFullData._id
          ).getTimestamp();
          getUserByUsername.accountCreationDate = timestamp;
          getUserByUsername.phone =
            isPublicProfile === "yes"
              ? getUserByUsername?.phone
              : getUserByUsername?.isPhonePublic
              ? getUserByUsername.phone
              : "";
          getUserByUsername.email =
            isPublicProfile === "yes"
              ? getUserByUsername?.email
              : getUserByUsername?.isEmailPublic
              ? getUserByUsername.email
              : "";
          let userRegisteredRequiredData = [];
          let captainBeeRegisteredRequiredData = [];
          for (
            let i = 0;
            i < getAffilatedUserFullData.relationships.length;
            i++
          ) {
            let getAllRegisteredUsers = await uservice.findOneSelect(
              {
                email: getAffilatedUserFullData.relationships[i].honeybeeEmail,
              },
              {}
            );

            let currentData = {
              username: getAllRegisteredUsers?.username
                ? getAllRegisteredUsers?.username
                : getAllRegisteredUsers?.email.split("@")[0],
              lastName: getAllRegisteredUsers?.lastName,
              firstName: getAllRegisteredUsers?.firstName,
              email: getAffilatedUserFullData.relationships[i].honeybeeEmail,
              isKYCPass: getAllRegisteredUsers?.isKYCPass,
              kycStatus: getAllRegisteredUsers?.kycStatus,
              permissions:
                getAffilatedUserFullData.relationships[i].permissions,
              profilePic: getAllRegisteredUsers?.profilePic,
            };
            userRegisteredRequiredData.push(currentData);
          }
          for (
            let i = 0;
            i < getAffilatedUserFullData.captainBeeRelationShips.length;
            i++
          ) {
            let getAllRegisteredUsers = await uservice.findOneSelect(
              {
                email:
                  getAffilatedUserFullData.captainBeeRelationShips[i]
                    .captainBeeEmail,
              },
              {}
            );

            let getAffiliateData = await affilateService.findOne({
              Email:
                getAffilatedUserFullData.captainBeeRelationShips[i]
                  .captainBeeEmail,
            });

            let currentData = {
              username: getAffiliateData?.Username
                ? getAffiliateData?.Username
                : getAllRegisteredUsers?.email.split("@")[0],
              lastName: getAffiliateData?.lastname,
              firstName: getAffiliateData?.firstname,
              email:
                getAffilatedUserFullData?.captainBeeRelationShips[i]
                  ?.captainBeeEmail,
              isKYCPass: getAllRegisteredUsers?.isKYCPass,
              kycStatus: getAllRegisteredUsers?.kycStatus,
              permissions:
                getAffilatedUserFullData.captainBeeRelationShips[i].permissions,
              profilePic: getAffiliateData?.photoIdFileurl,
            };
            captainBeeRegisteredRequiredData.push(currentData);
          }
          const date = new Date(timestamp);

          const options = {
            year: "numeric",
            month: "long",
            day: "numeric",
          } as any;
          const formattedDate = date.toLocaleDateString("en-US", options);
          let staticsData = {
            honeyBeesCount: affiliateUsersCount,
            captainsCount: captainUsersCount,
            ordersCount: affiliateUserManagedOrders,
            honeyBeesRegisteredData: userRegisteredRequiredData,
            captainBeeRegisteredRequiredData: captainBeeRegisteredRequiredData,
            affiliateUserProfile: getUserByUsername,
            accountCreationDate: timestamp,
            formatedAccountCreationDate: formattedDate,
            userFullData: getAffilatedUserFullData,
            powerPackData:
              getPowerPackData === undefined ? undefined : getPowerPackData,
          };

          return {
            message: "Affiliate users list",
            status: 200,
            data: staticsData,
          };
        } else {
          const data = {
            message: "No Affiliate Users exists",
            status: 500,
            data: null,
          };
          return data;
        }
      }
    } catch (err) {
      console.log("err", err);
      const data = {
        message: "User get failed",
        status: 500,
        data: null,
      };
      return data;
    }
  }

  async getAffilateUserDashboardData01(
    req: any,
    res: any,
    username: string,
    isPublicProfile: string,
    userType: string = "CaptainBee"
  ) {
    try {
      const getAffilateUserByUsername = await affilateService.findOne({
        Username: username,
      });
      if (!getAffilateUserByUsername) {
        return { status: 404, message: "Affiliate User not found", data: null };
      }

      const [getPowerPackData, getAffilatedUserFullData] = await Promise.all([
        powerPackService.findOne({ email: getAffilateUserByUsername.Email }),
        uservice.findOne({ email: getAffilateUserByUsername.Email }),
      ]);

      let email = getAffilateUserByUsername.Email;
      const affiliateUsersCount =
        getAffilateUserByUsername?.honeyBees?.length ?? 0;
      const captainUsersCount =
        getAffilateUserByUsername?.captainBees?.length ?? 0;
      const affiliateUserManagedOrders =
        getAffilateUserByUsername?.orderCount ?? 0;
      const affiliateUserTotalEarnings =
        getAffilateUserByUsername?.totalCommissionEarned ?? 0;
      const affiliateHoneyBeeUserTotalEarnings =
        getAffilateUserByUsername?.totalHoneyBeeCommissionEarned ?? 0;
      const accountCreationDate = mongoose.Types.ObjectId(
        getAffilatedUserFullData._id
      ).getTimestamp();
      getAffilateUserByUsername.accountCreationDate = accountCreationDate;

      // Set phone and email visibility based on public profile setting
      getAffilateUserByUsername.Phone =
        isPublicProfile === "yes" || getAffilateUserByUsername?.isPhonePublic
          ? getAffilateUserByUsername.Phone
          : "";
      getAffilateUserByUsername.Email =
        isPublicProfile === "yes" || getAffilateUserByUsername?.isEmailPublic
          ? getAffilateUserByUsername.Email
          : "";

      const userRegisteredDataPromises =
        getAffilatedUserFullData.relationships.map(async (relationship) => {
          const user = await uservice.findOneSelect(
            { email: relationship.honeybeeEmail },
            {}
          );
          return {
            username: user?.username ?? user?.email.split("@")[0],
            lastName: user?.lastName,
            firstName: user?.firstName,
            email: relationship.honeybeeEmail,
            isKYCPass: user?.isKYCPass,
            kycStatus: user?.kycStatus,
            permissions: relationship.permissions,
            profilePic: user?.profilePic,
          };
        });

      const captainBeeDataPromises =
        getAffilatedUserFullData.captainBeeRelationShips.map(
          async (relationship) => {
            const [user, affiliateData] = await Promise.all([
              uservice.findOneSelect(
                { email: relationship.captainBeeEmail },
                {}
              ),
              affilateService.findOne({ Email: relationship.captainBeeEmail }),
            ]);
            return {
              username: user?.username ?? user?.email.split("@")[0],
              lastName: affiliateData?.lastname,
              firstName: affiliateData?.firstname,
              email: relationship.captainBeeEmail,
              isKYCPass: user?.isKYCPass,
              kycStatus: user?.kycStatus,
              permissions: relationship.permissions,
              profilePic: affiliateData?.photoIdFileurl,
            };
          }
        );

      const [userRegisteredRequiredData, captainBeeRegisteredRequiredData] =
        await Promise.all([
          Promise.all(userRegisteredDataPromises),
          Promise.all(captainBeeDataPromises),
        ]);

      // Additional data processing for nextPurchaseDate, downgradeTime, and paypalSubscriptionData
      const nextPurchaseDate = await this.getNextPurchaseDateOrDowngradeTime(
        getAffilateUserByUsername.Email
      );
      const downgradeTime = await this.calculateDowngradeTime(
        getAffilateUserByUsername.Email
      );

      let paypalSubscriptionData = await paypalSubscriptionService.findOne({
        payerEmail: getAffilateUserByUsername.Email,
      });

      let nonPaypalSubscriptionData =
        await nonPaypalSubscriptionService.findOne({
          email: email,
        });
      console.log("nonPaypalSubscriptionData", nonPaypalSubscriptionData);
      console.log("Email", email);
      let getPaypalSubscriptionDetails = paypalSubscriptionData
        ? await getSubscriptionDetails(paypalSubscriptionData.subscriptionId)
        : null;

      const staticsData = {
        honeyBeesCount: affiliateUsersCount,
        captainsCount: captainUsersCount,
        ordersCount: affiliateUserManagedOrders,
        honeyBeesRegisteredData: userRegisteredRequiredData,
        captainBeeRegisteredRequiredData: captainBeeRegisteredRequiredData,
        affiliateUserProfile: getAffilateUserByUsername,
        accountCreationDate: accountCreationDate,
        formatedAccountCreationDate: new Date(
          accountCreationDate
        ).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
        userFullData: getAffilatedUserFullData,
        powerPackData: getPowerPackData,
        affiliateUserTotalEarnings: affiliateUserTotalEarnings,
        affiliateHoneyBeeUserTotalEarnings: affiliateHoneyBeeUserTotalEarnings,
        remainingTimeForINEXOrder: downgradeTime,
        nextPurchaseDate: nextPurchaseDate,
        paypalSubscriptionDetails: {
          paypalSubscriptionDBData: paypalSubscriptionData,
          paypalSubscriptionDetails: getPaypalSubscriptionDetails,
        },
        nonPaypalSubscriptionDetails: {
          nonPaypalSubscriptionDBData: nonPaypalSubscriptionData,
        },
      };

      return {
        message: "Affiliate users list",
        status: 200,
        data: staticsData,
      };
    } catch (err) {
      console.error("Error in getAffilateUserDashboardData: ", err);
      return { message: "User get failed", status: 500, data: null };
    }
  }

  async getAffilateUserDashboardData(
    req: any,
    res: any,
    username: string,
    isPublicProfile: string,
    userType: string = "CaptainBee"
  ) {
    try {
      console.log(userType === "CaptainBee");
      if (userType === "CaptainBee") {
        console.log("captain Bee");

        let getAffilateUserByUsername = await affilateService.findOne({
          Username: username,
        });
        console.log(getAffilateUserByUsername);
        let getPowerPackData = await powerPackService.findOne({
          email: getAffilateUserByUsername.Email,
        });
        if (getAffilateUserByUsername) {
          let getAffilatedUserFullData = await uservice.findOne({
            email: getAffilateUserByUsername.Email,
          });
          let currentUserEmail = getAffilateUserByUsername.Email;
          let affiliateUsersCount =
            getAffilateUserByUsername?.honeyBees?.length ?? 0;
          let captainUsersCount =
            getAffilateUserByUsername?.captainBees?.length ?? 0;
          let affiliateUserManagedOrders =
            getAffilateUserByUsername?.orderCount === undefined
              ? 0
              : getAffilateUserByUsername?.orderCount;
          const affiliateUserTotalEarnings =
            getAffilateUserByUsername?.totalCommissionEarned ?? 0;
          const affiliateHoneyBeeUserTotalEarnings =
            getAffilateUserByUsername?.totalHoneyBeeCommissionEarned ?? 0;
          const accountCreationDate = mongoose.Types.ObjectId(
            getAffilatedUserFullData._id
          ).getTimestamp();
          getAffilateUserByUsername.accountCreationDate = accountCreationDate;
          const timestamp = mongoose.Types.ObjectId(
            getAffilatedUserFullData._id
          ).getTimestamp();
          getAffilateUserByUsername.accountCreationDate = timestamp;
          getAffilateUserByUsername.Phone =
            isPublicProfile === "yes"
              ? getAffilateUserByUsername?.Phone
              : getAffilateUserByUsername?.isPhonePublic
              ? getAffilateUserByUsername.Phone
              : "";
          getAffilateUserByUsername.Email =
            isPublicProfile === "yes"
              ? getAffilateUserByUsername?.Email
              : getAffilateUserByUsername?.isEmailPublic
              ? getAffilateUserByUsername.Email
              : "";
          let userRegisteredRequiredData = [];
          let captainBeeRegisteredRequiredData = [];
          for (
            let i = 0;
            i < getAffilatedUserFullData.relationships.length;
            i++
          ) {
            let getAllRegisteredUsers = await uservice.findOneSelect(
              {
                email: getAffilatedUserFullData.relationships[i].honeybeeEmail,
              },
              {}
            );

            let currentData = {
              username: getAllRegisteredUsers?.username
                ? getAllRegisteredUsers?.username
                : getAllRegisteredUsers?.email.split("@")[0],
              lastName: getAllRegisteredUsers?.lastName,
              firstName: getAllRegisteredUsers?.firstName,
              email: getAffilatedUserFullData.relationships[i].honeybeeEmail,
              isKYCPass: getAllRegisteredUsers?.isKYCPass,
              kycStatus: getAllRegisteredUsers?.kycStatus,
              permissions:
                getAffilatedUserFullData.relationships[i].permissions,
              profilePic: getAllRegisteredUsers?.profilePic,
            };
            userRegisteredRequiredData.push(currentData);
          }
          for (
            let i = 0;
            i < getAffilatedUserFullData.captainBeeRelationShips.length;
            i++
          ) {
            let getAllRegisteredUsers = await uservice.findOneSelect(
              {
                email:
                  getAffilatedUserFullData.captainBeeRelationShips[i]
                    .captainBeeEmail,
              },
              {}
            );

            let getAffiliateData = await affilateService.findOne({
              Email:
                getAffilatedUserFullData.captainBeeRelationShips[i]
                  .captainBeeEmail,
            });

            let currentData = {
              username: getAffiliateData?.Username
                ? getAffiliateData?.Username
                : getAllRegisteredUsers?.email.split("@")[0],
              lastName: getAffiliateData?.lastname,
              firstName: getAffiliateData?.firstname,
              email:
                getAffilatedUserFullData?.captainBeeRelationShips[i]
                  ?.captainBeeEmail,
              isKYCPass: getAllRegisteredUsers?.isKYCPass,
              kycStatus: getAllRegisteredUsers?.kycStatus,
              permissions:
                getAffilatedUserFullData.captainBeeRelationShips[i].permissions,
              profilePic: getAffiliateData?.photoIdFileurl,
            };
            captainBeeRegisteredRequiredData.push(currentData);
          }
          const date = new Date(timestamp);

          const options = {
            year: "numeric",
            month: "long",
            day: "numeric",
          } as any;
          const formattedDate = date.toLocaleDateString("en-US", options);

          // Additional data processing for nextPurchaseDate, downgradeTime, and paypalSubscriptionData
          const nextPurchaseDate =
            await this.getNextPurchaseDateOrDowngradeTime(currentUserEmail);
          const downgradeTime = await this.calculateDowngradeTime(
            currentUserEmail
          );

          let paypalSubscriptionData = await paypalSubscriptionService.findOne({
            payerEmail: currentUserEmail,
            status: "ACTIVE",
          });
          console.log("getAffilateUserByUsername.Email", currentUserEmail);
          console.log("paypalSubscriptionData", paypalSubscriptionData);
          let getPaypalSubscriptionDetails = null;

          if (paypalSubscriptionData && paypalSubscriptionData.subscriptionId) {
            getPaypalSubscriptionDetails = await getSubscriptionDetails(
              paypalSubscriptionData.subscriptionId
            );
          }
          let nonPaypalSubscriptionData =
            await nonPaypalSubscriptionService.findOne({
              email: getAffilateUserByUsername.Email,
            });

          let staticsData = {
            honeyBeesCount: affiliateUsersCount,
            captainsCount: captainUsersCount,
            ordersCount: affiliateUserManagedOrders,
            honeyBeesRegisteredData: userRegisteredRequiredData,
            captainBeeRegisteredRequiredData: captainBeeRegisteredRequiredData,
            affiliateUserProfile: getAffilateUserByUsername,
            accountCreationDate: timestamp,
            formatedAccountCreationDate: formattedDate,
            userFullData: getAffilatedUserFullData,
            powerPackData:
              getPowerPackData === undefined ? undefined : getPowerPackData,
            affiliateUserTotalEarnings: affiliateUserTotalEarnings,
            affiliateHoneyBeeUserTotalEarnings:
              affiliateHoneyBeeUserTotalEarnings,
            remainingTimeForINEXOrder: downgradeTime,
            nextPurchaseDate: nextPurchaseDate,
            paypalSubscriptionDetails: {
              paypalSubscriptionDBData: paypalSubscriptionData,
              paypalSubscriptionDetails: getPaypalSubscriptionDetails,
            },
            nonPaypalSubscriptionDetails: {
              nonPaypalSubscriptionDBData: nonPaypalSubscriptionData,
            },
          };

          return {
            message: "Affiliate users list",
            status: 200,
            data: staticsData,
          };
        } else {
          const data = {
            message: "No Affiliate Users exists",
            status: 500,
            data: null,
          };
          return data;
        }
      } else {
        console.log("Get honeyBee");
        let getUserByUsername = await uservice.findOne({
          username: username,
        });
        let getPowerPackData = await powerPackService.findOne({
          email: getUserByUsername.email,
        });
        if (getUserByUsername) {
          let getAffilatedUserFullData = await uservice.findOne({
            email: getUserByUsername.email,
          });

          let affiliateUsersCount =
            getUserByUsername?.relationships?.length ?? 0;
          let captainUsersCount =
            getUserByUsername?.captainBeeRelationShips?.length ?? 0;
          let affiliateUserManagedOrders = 0;
          const timestamp = mongoose.Types.ObjectId(
            getAffilatedUserFullData._id
          ).getTimestamp();
          getUserByUsername.accountCreationDate = timestamp;
          getUserByUsername.phone =
            isPublicProfile === "yes"
              ? getUserByUsername?.phone
              : getUserByUsername?.isPhonePublic
              ? getUserByUsername.phone
              : "";
          getUserByUsername.email =
            isPublicProfile === "yes"
              ? getUserByUsername?.email
              : getUserByUsername?.isEmailPublic
              ? getUserByUsername.email
              : "";
          let userRegisteredRequiredData = [];
          let captainBeeRegisteredRequiredData = [];
          for (
            let i = 0;
            i < getAffilatedUserFullData.relationships.length;
            i++
          ) {
            let getAllRegisteredUsers = await uservice.findOneSelect(
              {
                email: getAffilatedUserFullData.relationships[i].honeybeeEmail,
              },
              {}
            );

            let currentData = {
              username: getAllRegisteredUsers?.username
                ? getAllRegisteredUsers?.username
                : getAllRegisteredUsers?.email.split("@")[0],
              lastName: getAllRegisteredUsers?.lastName,
              firstName: getAllRegisteredUsers?.firstName,
              email: getAffilatedUserFullData.relationships[i].honeybeeEmail,
              isKYCPass: getAllRegisteredUsers?.isKYCPass,
              kycStatus: getAllRegisteredUsers?.kycStatus,
              permissions:
                getAffilatedUserFullData.relationships[i].permissions,
              profilePic: getAllRegisteredUsers?.profilePic,
            };
            userRegisteredRequiredData.push(currentData);
          }
          for (
            let i = 0;
            i < getAffilatedUserFullData.captainBeeRelationShips.length;
            i++
          ) {
            let getAllRegisteredUsers = await uservice.findOneSelect(
              {
                email:
                  getAffilatedUserFullData.captainBeeRelationShips[i]
                    .captainBeeEmail,
              },
              {}
            );

            let getAffiliateData = await affilateService.findOne({
              Email:
                getAffilatedUserFullData.captainBeeRelationShips[i]
                  .captainBeeEmail,
            });

            let currentData = {
              username: getAffiliateData?.Username
                ? getAffiliateData?.Username
                : getAllRegisteredUsers?.email.split("@")[0],
              lastName: getAffiliateData?.lastname,
              firstName: getAffiliateData?.firstname,
              email:
                getAffilatedUserFullData?.captainBeeRelationShips[i]
                  ?.captainBeeEmail,
              isKYCPass: getAllRegisteredUsers?.isKYCPass,
              kycStatus: getAllRegisteredUsers?.kycStatus,
              permissions:
                getAffilatedUserFullData.captainBeeRelationShips[i].permissions,
              profilePic: getAffiliateData?.photoIdFileurl,
            };
            captainBeeRegisteredRequiredData.push(currentData);
          }
          const date = new Date(timestamp);

          const options = {
            year: "numeric",
            month: "long",
            day: "numeric",
          } as any;
          const formattedDate = date.toLocaleDateString("en-US", options);
          const affiliateUserTotalEarnings = 0;
          // Additional data processing for nextPurchaseDate, downgradeTime, and paypalSubscriptionData
          const nextPurchaseDate =
            await this.getNextPurchaseDateOrDowngradeTime(
              getAffilatedUserFullData.email
            );
          const downgradeTime = await this.calculateDowngradeTime(
            getAffilatedUserFullData.email
          );

          let paypalSubscriptionData = await paypalSubscriptionService.findOne({
            payerEmail: getAffilatedUserFullData.email,
          });
          let getPaypalSubscriptionDetails = null;
          console.log("paypalSubscriptionData", paypalSubscriptionData);

          if (paypalSubscriptionData && paypalSubscriptionData.subscriptionId) {
            getPaypalSubscriptionDetails = await getSubscriptionDetails(
              paypalSubscriptionData.subscriptionId
            );
          }

          let nonPaypalSubscriptionData =
            await nonPaypalSubscriptionService.findOne({
              email: getAffilatedUserFullData.email,
            });

          let staticsData = {
            honeyBeesCount: affiliateUsersCount,
            captainsCount: captainUsersCount,
            ordersCount: affiliateUserManagedOrders,
            honeyBeesRegisteredData: userRegisteredRequiredData,
            captainBeeRegisteredRequiredData: captainBeeRegisteredRequiredData,
            affiliateUserProfile: getUserByUsername,
            accountCreationDate: timestamp,
            formatedAccountCreationDate: formattedDate,
            userFullData: getAffilatedUserFullData,
            powerPackData:
              getPowerPackData === undefined ? undefined : getPowerPackData,
            affiliateUserTotalEarnings: affiliateUserTotalEarnings,
            remainingTimeForINEXOrder: downgradeTime,
            nextPurchaseDate: nextPurchaseDate,
            paypalSubscriptionDetails: {
              paypalSubscriptionDBData: paypalSubscriptionData,
              paypalSubscriptionDetails: getPaypalSubscriptionDetails,
            },
            nonPaypalSubscriptionDetails: {
              nonPaypalSubscriptionDBData: nonPaypalSubscriptionData,
            },
          };

          return {
            message: "Affiliate users list",
            status: 200,
            data: staticsData,
          };
        } else {
          const data = {
            message: "No Affiliate Users exists",
            status: 500,
            data: null,
          };
          return data;
        }
      }
    } catch (err) {
      console.log("err", err);
      const data = {
        message: "User get failed",
        status: 500,
        data: null,
      };
      return data;
    }
  }

  async updateAffiliateUserData(
    req: any,
    res: any,
    username: string,
    email: string
  ) {
    try {
      console.log(username, req.body);
      let getAffilateUserByUsername = await affilateService.findOne({
        Username: username,
        Email: email,
      });

      if (getAffilateUserByUsername) {
        console.log("user fulldata");
        let updateAffiliateUser = await affilateService.updatePart(
          {
            Username: username,
            Email: email,
          },
          {
            $set: {
              photoIdFileurl:
                req.body.updateData.photo === undefined
                  ? getAffilateUserByUsername.photoIdFileurl
                  : req.body.updateData.photo,
              "socialMediaLink.facebook":
                req.body.updateData.facebookLink === undefined
                  ? getAffilateUserByUsername.socialMediaLink.facebook
                  : req.body.facebookLink,
              "socialMediaLink.twitter":
                req.body.updateData.twitter === undefined
                  ? getAffilateUserByUsername.socialMediaLink.twitter
                  : req.body.updateData.twitter,
              "socialMediaLink.instagram":
                req.body.updateData.insta === undefined
                  ? getAffilateUserByUsername.socialMediaLink.instagram
                  : req.body.updateData.insta,
              "socialMediaLink.linkedin":
                req.body.updateData.linkedin === undefined
                  ? getAffilateUserByUsername.socialMediaLink.linkedin
                  : req.body.updateData.linkedin,
              "socialMediaLink.youtube":
                req.body.updateData.youtube === undefined
                  ? getAffilateUserByUsername.socialMediaLink.youtube
                  : req.body.updateData.youtube,
              "socialMediaLink.discord":
                req.body.updateData.discord === undefined
                  ? getAffilateUserByUsername.socialMediaLink.discord
                  : req.body.updateData.discord,
              Website:
                req.body.Website === undefined
                  ? getAffilateUserByUsername.Website
                  : req.body.Website,
              firstname:
                req.body.updateData.firstname === undefined
                  ? getAffilateUserByUsername.firstname
                  : req.body.updateData.firstname,
              lastname:
                req.body.updateData.lastname === undefined
                  ? getAffilateUserByUsername.lastname
                  : req.body.updateData.lastname,
              Phone:
                req.body.updateData.Phone === undefined
                  ? getAffilateUserByUsername.Phone
                  : req.body.updateData.Phone,
              isPhonePublic:
                req.body.updateData.isPhonePublic === undefined
                  ? getAffilateUserByUsername?.isPhonePublic
                  : req.body.updateData.isPhonePublic,
              isEmailPublic:
                req.body.updateData.isEmailPublic === undefined
                  ? getAffilateUserByUsername?.isEmailPublic
                  : req.body.updateData.isEmailPublic,
              accname:
                req.body.updateData.accname === undefined
                  ? getAffilateUserByUsername.accname
                  : req.body.updateData.accname,
              PublicBio:
                req.body.updateData.PublicBio === undefined
                  ? getAffilateUserByUsername.PublicBio
                  : req.body.updateData.PublicBio,
            },
          }
        );

        console.log("updateAffiliateUser", updateAffiliateUser);

        //Get user from user table and Update the referral code of the user
        if (req.body.updateData.referralCode) {
          let getUserFromUserdb = await uservice.findOne({
            email: email,
          });
          let oldReferralCode = getUserFromUserdb.referralCode;
          let updateUserReferral = await uservice.updatePart(
            {
              email: email,
            },
            {
              referralCode: req.body.updateData.referralCode,
            }
          );
          console.log("updateUserReferral", updateUserReferral);
          //get all the users who are using the referral code which need to update to new
          const getAllUsersWithSameReferalcode = await uservice.find({
            referralCodeUsed: oldReferralCode,
          });
          let allUsersEmailUsingReferral = [];
          for (let i = 0; i < getAllUsersWithSameReferalcode.length; i++) {
            allUsersEmailUsingReferral.push(
              getAllUsersWithSameReferalcode[i].email
            );

            let updateRefererredUserData = await uservice.updatePart(
              {
                email: getAllUsersWithSameReferalcode[i].email,
              },
              {
                $set: {
                  referralCodeUsed: req.body.updateData.referralCode,
                },
              }
            );
            console.log("updateRefererredUserData", updateRefererredUserData);
          }
          console.log("allUsersEmailUsingReferral", allUsersEmailUsingReferral);
        }
        let getAffilatedUserFullData = await affilateService.findOne({
          email: getAffilateUserByUsername.Email,
        });
        return {
          message: "Affiliate users data updated",
          status: 200,
          data: getAffilatedUserFullData,
        };
      } else {
        const data = {
          message: "No Affiliate Users exists",
          status: 500,
          data: null,
        };
        return data;
      }
    } catch (err) {
      const data = {
        message: "User get failed",
        status: 500,
        data: null,
      };
      return data;
    }
  }

  async convertNormalUser(req: any, res: any) {
    try {
      //let ssnExists = await affilateService.findOne({ ssn: req.body.ssn });
      // let usernameExist = await affilateService.findOne({
      //   Username: req.body.Username,
      // });

      // if (ssnExists) {
      //   const data = {
      //     message: "SSN already exists",
      //     status: 500,
      //   };
      //   return data;
      // } else if (usernameExist) {
      //   const data = {
      //     message: "Username already exists",
      //     status: 500,
      //   };
      //   return data;
      // } else if (ssnExists && usernameExist) {
      //   const data = {
      //     message: "Username and SSN already exist",
      //     status: 500,
      //   };
      //   return data;
      // } else {
      // Create a new user based on the client request
      let user = { ...req.body };
      let calculatedLevel;
      // Check if a referral code is provided in the client request
      if (req.body.referralCode) {
        // Calculate the level and update the records based on the referral code
        const referringAffiliate = await affilateService.find({});
        let allAffiliateUsers = [];
        for (let index = 0; index < referringAffiliate.length; index++) {
          const element = referringAffiliate[index];
          let findUser = await uservice.findOne({
            email: element.Email,
          });
          element.userData = findUser;
          console.log(element.Email);
          allAffiliateUsers.push(element);
        }
        if (referringAffiliate) {
          // You can implement your level calculation logic here
          // For example, based on the number of referrals, volume, or other criteria
          calculatedLevel = await calculateLevelByReferralCode(
            allAffiliateUsers,
            req.body.referralCode
          );
          // let getPassword = await uservice.createPassword(user.password);
          // user.password = getPassword.hash;
          // user.confirmpass = getPassword.hash;
          // Update the user's level and other relevant properties
          user.level = calculatedLevel.level;
          user.referralCodeUsed = req.body.referralCode;
          user.greetingCards = await this.createGreetingCards();
        }
      }
      console.log("calculatedLevel", calculatedLevel);

      let updateReferredUserLevel = await affilateService.updatePart(
        {
          Email: calculatedLevel?.user.Email,
        },
        {
          $set: {
            totalDownlineCount: calculatedLevel?.user.totalDownlineCount
              ? calculatedLevel?.user.totalDownlineCount + 1
              : 1,
          },
        }
      );

      console.log("updateReferredUserLevel", updateReferredUserLevel);
      user.isNormalUser = true;
      // Save the user to the database
      await tempAffilateService.create(user);
      // let getUser = await uservice.findOne({
      //   email: req.body.email,
      // });
      // let getPassword = await uservice.createPassword(req.body.password);
      // getUser.authProviders[0].phash = getPassword.hash;
      // getUser.authProviders[0].psalt = getPassword.salt;
      // let createUser = await uservice.updatePart(
      //   {
      //     email: req.body.Email,
      //   },
      //   {
      //     $set: {
      //       authProviders: getUser.authProviders,
      //     },
      //   }
      // );
      await new SendEmail().sendCaptainBeeRequestNotificationToAdmin(
        req.body.firstname + " " + req.body.lastname,
        req.body.Email
      );
      const data = {
        message: "User created",
        status: 200,
      };
      return data;
      //}
    } catch (err) {
      const data = {
        message: "User failed",
        status: 500,
      };
      return data;
    }
  }

  async getNextPurchaseDateOrDowngradeTime(email: string): Promise<string> {
    try {
      const powerPackData = await powerPackService.findOne({ email: email });
      const inexPurchase = await orderService.findOne({
        "user.email": email,
        comments: "INEX Monthly Purchase",
        status: OrderStatus.Completed,
      });

      let nextActionDate: moment.Moment;

      if (inexPurchase && inexPurchase.orderCompletedOn) {
        nextActionDate = moment(inexPurchase.orderCompletedOn).add(30, "days");
      } else if (powerPackData && powerPackData.purchaseDate) {
        nextActionDate = moment(powerPackData.purchaseDate).add(30, "days");
      } else {
        return "";
      }

      return nextActionDate.format("YYYY-MM-DD HH:mm:ss");
    } catch (err) {
      console.log("Err in getNextPurchaseDateOrDowngradeTime", err);
      return "";
    }
  }

  async calculateDowngradeTime(email: string): Promise<number> {
    try {
      const powerPackData = await powerPackService.findOne({ email: email });
      const inexPurchase = await orderService.findOne({
        email: email,
        comments: "INEX Monthly Purchase",
        status: OrderStatus.Completed,
      });

      let purchaseDate = inexPurchase
        ? inexPurchase.orderCompletedOn
        : powerPackData?.purchaseDate;
      if (!purchaseDate) {
        console.log("No valid purchase date found");
        return 0;
      }

      const currentDate = new Date();
      const deadlineDate = moment(purchaseDate).add(30, "days");

      return deadlineDate.diff(currentDate, "days");
    } catch (err) {
      console.log("Err in calculateDowngradeTime", err);
      return 0;
    }
  }

  async downgradeUserRanks0(): Promise<void> {
    try {
      const users = await affilateService.find({});

      for (const user of users) {
        const daysLeft = await this.calculateDowngradeTime(user.Email);
        if (daysLeft <= 0) {
          await affilateService.updatePart(
            { Email: user.Email },
            { $set: { rank: "Bronze" } }
          );
          console.log(`User ${user.Email} downgraded to Bronze`);
        }
      }
    } catch (err) {
      console.log(err);
    }
  }

  async downgradeUserRanks(): Promise<void> {
    try {
      downgradeRankLogToFile(
        "----------------Started downgrade rank job-----------------"
      );
      const users = await affilateService.find({});

      for (const user of users) {
        const daysLeft = await this.calculateDowngradeTime(user.Email);
        if (daysLeft <= 0) {
          await affilateService.updatePart(
            { Email: user.Email },
            { $set: { rank: "Bronze" } }
          );
          const logMsg = `User ${user.Email} downgraded to Bronze`;
          console.log(logMsg);
          downgradeRankLogToFile(logMsg);
        }
      }

      downgradeRankLogToFile("All rank downgrade processes completed");
    } catch (err: any) {
      const errorMsg = `Error: ${err?.message}`;
      downgradeRankLogToFile(errorMsg);
      console.error("Error in downgradeUserRanks scheduled task:", err);
    }
  }

  async shareGreetingCard(req: any, res: any) {
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

      email = String(email).toLowerCase();
      let walletregister = await wuserservice.findOne({
        email: receiverEmail,
      });

      let register = await uservice.findOne({ email: receiverEmail });

      if (register || walletregister) {
        for (let i = 0; i < register.authProviders.length; i++) {
          if (register.authProviders[i].provider == "Local") {
            const message = MessageConstants.EmailRegistered;
            //const message = "emailRegistered";
            return { status: 500, data: message };
          } else {
            return { status: 500, data: "" };
          }
        }
        const message = `Receiver Email ${receiverEmail} already registered`;
        return { status: 500, data: message };
      }

      let getAfffiliateData = await affilateService.findOne({
        Email: email,
      });
      let getUser = await uservice.findOne({
        email: email,
      });
      let getSelectedGreetingCard: GreetingCard =
        getAfffiliateData.greetingCards.find(
          (x) => x.code === greetingCode
        ) as GreetingCard;
      if (getSelectedGreetingCard?.isUsed) {
        const message = `Selected Giftcard ${receiverEmail} already used.`;
        return { status: 500, data: message };
      } else if (!getSelectedGreetingCard?.isActive) {
        const message = `The selected gift card is not available for sharing.`;
        return { status: 500, data: message };
      }
      getSelectedGreetingCard.isUsed = true;
      getSelectedGreetingCard.receiverEmail = receiverEmail;
      getSelectedGreetingCard.senderEmail = email;
      getSelectedGreetingCard.message = greetingWords;
      getSelectedGreetingCard.userType = userType;
      getSelectedGreetingCard.imageUrl = greetingCardImageUrl;
      getSelectedGreetingCard.sendDate = new Date();

      let updateGreetingcard = await affilateService.updatePart(
        {
          Email: email,
          "greetingCards.code": greetingCode,
        },
        {
          $set: {
            "greetingCards.$.isUsed": true,
            "greetingCards.$.receiverEmail": receiverEmail,
            "greetingCards.$.senderEmail": email,
            "greetingCards.$.message": greetingWords,
            "greetingCards.$.userType": userType,
            "greetingCards.$.imageUrl": greetingCardImageUrl,
            "greetingCards.$.sendDate": new Date(),
          },
        }
      );
      let captainName =
        getAfffiliateData.firstname + " " + getAfffiliateData?.lastname;
      let baseHiveUrl =
        keys.env.key === "development"
          ? "https://test.hive.indexx.ai/"
          : "https://hive.indexx.ai/";
      let baseExchangeUrl =
        keys.env.key === "development"
          ? "https://test.cex.indexx.ai/"
          : "https://cex.indexx.ai/";
      let referralUrl =
        userType === "captainbee"
          ? `${baseHiveUrl}sign-up?referral=${getUser.referralCode}&gcode=${greetingCode}`
          : `${baseExchangeUrl}indexx-exchange/buy-sell/get-started-honeybee?referral=${getUser.referralCode}&gcode=${greetingCode}`;
      await new SendEmail().greetingCardEmail(
        receiverEmail,
        captainName,
        referralUrl,
        getSelectedGreetingCard?.numberOfTokens,
        greetingWords,
        greetingCardImageUrl,
        receiverName,
        userType
      );
      const data = {
        message: "Greeting card shared successfully",
        status: 200,
        data: null,
      };
      return data;
    } catch (err: any) {
      const data = {
        message: "Failed to send greeting card",
        status: 500,
        data: null,
      };
      return data;
    }
  }
}
