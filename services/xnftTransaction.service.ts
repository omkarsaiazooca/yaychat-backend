import { XNFTTransaction } from "../data/xnftTransaction";
import xnftTransactionSchema, { XNFTTransactionModel } from "../models/xnftTransaction";
import { ServiceBase } from "./base";

export class XNFTTransactionService extends ServiceBase<XNFTTransaction, XNFTTransactionModel> {
    constructor() {
        super(xnftTransactionSchema, "XNFTTransaction");
    }

}