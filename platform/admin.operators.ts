import { Lottery, Ticket } from "../data/lottery";
import { UserService } from "../services/user.service";
import { BaseAPIOperations } from "./base.operations";
import { Request, Response } from "express";
import { SendEmail } from "./email.operations";
import { MediumPostService } from "../services/mediumPost.service";
import { v1 as uuidv1 } from "uuid";
import { User } from "../data/user";
import { ProfitLogService } from "../services/profitLog.service";

const userService: UserService = new UserService();
const mediumPostService: MediumPostService = new MediumPostService();
let profitLogService: ProfitLogService = new ProfitLogService();

export class AdminOperations extends BaseAPIOperations {
  constructor(req: Request, res: Response) {
    super(req, res);
  }

  async processLotteryWinner(
    req: any,
    res: any,
    lottery: Lottery,
    winningTicket: any,
    winnerPosition: number
  ) {
    try {
      let getWinnerEmail = winningTicket.email;
      let updateWallet = await userService.updatePart(
        {
          email: getWinnerEmail,
        },
        {}
      );

      let InexToSent = lottery.prizePool[winnerPosition - 1];
      let getUser = await userService.findOne({
        email: getWinnerEmail,
      });
      let userAddress = getUser.userWallets.find(
        (x) => x.coinSymbol === lottery.coinName
      );
      if (lottery.assetType === "crypto") {
        // Update the user balance
        let updateUserWallet = await userService.updatePart(
          {
            email: getWinnerEmail,
            "userWallets.coinSymbol": lottery.coinName,
          },
          {
            $set: {
              coinLastUsedOn: new Date(),
              "userWallets.$.coinBalance":
                Number(userAddress?.coinBalance) + Number(InexToSent),
            },
          }
        );
      }

      //send email to user for congrulations
      await new SendEmail().sendLotteryWinEmail(winningTicket, lottery);
      const data = {
        message: "Lottery Processed successfully",
        status: 200,
      };
      return data;
    } catch (err) {
      const data = {
        message: "Lottery Process failed",
        status: 500,
      };
      return data;
    }
  }

  async getMediumPost(req: any, res: any) {
    try {
      const getAllMediumPost = await mediumPostService.find({});
      if (getAllMediumPost.length === 0) {
        const data = {
          message: "No Medium Post found",
          status: 404,
        };
        return data;
      }

      const data = {
        message: "All Medium posts fetched Successfully",
        status: 200,
        data: getAllMediumPost,
      };
      return data;
    } catch (err: any) {
      const data = {
        message: "Medium posts fetched failed",
        status: 500,
      };
      return data;
    }
  }

  async getProfitLogs(req: any, res: any) {
    try {
      const getProfitLogs = await profitLogService.find({});
      if (getProfitLogs.length === 0) {
        const data = {
          message: "No Profit logs found",
          status: 404,
        };
        return data;
      }

      const data = {
        message: "All Profit logs fetched Successfully",
        status: 200,
        data: getProfitLogs,
      };
      return data;
    } catch (err: any) {
      const data = {
        message: "Profit logs fetched failed",
        status: 500,
      };
      return data;
    }
  }

  async getMediumPostById(req: any, res: any) {
    try {
      let id = req.params.id;
      console.log("params", id);
      const getPostById = await mediumPostService.findOne({
        postId: id,
      });
      console.log("getPostById", getPostById);
      if (!getPostById) {
        const data = {
          message: "No Medium Post found",
          status: 404,
        };
        return data;
      }

      const data = {
        message: "Medium post id",
        status: 200,
        data: getPostById,
      };
      return data;
    } catch (err: any) {
      const data = {
        message: "Medium post failed get by id",
        status: 500,
      };
      return data;
    }
  }

  async addNewMediumPost(req: any, res: any) {
    try {
      let {
        imageUrl, // URL of the post's image
        title, // Title of the post
        description, // Subtitle or description of the post
        url,
      } = req.body;

      let newPost = await mediumPostService.create({
        postId: uuidv1(),
        imageUrl,
        title,
        description,
        url,
        createdAt: new Date(),
        updatedAt: new Date(), // Optional date when the post was last updated
        tags: [], // Optional tags or categories for the post
        readTime: 0, // Estimated reading time in minutes
        claps: 0, // Number of claps the post has received
        commentsCount: 0, // Number of comments on the post
        isPublished: true,
        author: "",
      });
      console.log("newPost", newPost);

      const allUsers: User[] = await userService.find({}); // Get all users from the DB

      // Step 3: Send emails in parallel without waiting for completion
      allUsers.forEach((user: User) => {
        if (user?.email) {
          new SendEmail().sendMediumPostEmail({
            toEmail: user.email,
            imageUrl,
            title,
            description,
            url,
          });
        }
      });

      const data = {
        message: "New Post added successfully",
        status: 200,
        data: newPost,
      };
      return data;
    } catch (err: any) {
      const data = {
        message: "Adding a Medium Post failed",
        status: 500,
      };
      return data;
    }
  }

  async updateMediumPost(req: any, res: any) {
    try {
      let {
        imageUrl, // URL of the post's image
        title, // Title of the post
        description, // Subtitle or description of the post
        url,
      } = req.body;

      let newPost = await mediumPostService.updatePart(
        {
          postId: req.body.postId,
        },
        {
          $set: {
            imageUrl,
            title,
            description,
            url,
            updatedAt: new Date(),
          }, // Optional date when the post was last updated
        }
      );
      console.log("newPost", newPost);

      const data = {
        message: "New Post added successfully",
        status: 200,
        data: newPost,
      };
      return data;
    } catch (err: any) {
      const data = {
        message: "Updating a Medium Post failed",
        status: 500,
      };
      return data;
    }
  }

  async sendPromotionEmail(req: any, res: any) {
    try {
        // Extract inputs from the request body
        const {
            subject,
            bodyContent,
            senderName,
            senderEmail,
            replyToEmail,
            bccEmails,
            bannerUrl
        } = req.body;

        // Get all users from the DB
        const allUsers: User[] = await userService.find({});

        // Start sending emails asynchronously without waiting for completion
        allUsers
            .forEach((user: User) => {
                new SendEmail().sendGenericEmail({
                    toEmail: user.email,
                    subject,
                    bodyContent,
                    senderName: senderName || "Indexx.ai",
                    senderEmail: senderEmail || "accounts@azooca.com",
                    replyToEmail: replyToEmail || "wallet@azooca.com",
                    bccEmails: bccEmails || [
                        "omkar@azooca.com",
                        "bz@azooca.com",
                        "lili@azooca.com",
                        "accounts@azooca.com",
                    ],
                    bannerUrl: bannerUrl
                });
            });

        // Return success response immediately
        return {
            message: "Promotion emails are being sent",
            status: 200,
        };
    } catch (err) {
        console.error("Error starting promotional emails:", err);
        return {
            message: "Failed to initiate promotional emails",
            status: 500,
        };
    }
}

}
