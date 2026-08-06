import { ServiceBase } from "./base";
import userSchema, { UserModel } from "../models/user";
import { User } from "../data/user";
import * as bcrypt from "bcryptjs";

export class UserService extends ServiceBase<User, UserModel> {
  constructor() {
    super(userSchema, "User");
  }

  // creating a hash for the password
  createPassword = async function (password: string) {
    let generatedHash;
    let generatedSalt;

    generatedSalt = bcrypt.genSaltSync(10);
    generatedHash = bcrypt.hashSync(password, generatedSalt);

    return { hash: generatedHash, salt: generatedSalt };
  };

  comparePassword = async function (
    userPassowrd: string,
    dataBasePassword?: string
  ) {
    let compare = await bcrypt.compare(userPassowrd, String(dataBasePassword));
    console.log("compare", compare);
    console.log("userPassowrd", userPassowrd);
    console.log("dataBasePassword", dataBasePassword);
    return compare;
  };

  normalPasswordCompare = async function (
    userPassword: string,
    databasePassword: string
  ) {
    if (userPassword === databasePassword) {
      return true;
    } else {
      return false;
    }
  };

  /**
   * Mute a chat/group for a user
   */
  async muteChat(
    email: string,
    chatId: string,
    newState: boolean
  ): Promise<User | null> {
    const user = await this.findOne({ email });
    if (!user) {
      throw new Error("User not found");
    }

    let mutedChatIds = (user as any).mutedChatIds || [];
    if (newState) {
      if (!mutedChatIds.includes(chatId)) {
        mutedChatIds = [...mutedChatIds, chatId];
      }
    } else {
      if (mutedChatIds.includes(chatId)) {
        mutedChatIds = mutedChatIds.filter((id: string) => id !== chatId);
      }
    }

    const updatedUser = await this.updatePart(
      { email },
      { $set: { mutedChatIds: mutedChatIds } }
    );
    return updatedUser;
  }

  /**
   * Check if a chat/group is muted for a user
   */
  async isChatMuted(email: string, chatId: string): Promise<boolean> {
    const user = await this.findOne({ email });
    if (!user) {
      return false;
    }

    const mutedChatIds = user.mutedChatIds || [];
    return mutedChatIds.includes(chatId);
  }

  async getNuggetBalance(email: string): Promise<number> {
    const user = await this.findOneSelect(
      { email: email.toLowerCase() },
      { nuggetBalance: 1 }
    );
    return user?.nuggetBalance || 0;
  }

  async transferNuggets(email: string, amount: number) {
    if (amount < 10000) {
      throw new Error("Minimum 10,000 Nuggets required for transfer milestone");
    }

    return await this.updatePart(
      { email: email.toLowerCase() },
      {
        $inc: { nuggetBalance: amount },
      }
    );
  }
}
