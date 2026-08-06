import { Transaction } from "./transaction";

export interface TransactionMethod {
    id: number;
    text: string;
    transactions: Transaction[];
}