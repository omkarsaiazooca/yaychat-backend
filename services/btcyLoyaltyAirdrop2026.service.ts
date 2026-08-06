import { Airdrop } from "../data/airdrop";
import AirdropSchema, { AirdropModel } from "../models/airdrop";
import { ServiceBase } from "./base";

export class BtcyLoyaltyAirdrop2026Service extends ServiceBase<
  Airdrop,
  AirdropModel
> {
  constructor() {
    super(AirdropSchema, "BTCYLoyaltyAirdrop2026Data");
  }

  isAirDropUserExistByEmail(email: string, tokenName: string) {
    return this.findOne({ email, tokenName });
  }

  countAirDropUsersByType(userType: string) {
    return this.findCount({ userType });
  }

  isAirDropUserExistByEmailAndEvent(
    email: string,
    tokenName: string,
    eventType: string
  ) {
    const normalizedEmail = email.toLowerCase();
    return this.findOne({
      email: normalizedEmail,
      tokenName,
      eventType,
    });
  }

  isAirdropUserExistsByWalletAddress(walletAddress: string, tokenName: string) {
    const lowerCaseWalletAddress = walletAddress.toLowerCase();
    return this.findOne({
      walletAddress: {
        $regex: new RegExp("^" + lowerCaseWalletAddress + "$", "i"),
      },
      tokenName,
    });
  }

  isAirdropUserExistsByWalletAndEvent(
    walletAddress: string,
    tokenName: string,
    eventType: string
  ) {
    const lowerCaseWalletAddress = walletAddress.toLowerCase();
    return this.findOne({
      walletAddress: {
        $regex: new RegExp("^" + lowerCaseWalletAddress + "$", "i"),
      },
      tokenName,
      eventType,
    });
  }
}
