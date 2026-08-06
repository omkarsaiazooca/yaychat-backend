import { ServiceBase } from "./base";
import userSchema, { UserModel } from "../models/user";
import { User } from "../data/user";
import * as bcrypt from 'bcryptjs';

export class WalletUserService extends ServiceBase<User, UserModel> {
    constructor() {
        super(userSchema, "WalletUser");
    }

    // creating a hash for the password
    createPassword = async function (password: string) {

        let generatedHash;
        let generatedSalt;

        generatedSalt = bcrypt.genSaltSync(10);
        generatedHash = bcrypt.hashSync(password, generatedSalt)

        return { hash: generatedHash, salt: generatedSalt }
    }

    comparePassword = async function (userPassowrd: string, dataBasePassword?: string) {
        let compare = await bcrypt.compare(userPassowrd, String(dataBasePassword));
        console.log("compare", compare);
        console.log("userPassowrd", userPassowrd);
        console.log("dataBasePassword", dataBasePassword);
        return compare;
    }

}