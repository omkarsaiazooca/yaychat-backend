import { Airdrop } from "../data/airdrop";
import AirdropSchema, { AirdropModel } from "../models/airdrop";
import { ServiceBase } from "./base";

export class BtcyAirdropService extends ServiceBase<Airdrop, AirdropModel> {
  constructor() {
    super(AirdropSchema, "BTCYAirdropData");
  }

  isAirDropUserExistByEmail(email: string, tokenName: string) {
    return this.findOne({ email, tokenName });
  }

  countAirDropUsersByType(userType:string) {
    return this.findCount({ userType: userType });
  }

  isAirDropUserExistByEmailAndEvent(
    email: string,
    tokenName: string,
    eventType: string
  ) {
    // Normalize the email to lowercase to ensure case-insensitive matching
    const normalizedEmail = email.toLowerCase();

    return this.findOne({
      email: normalizedEmail,
      tokenName,
      eventType,
    });
  }

  isAirdropUserExistsByWalletAddress(walletAddress: string, tokenName: string) {
    // Convert the wallet address to lowercase for the comparison
    const lowerCaseWalletAddress = walletAddress.toLowerCase();

    // Use a case-insensitive query
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
    // Convert the wallet address to lowercase for the comparison
    const lowerCaseWalletAddress = walletAddress.toLowerCase();

    return this.findOne({
      walletAddress: {
        $regex: new RegExp("^" + lowerCaseWalletAddress + "$", "i"),
      },
      tokenName,
      eventType,
    });
  }

  async getMostRecentRegistrationByEmail(email: string) {
    try {
      const mostRecentRegistration = await this.findOne({
        email: email.toLowerCase(),
      }); // assuming email is stored in lowercase
      console.log();
      return mostRecentRegistration; // This will be null if no documents match
    } catch (err) {
      console.error(
        "Error fetching the most recent registration by email:",
        err
      );
      throw err; // Rethrow or handle error as appropriate for your application
    }
  }

  async getMostRecentRegistrationByWalletAddress(address: string) {
    try {
      const mostRecentRegistration = await this.findOne({
        walletAddress: address.toLowerCase(),
      }); // assuming address is stored in lowercase
      console.log();
      return mostRecentRegistration; // This will be null if no documents match
    } catch (err) {
      console.error(
        "Error fetching the most recent registration by email:",
        err
      );
      throw err; // Rethrow or handle error as appropriate for your application
    }
  }
}
