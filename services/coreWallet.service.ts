import { CoreWallet } from "../data/coreWallet";
import coreWalletSchema, { CoreWalletModel } from "../models/coreWallet";
import { ServiceBase } from "./base";

export class CoreWalletService extends ServiceBase<CoreWallet, CoreWalletModel> {
    constructor() {
        super(coreWalletSchema, "CoreWallet");
    }

    
    async getWalletAddressForExchange(coin: string) {
        try {
            const wallet = await this.findOne({ coin: coin });
            return wallet;
        } catch (err) {
            throw err;
        }
    }
}