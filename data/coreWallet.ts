import { IDocumentModel, IModel } from "./base";


export interface CoreWallet extends IModel, IDocumentModel<CoreWallet> {
    coin: string;
    coinBalance: number;
    coinAddress: string;
    coinLastUsed: Date;
    coinPrivateKey: string;
    coinNetwork: string;
    coinName: string;
    coinSymbol: string;
}