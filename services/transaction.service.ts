import { Transaction } from "../data/transaction";
import transactionSchema, { TransactionModel } from "../models/transaction";
import { ServiceBase } from "./base";

export class TransactionService extends ServiceBase<Transaction, TransactionModel> {
    constructor() {
        super(transactionSchema, "Transaction");
    }

}