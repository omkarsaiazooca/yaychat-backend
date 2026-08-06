import { ServiceBase } from "./base";
import { UserService } from "./user.service";
import { TransactionService } from "./transaction.service";
import { P2PTrade, P2PTradeStatus } from "../data/p2p";
import { UserRoleTypes } from "../data/user";
import { Languages } from "../data/common";
import { OrderStatus } from "../data/order";

export interface EscrowAccount {
  email: string;
  userWallets: Array<{
    coinSymbol: string;
    coinNetwork?: string;
    coinBalance: number;
    coinLastUsedOn: Date;
  }>;
}

export class EscrowService {
  private userService: UserService;
  private transactionService: TransactionService;

  constructor() {
    this.userService = new UserService();
    this.transactionService = new TransactionService();
  }

  // Initialize escrow account if it doesn't exist
  async initializeEscrowAccount() {
    const escrowEmail = "escrow@indexx.exchange";
    
    let escrowAccount = await this.userService.findOne({ email: escrowEmail });
    
    if (!escrowAccount) {
      // Create escrow account with basic structure
      escrowAccount = await this.userService.create({
        email: escrowEmail,
        username: "escrow",
        firstName: "Escrow",
        lastName: "Account",
        phone: "",
        walletAddress: "",
        isPhonePublic: false,
        isEmailPublic: false,
        language: Languages.US,
        userType: "Centralized",
        role: UserRoleTypes.Admin,
        basic: {
          userId: "",
          email: escrowEmail,
          firstName: "Escrow",
          lastName: "Account",
          role: UserRoleTypes.Admin,
          isVerified: true,
          language: "en",
          profilePhoto: ""
        },
        country: "US",
        userRiskLevel: "Low",
        authProviders: [],
        verification: {
          activated: true,
          activatedOn: new Date(),
          emailVerified: true,
          emailVerifiedOn: new Date(),
          emailCode: "",
          emailCodeExpiry: new Date(),
          phoneVerified: false,
          phoneVerifiedOn: new Date(),
          phoneCode: "",
          phoneCodeExpiry: new Date(),
          photoVerified: false,
          photoVerifiedOn: new Date(),
          photoCode: "",
          photoCodeExpiry: new Date()
        },
        accounts: [],
        address: {
          language: Languages.US,
          country: "US",
          state: "",
          city: "",
          place: "",
          addressLine1: "",
          addressLine2: "",
          pincode: ""
        },
        baseCurrency: "USD",
        referralCodeUsed: "",
        userWallets: [],
        freeTrailUserWallets: [],
        userRewards: {
          totalPoints: 0,
          redeemedPoints: 0,
          availablePoints: 0,
          lastUpdated: new Date()
        },
        lastLogin: new Date(),
        vipLevel: "VIP-1",
        kycStatus: "Approved",
        KYCUpdatedDate: new Date(),
        isKYCPass: true,
        isParticipatedInGroupReward: false,
        referralCode: "ESCROW",
        favouriteCurrencies: [],
        userMnemonic: "",
        password: "",
        relationships: [],
        captainBeeRelationShips: [],
        coinClaims: [],
        personalIdNumber: "",
        isTestFundActive: false,
        isWithdrawRestricted: false,
        isFreeTrailEnded: false,
        freeTrailStartDate: new Date(),
        freeTrailEndDate: new Date(),
        BTCYAcknowledgementStatus: false,
        BTCYAcknowledgementDate: new Date(),
        BTCYMigrationStatus: "",
        BTCYMigrationDate: new Date(),
        UserPrivacyBTCYAppSettings: {
          hideRealName: false
        },
        fcmToken: "",
        deviceType: "server",
        deviceModel: "",
        osVersion: "",
        lastActive: new Date(),
        brand: "",
        uniqueId: "",
        mutedChatIds: []
      } as any);
    }
    
    return escrowAccount;
  }

  // Lock crypto in escrow
  async lockInEscrow(
    fromEmail: string,
    cryptoCurrency: string,
    cryptoNetwork: string | undefined,
    amount: number,
    tradeId: string
  ): Promise<boolean> {
    try {
      await this.initializeEscrowAccount();
      
      // Debit from user
      const debitResult = await this.userService.updatePart(
        {
          email: fromEmail,
          "userWallets.coinSymbol": cryptoCurrency,
          ...(cryptoNetwork && { "userWallets.coinNetwork": cryptoNetwork }),
          "userWallets.coinBalance": { $gte: amount }
        },
        {
          $inc: { "userWallets.$.coinBalance": -amount },
          $set: { "userWallets.$.coinLastUsedOn": new Date() }
        }
      );

      if (!debitResult) {
        throw new Error("Insufficient balance or wallet not found");
      }

      // Credit to escrow account
      await this.userService.updatePart(
        {
          email: "escrow@indexx.exchange",
          "userWallets.coinSymbol": cryptoCurrency,
          ...(cryptoNetwork && { "userWallets.coinNetwork": cryptoNetwork })
        },
        {
          $inc: { "userWallets.$.coinBalance": amount },
          $set: { "userWallets.$.coinLastUsedOn": new Date() }
        }
      );

      // Create transaction record
      await this.transactionService.create({
        email: fromEmail,
        orderId: tradeId,
        extRef: `ESCROW_LOCK_${tradeId}`,
        txId: "",
        from: fromEmail,
        to: "escrow@indexx.exchange",
        amount: amount,
        info: `P2P Escrow Lock - ${cryptoCurrency}`,
        status: OrderStatus.Completed,
        currencyRef: cryptoCurrency,
        walletType: cryptoNetwork || "default",
        transactionType: "P2P_Escrow_Lock",
        exchangeName: "Indexx P2P",
        userWalletAddress: "",
        txDate: new Date(),
        benificaryAddress: "escrow@indexx.exchange"
      });

      return true;
    } catch (error) {
      console.error("Error locking in escrow:", error);
      return false;
    }
  }

  // Release from escrow
  async releaseFromEscrow(
    toEmail: string,
    cryptoCurrency: string,
    cryptoNetwork: string | undefined,
    amount: number,
    tradeId: string
  ): Promise<boolean> {
    try {
      // Debit from escrow account
      const debitResult = await this.userService.updatePart(
        {
          email: "escrow@indexx.exchange",
          "userWallets.coinSymbol": cryptoCurrency,
          ...(cryptoNetwork && { "userWallets.coinNetwork": cryptoNetwork }),
          "userWallets.coinBalance": { $gte: amount }
        },
        {
          $inc: { "userWallets.$.coinBalance": -amount },
          $set: { "userWallets.$.coinLastUsedOn": new Date() }
        }
      );

      if (!debitResult) {
        throw new Error("Insufficient escrow balance");
      }

      // Credit to user
      await this.userService.updatePart(
        {
          email: toEmail,
          "userWallets.coinSymbol": cryptoCurrency,
          ...(cryptoNetwork && { "userWallets.coinNetwork": cryptoNetwork })
        },
        {
          $inc: { "userWallets.$.coinBalance": amount },
          $set: { "userWallets.$.coinLastUsedOn": new Date() }
        }
      );

      // Create transaction record
      await this.transactionService.create({
        email: toEmail,
        orderId: tradeId,
        extRef: `ESCROW_RELEASE_${tradeId}`,
        txId: "",
        from: "escrow@indexx.exchange",
        to: toEmail,
        amount: amount,
        info: `P2P Escrow Release - ${cryptoCurrency}`,
        status: OrderStatus.Completed,
        currencyRef: cryptoCurrency,
        walletType: cryptoNetwork || "default",
        transactionType: "P2P_Escrow_Release",
        exchangeName: "Indexx P2P",
        userWalletAddress: "",
        txDate: new Date(),
        benificaryAddress: toEmail
      });

      return true;
    } catch (error) {
      console.error("Error releasing from escrow:", error);
      return false;
    }
  }

  // Refund from escrow (for cancelled trades)
  async refundFromEscrow(
    toEmail: string,
    cryptoCurrency: string,
    cryptoNetwork: string | undefined,
    amount: number,
    tradeId: string
  ): Promise<boolean> {
    return this.releaseFromEscrow(toEmail, cryptoCurrency, cryptoNetwork, amount, tradeId);
  }

  // Get escrow balance for a specific crypto
  async getEscrowBalance(cryptoCurrency: string, cryptoNetwork?: string): Promise<number> {
    try {
      const escrowAccount = await this.userService.findOne({ 
        email: "escrow@indexx.exchange" 
      });
      
      if (!escrowAccount) {
        return 0;
      }

      const wallet = escrowAccount.userWallets.find(w => 
        w.coinSymbol === cryptoCurrency && 
        (cryptoNetwork ? w.coinNetwork === cryptoNetwork : true)
      );

      return wallet ? wallet.coinBalance : 0;
    } catch (error) {
      console.error("Error getting escrow balance:", error);
      return 0;
    }
  }

  // Get total escrow balances
  async getAllEscrowBalances(): Promise<Array<{coinSymbol: string, coinNetwork?: string, balance: number}>> {
    try {
      const escrowAccount = await this.userService.findOne({ 
        email: "escrow@indexx.exchange" 
      });
      
      if (!escrowAccount) {
        return [];
      }

      return escrowAccount.userWallets.map(wallet => ({
        coinSymbol: wallet.coinSymbol,
        coinNetwork: wallet.coinNetwork,
        balance: wallet.coinBalance
      }));
    } catch (error) {
      console.error("Error getting all escrow balances:", error);
      return [];
    }
  }

  // Process automatic escrow release for completed trades
  async processAutomaticReleases(): Promise<void> {
    try {
      const { P2PTradeService } = require("./p2p.service");
      const p2pTradeService = new P2PTradeService();
      
      // Get trades that are confirmed but escrow not released
      const confirmedTrades = await p2pTradeService.find({
        status: P2PTradeStatus.Confirmed,
        escrowReleased: false
      });

      for (const trade of confirmedTrades) {
        const success = await this.releaseFromEscrow(
          trade.buyerEmail,
          trade.cryptoCurrency,
          trade.cryptoNetwork,
          trade.cryptoAmount,
          trade.tradeId
        );

        if (success) {
          await p2pTradeService.updatePart(
            { tradeId: trade.tradeId },
            { $set: { escrowReleased: true } }
          );
        }
      }
    } catch (error) {
      console.error("Error processing automatic releases:", error);
    }
  }
}
