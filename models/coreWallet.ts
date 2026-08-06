import { Schema } from "mongoose";
import { IDocumentModel } from "../data/base";
import { Currency, CurrencyAcceptance } from "../data/common";
import { CoreWallet } from "../data/coreWallet";

export interface CoreWalletModel extends IDocumentModel<CoreWallet>, CoreWallet {}

export var coreWalletSchema: Schema = new Schema();

coreWalletSchema.add({
    coin: String,
    coinBalance: Number,
    coinAddress: String,
    coinLastUsed: Date,
    coinPrivateKey: String,
    coinNetwork: String,
    coinName: String,
    coinSymbol: String,
});

export default coreWalletSchema;
