import { UserRoleTypes } from "../data/user";
import { UserOperations } from "../platform/user.operations";
import { CurrencyService } from "../services/currency.service";
import { UserService } from "../services/user.service";
import { GiftCardService } from "../services/giftCard.service";
import { GiftCard } from "../data/giftCard";
import { getCryptoPriceBySymobl } from "./priceAPI";
import { GiftCardOperations } from "../platform/giftCard.operations";

const giftCardService: GiftCardService = new GiftCardService();

export class GiftCardController {
  constructor() {}

  async validateGiftCard(req: any, res: any) {
    try {
      const { voucher } = req.body;

      if (!voucher) {
        return res
          .status(400)
          .json({ status: 400, error: "Voucher code is required" });
      }

      const giftCard = (await giftCardService.findOne({
        voucher: voucher,
      })) as GiftCard;

      if (!giftCard) {
        return res
          .status(404)
          .json({ status: 404, error: "Invalid voucher code" });
      }

      if (giftCard.isUsed) {
        return res.status(400).json({
          status: 404,
          error: "This voucher code has already been used",
        });
      }
      const giftCardOperations = new GiftCardOperations(req, res);
      const options = await giftCardOperations.getRedeemAbleItems(
        req,
        res,
        giftCard
      );
      console.log(options);
      return res.status(200).json({
        status: 200,
        data: { message: "Voucher code is valid", giftCard, options },
      });
    } catch (error: any) {
      console.log(error);
      return res.status(500).json({ status: 500, error: error.message });
    }
  }

  async validateXNFTGiftCard(req: any, res: any) {
    try {
      const { voucher } = req.body;

      if (!voucher) {
        return res
          .status(400)
          .json({ status: 400, error: "Voucher code is required" });
      }

      const giftCard = (await giftCardService.findOne({
        voucher: voucher,
      })) as GiftCard;

      if (!giftCard) {
        return res
          .status(404)
          .json({ status: 404, error: "Invalid voucher code" });
      }

      if (giftCard.isUsed) {
        return res.status(400).json({
          status: 404,
          error: "This voucher code has already been used",
        });
      }
      const giftCardOperations = new GiftCardOperations(req, res);

      const options = await giftCardOperations.getXNFTRedeemAbleItems(
        req,
        res,
        giftCard
      );

      console.log(options);
      return res.status(200).json({
        status: 200,
        data: { message: "Voucher code is valid", giftCard, options },
      });
    } catch (error: any) {
      console.log(error);
      return res.status(500).json({ status: 500, error: error.message });
    }
  }

  async validateStockGiftCard(req: any, res: any) {
    try {
      const { voucher } = req.body;

      if (!voucher) {
        return res
          .status(400)
          .json({ status: 400, error: "Voucher code is required" });
      }

      const giftCard = (await giftCardService.findOne({
        voucher: voucher,
      })) as GiftCard;

      if (!giftCard) {
        return res
          .status(404)
          .json({ status: 404, error: "Invalid voucher code" });
      }

      if (giftCard.isUsed) {
        return res.status(400).json({
          status: 404,
          error: "This voucher code has already been used",
        });
      }
      const giftCardOperations = new GiftCardOperations(req, res);

      const options = await giftCardOperations.getStockRedeemAbleItems(
        req,
        res,
        giftCard
      );

      console.log("giftCard.type", giftCard.type)

      

      console.log(options);
      return res.status(200).json({
        status: 200,
        data: {
          message: "Voucher code is valid",
          giftCard,
          options: options,
        },
      });
    } catch (error: any) {
      console.log(error);
      return res.status(500).json({ status: 500, error: error.message });
    }
  }

  async redeemGiftCard(req: any, res: any) {
    try {
      return res.status(403).json({
        status: 403,
        error: "Gift card redemption is currently disabled",
      });

      const { voucher, userWallerAddress } = req.body;

      if (!voucher || !userWallerAddress) {
        return res.status(400).json({
          status: 400,
          error: "Voucher code and User Wallet Address are required",
        });
      }

      const giftCard = await giftCardService.findOne({ voucher: voucher });

      if (!giftCard) {
        return res
          .status(404)
          .json({ status: 404, error: "Invalid voucher code" });
      }

      if (giftCard.isUsed) {
        return res.status(400).json({
          status: 400,
          error: "This voucher code has already been used",
        });
      }

      const giftCardOperations = new GiftCardOperations(req, res);
      const options = await giftCardOperations.getRedeemAbleItems(
        req,
        res,
        giftCard
      );
      console.log(options);
      const result = await giftCardOperations.redeemCoupon(
        req,
        res,
        options,
        giftCard,
        userWallerAddress
      );

      console.log("userWallerAddress", result);

      // Mark gift card as used
      await giftCardService.updatePart(
        {
          voucher: voucher,
        },
        {
          $set: {
            isUsed: true,
            redeemedOn: new Date(),
            redeemedBy: userWallerAddress,
          },
        }
      );
      let finalAmount = giftCard.amount - 2;
      const NFTValue = finalAmount * 0.8;
      const tokenValue = finalAmount * 0.15;
      return res.status(200).json({
        message: "Voucher redeemed successfully",
        NFTValue,
        tokenValue,
        result,
      });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  async redeemXNFTCard(req: any, res: any) {
    try {
      return res.status(403).json({
        status: 403,
        error: "Gift card redemption is currently disabled",
      });

      const { voucher, userWallerAddress } = req.body;

      if (!voucher || !userWallerAddress) {
        return res.status(400).json({
          status: 400,
          error: "Voucher code and User Wallet Address are required",
        });
      }

      const giftCard = await giftCardService.findOne({ voucher: voucher });

      if (!giftCard) {
        return res
          .status(404)
          .json({ status: 404, error: "Invalid voucher code" });
      }

      if (giftCard.isUsed) {
        return res.status(400).json({
          status: 400,
          error: "This voucher code has already been used",
        });
      }

      const giftCardOperations = new GiftCardOperations(req, res);
      const options: any = await giftCardOperations.getXNFTRedeemAbleItems(
        req,
        res,
        giftCard
      );
      console.log(options);
      console.log(giftCard, "giftCard");
      const result = await giftCardOperations.redeemXNFTCoupon(
        req,
        res,
        options,
        giftCard,
        userWallerAddress
      );

      console.log("userWallerAddress", result);

      // Mark gift card as used
      await giftCardService.updatePart(
        {
          voucher: voucher,
        },
        {
          $set: {
            isUsed: true,
            redeemedOn: new Date(),
            redeemedBy: userWallerAddress,
          },
        }
      );
      let finalAmount = Number(options?.usdValue) - 2;
      const NFTValue = finalAmount * 0.8;
      const tokenValue = finalAmount * 0.15;
      return res.status(200).json({
        message: "Voucher redeemed successfully",
        NFTValue,
        tokenValue,
        result,
        options,
      });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  async redeemStockGiftCardForSwap(req: any, res: any) {
    try {
      return res.status(403).json({
        status: 403,
        error: "Gift card redemption is currently disabled",
      });

      const { voucher, userWallerAddress } = req.body;

      if (!voucher || !userWallerAddress) {
        return res.status(400).json({
          status: 400,
          error: "Voucher code and User Wallet Address are required",
        });
      }

      const giftCard = await giftCardService.findOne({ voucher: voucher });

      if (!giftCard) {
        return res
          .status(404)
          .json({ status: 404, error: "Invalid voucher code" });
      }

      if (giftCard.isUsed) {
        return res.status(400).json({
          status: 400,
          error: "This voucher code has already been used",
        });
      }

      const giftCardOperations = new GiftCardOperations(req, res);
      const options: any = await giftCardOperations.getXNFTRedeemAbleItems(
        req,
        res,
        giftCard
      );
      console.log(options);
      console.log(giftCard, "giftCard");
      const result = await giftCardOperations.redeemXNFTCoupon(
        req,
        res,
        options,
        giftCard,
        userWallerAddress
      );

      console.log("userWallerAddress", result);

      // Mark gift card as used
      await giftCardService.updatePart(
        {
          voucher: voucher,
        },
        {
          $set: {
            isUsed: true,
            redeemedOn: new Date(),
            redeemedBy: userWallerAddress,
          },
        }
      );
      let finalAmount = Number(options?.usdValue) - 2;
      const NFTValue = finalAmount * 0.8;
      const tokenValue = finalAmount * 0.15;
      return res.status(200).json({
        message: "Voucher redeemed successfully",
        NFTValue,
        tokenValue,
        result,
        options,
      });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  async redeemStockGiftCardForExchange(req: any, res: any) {
    try {
      return res.status(403).json({
        status: 403,
        error: "Gift card redemption is currently disabled",
      });

      const { voucher, email } = req.body;

      if (!voucher || !email) {
        return res.status(400).json({
          status: 400,
          error: "Voucher code and User Wallet Address are required",
        });
      }

      const giftCard = await giftCardService.findOne({ voucher: voucher });

      if (!giftCard) {
        return res
          .status(404)
          .json({ status: 404, error: "Invalid voucher code" });
      }

      if (giftCard.isUsed) {
        return res.status(400).json({
          status: 400,
          error: "This voucher code has already been used",
        });
      }

      const giftCardOperations = new GiftCardOperations(req, res);
      const options: any = await giftCardOperations.getStockRedeemAbleItems(
        req,
        res,
        giftCard
      );
      console.log(options);
      console.log(giftCard, "giftCard");
      const result = await giftCardOperations.redeemStockCouponBinanceChain(
        req,
        res,
        options,
        giftCard,
        email
      );

      console.log("userWallerAddress", result);

      // Mark gift card as used
      await giftCardService.updatePart(
        {
          voucher: voucher,
        },
        {
          $set: {
            isUsed: true,
            redeemedOn: new Date(),
            redeemedBy: email,
          },
        }
      );

      return res.status(200).json({
        message: "Voucher redeemed successfully",
        result,
        options,
      });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  async withdrawStockTokenFromExchanage(req: any, res: any) {
    try {
      const { coin, email, amount, walletAddress, network } = req.body;
      if (!coin || !email || !amount) {
        return res.status(400).json({
          status: 400,
          error: "coin, email and amount are required",
        });
      }
      const giftCardOperations = new GiftCardOperations(req, res);
      const checkBeforeWallet =
        await giftCardOperations.getUserWalletAndCheckHasBalance(
          req,
          res,
          email,
          coin,
          network,
          amount
        );
      if (checkBeforeWallet.status === 200) {
        const withdraw = await giftCardOperations.withdrawStockToken(
          req,
          res,
          amount,
          coin,
          walletAddress
        );
        if (withdraw.status === 200) {
          // update user balance in db
          const updateBalance =
            await giftCardOperations.updateWalletAndCheckHasBalance(
              req,
              res,
              email,
              coin,
              network,
              amount
            );
          console.log("updateBalance", JSON.stringify(updateBalance));
          return res.status(200).json({
            message: "Withdraw successful and updated db",
            withdraw,
          });
        } else {
          return res.status(200).json({
            message: "Withdraw successful and failed to update db",
            withdraw,
          });
        }
      } else {
        return res.status(301).send("User has insufficient balance");
      }
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  /**Helpers**/
  async getRedeemAbleItems1(giftCardData: any) {
    try {
      console.log(giftCardData);
      const btcToUsdRate = await getCryptoPriceBySymobl("BTC"); // Conversion rate for BTC to USD
      const ethToUsdRate = await getCryptoPriceBySymobl("ETH"); // Conversion rate for ETH to USD

      const giftCardValue = giftCardData.amount;
      console.log(giftCardValue);
      if (giftCardData.type === "BTC") {
        const bitcoinBlack = {
          value: 1,
          valueInUSD: btcToUsdRate.data.lastPrice,
        };
        const bitcoinPurple = {
          value: 0.5,
          valueInUSD: 0.5 * btcToUsdRate.data.lastPrice,
        };
        const bitcoinBlue = {
          value: 0.25,
          valueInUSD: 0.25 * btcToUsdRate.data.lastPrice,
        };
        const bitcoinGreen = {
          value: 0.1,
          valueInUSD: 0.1 * btcToUsdRate.data.lastPrice,
        };
        const bitcoinPink = {
          value: 0.01,
          valueInUSD: 0.01 * btcToUsdRate.data.lastPrice,
        };
        const bitcoinOrange = {
          value: 0.001,
          valueInUSD: 0.001 * btcToUsdRate.data.lastPrice,
        };

        console.log(bitcoinBlack);
        console.log(bitcoinPurple);
        console.log(bitcoinBlue);
        console.log(bitcoinGreen);
        console.log(bitcoinPink);
        console.log(bitcoinOrange);
      } else if (giftCardData.type === "ETH") {
        const ethBlack = {
          value: 1,
          valueInUSD: ethToUsdRate.data.lastPrice,
        };
        const ethPurple = {
          value: 0.5,
          valueInUSD: 0.5 * ethToUsdRate.data.lastPrice,
        };
        const ethBlue = {
          value: 0.25,
          valueInUSD: 0.25 * ethToUsdRate.data.lastPrice,
        };
        const ethGreen = {
          value: 0.1,
          valueInUSD: 0.1 * ethToUsdRate.data.lastPrice,
        };
        const ethPink = {
          value: 0.01,
          valueInUSD: 0.01 * ethToUsdRate.data.lastPrice,
        };
        const ethOrange = {
          value: 0.001,
          valueInUSD: 0.001 * ethToUsdRate.data.lastPrice,
        };

        console.log(ethBlack);
        console.log(ethPurple);
        console.log(ethBlue);
        console.log(ethGreen);
        console.log(ethPink);
        console.log(ethOrange);
      } else {
      }
      return 1;
    } catch (error) {
      console.log(error);
      return error;
    }
  }

  async distributeNFT(userWallerAddress: string, NFTValue: number) {}

  async distributeTokens(userWallerAddress: string, NFTValue: number) {}
}
