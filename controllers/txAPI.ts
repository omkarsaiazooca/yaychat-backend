import { UserOperations } from "../platform/user.operations";
import { JwtAuthUtil } from "../platform/jwt.operations";
import { TxOperations } from "../platform/tx.operations";
import { SendEmail } from "../platform/email.operations";
import { TransactionService } from "../services/transaction.service";
import { UserService } from "../services/user.service";
import { OrderStatus } from "../data/order";
import { v1 as uuidv1 } from "uuid";

function normalizeEmail(email: any): string {
  return String(email || "").trim().toLowerCase();
}

function isBTCY(coin: any): boolean {
  return String(coin || "").trim().toUpperCase() === "BTCY";
}

const userService = new UserService();

export class TxController {
  constructor() { }

  async createTransaction(req: any, res: any) {
    try {
      const { email, txHash, coin } = req.body;
      const txOps: TxOperations = new TxOperations(req, res);
      const tx = await txOps.createTransaction(req, res);
      res.statusCode = tx.status;
      res.send(tx);
      return;
    } catch (err) {
      console.log(err);
      return { status: 500, data: { message: "Unhandled error: " + err } };
    }
  }

  async registerFiatDeposit(req: any, res: any) {
    try {
      const { email, coin, amount } = req.body;
      if (
        !email ||
        !coin ||
        !amount ||
        email === undefined ||
        coin === undefined ||
        amount === undefined
      ) {
        return res.status(400).json({ message: "Invalid request" });
      }
      const txOps: TxOperations = new TxOperations(req, res);
      const dataResults = await txOps.registerFiatDeposit(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      console.log(err);
      return { status: 500, data: { message: "Unhandled error: " + err } };
    }
  }

  async registerFiatDepositForSmartApy(req: any, res: any) {
    try {
      const { email, coin, amount } = req.body;
      if (
        !email ||
        !coin ||
        !amount ||
        email === undefined ||
        coin === undefined ||
        amount === undefined
      ) {
        return res.status(400).json({ message: "Invalid request" });
      }
      const txOps: TxOperations = new TxOperations(req, res);
      const dataResults = await txOps.registerFiatDeposit(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      console.log(err);
      return { status: 500, data: { message: "Unhandled error: " + err } };
    }
  }

  async registerFiatDepositForOrder(req: any, res: any) {
    try {
      const { email, orderId, fromDetails, toDetails, paymentReceiptUrl } = req.body;
      if (
        !email ||
        !orderId ||
        !fromDetails ||
        !orderId ||
        !toDetails ||
        !paymentReceiptUrl ||
        email === undefined ||
        orderId === undefined ||
        fromDetails === undefined ||
        toDetails === undefined ||
        paymentReceiptUrl === undefined
      ) {
        return res.status(400).json({ message: "Invalid request" });
      }
      const txOps: TxOperations = new TxOperations(req, res);
      const dataResults = await txOps.registerFiatDepositForOrder(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      console.log(err);
      return { status: 500, data: { message: "Unhandled error: " + err } };
    }
  }

  async registerCryptoWithdraw(req: any, res: any) {
    try {
      const { email, coin, amount, address } = req.body;
      if (
        !email ||
        !coin ||
        !amount ||
        !address ||
        email === undefined ||
        coin === undefined ||
        amount === undefined ||
        address === undefined
      ) {
        return res.status(400).json({ message: "Invalid request" });
      }
      const txOps: TxOperations = new TxOperations(req, res);
      const dataResults = await txOps.registerCryptoWithdraw(req, res);
      res.statusCode = dataResults.status;
      res.send(dataResults);
      return;
    } catch (err) {
      console.log(err);
      return { status: 500, data: { message: "Unhandled error: " + err } };
    }
  }

  async registerCryptoWithdrawRequest(req: any, res: any) {
    try {
      const { email, coin, amount, address, coinNetwork, note } = req.body;
      if (
        !email ||
        !coin ||
        !amount ||
        !address ||
        email === undefined ||
        coin === undefined ||
        amount === undefined ||
        address === undefined
      ) {
        return res.status(400).json({ message: "Invalid request" });
      }
      const normalizedEmail = String(email).trim().toLowerCase();
      const normalizedCoin = String(coin || "").trim().toUpperCase();
      const normalizedNetwork = String(coinNetwork || "").trim().toLowerCase();
      const requestAmount = Number(amount) || 0;
      if (isBTCY(normalizedCoin)) {
        return res.status(400).json({
          status: 400,
          data: { message: "BTCY withdrawal is not supported from this page." },
        });
      }
      if (!Number.isFinite(requestAmount) || requestAmount <= 0) {
        return res.status(400).json({
          status: 400,
          data: { message: "amount must be greater than 0" },
        });
      }
      const user = await userService.findOneSelect(
        { email: normalizedEmail },
        { userWallets: 1, email: 1 }
      );
      if (!user) {
        return res.status(404).json({
          status: 404,
          data: { message: "User not found" },
        });
      }
      const userWallet = (user.userWallets || []).find((wallet: any) => {
        const walletCoin = String(wallet?.coinSymbol || "").trim().toUpperCase();
        const walletNetwork = String(wallet?.coinNetwork || wallet?.chain || "").trim().toLowerCase();
        return walletCoin === normalizedCoin && (!normalizedNetwork || walletNetwork === normalizedNetwork);
      });
      if (!userWallet) {
        return res.status(400).json({
          status: 400,
          data: { message: `${normalizedCoin} wallet not found${coinNetwork ? ` on ${coinNetwork}` : ""}.` },
        });
      }
      const walletBalance = Number(userWallet.coinBalance || 0);
      if (!Number.isFinite(walletBalance) || walletBalance < requestAmount) {
        return res.status(400).json({
          status: 400,
          data: {
            message: `Insufficient ${normalizedCoin} balance. Available balance is ${walletBalance}.`,
          },
        });
      }
      const emailService = new SendEmail();
      const txService = new TransactionService();
      const withdrawTxData = {
        email: normalizedEmail,
        orderId: uuidv1(),
        extRef: "",
        txId: "",
        from: "",
        to: String(address),
        amount: requestAmount,
        info: "Manual crypto withdrawal request",
        status: OrderStatus.Pending,
        currencyRef: normalizedCoin,
        walletType: "ASSET_WALLET",
        transactionType: "WITHDRAW_CRYPTO",
        exchangeName: "CEX",
        txDate: new Date(),
        benificaryAddress: String(address || ""),
      };
      try {
        await txService.create(withdrawTxData);
      } catch (txErr) {
        console.error("Failed to record crypto withdrawal request transaction:", txErr);
      }
      let gasFees = 0;
      if (coinNetwork) {
        switch (String(coinNetwork).trim().toUpperCase()) {
          case "ETHEREUM":
            gasFees = 0.0005;
            break;
          case "BINANCE SMART CHAIN":
          case "BSC":
            gasFees = 0.0003;
            break;
          case "POLYGON":
            gasFees = 0.002;
            break;
          case "SOLANA":
            gasFees = 0.00001;
            break;
          default:
            gasFees = 0;
        }
      }
      const processingFee = requestAmount * 0.03;
      const approvedAmount = Math.max(requestAmount - processingFee - gasFees, 0);
      await emailService.sendWithdrawRequestEmail(
        normalizedEmail,
        "User",
        requestAmount,
        approvedAmount,
        "Crypto",
        withdrawTxData.orderId,
        "Pending Approval",
        {
          amountCurrency: normalizedCoin || "Crypto",
          walletAddress: String(address || ""),
          network: String(coinNetwork || ""),
          subjectStatus: "Request",
          emailType: "cryptoWithdrawal",
        }
      );
      return res.status(200).json({
        status: 200,
        data: {
          message:
            "Crypto withdrawal request recorded. We will follow up once the manual payout is ready.",
        },
      });
    } catch (err) {
      console.log(err);
      return res.status(500).json({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async registerFiatWithdraw(req: any, res: any) {
    try {
      const txOps: TxOperations = new TxOperations(req, res);
      const tx = await txOps.registerFiatWithdraw(req, res);
      res.statusCode = tx.status;
      res.send(tx);
      return;
    } catch (err) {
      console.log(err);
      return { status: 500, data: { message: "Unhandled error: " + err } };
    }
  }

  async updateTransaction(req: any, res: any) {
    try {
      const txOps: TxOperations = new TxOperations(req, res);
      const tx = await txOps.updateFiatWithdrawTx(req, res);
      res.statusCode = tx.status;
      res.send(tx);
      return;
    } catch (err) {
      console.log(err);
      return { status: 500, data: { message: "Unhandled error: " + err } };
    }
  }

  async sendCryptoByEmail(req: any, res: any) {
    try {
      const { toEmail, coin, amount, fromEmail } = req.body;
      if (
        !toEmail ||
        !fromEmail ||
        !coin ||
        !amount ||
        toEmail === undefined ||
        fromEmail === undefined ||
        coin === undefined ||
        amount === undefined
      ) {
        return res.status(400).json({ message: "Invalid request" });
      }

      const normalizedFromEmail = normalizeEmail(fromEmail);
      const normalizedToEmail = normalizeEmail(toEmail);
      if (normalizedFromEmail === normalizedToEmail) {
        return res.status(400).json({
          status: 400,
          data: { message: "Cannot send crypto to your own account" },
        });
      }

      req.body.fromEmail = normalizedFromEmail;
      req.body.toEmail = normalizedToEmail;

      if (isBTCY(coin)) {
        return res.status(400).json({
          status: 400,
          data: { message: "BTCY transfers are currently disabled" },
        });
      }

      const txOps: TxOperations = new TxOperations(req, res);
      const tx = await txOps.sendCryptoFromUser(req, res);
      res.statusCode = tx.status;
      res.send(tx);
      return;
    } catch (err) {
      console.log(err);
      return { status: 500, data: { message: "Unhandled error: " + err } };
    }
  }

  async sendCryptoByUserName(req: any, res: any) {
    try {
      const { toUsername, coin, amount, fromEmail } = req.body;
      if (
        !toUsername ||
        !fromEmail ||
        !coin ||
        !amount ||
        toUsername === undefined ||
        fromEmail === undefined ||
        coin === undefined ||
        amount === undefined
      ) {
        return res.status(400).json({ message: "Invalid request" });
      }

      req.body.fromEmail = normalizeEmail(fromEmail);
      req.body.toUsername = String(toUsername).trim();

      if (isBTCY(coin)) {
        return res.status(400).json({
          status: 400,
          data: { message: "BTCY transfers are currently disabled" },
        });
      }

      const txOps: TxOperations = new TxOperations(req, res);
      const tx = await txOps.sendCryptoFromUserUsingUsername(req, res);
      res.statusCode = tx.status;
      res.send(tx);
      return;
    } catch (err) {
      console.log(err);
      return { status: 500, data: { message: "Unhandled error: " + err } };
    }
  }
}
