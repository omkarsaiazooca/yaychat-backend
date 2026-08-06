import { Currency } from "./currency";
import { User } from "./user";
import { CurrencyAcceptance } from "./common";
import { IDocumentModel, IModel } from "./base";


export interface Country extends IModel, IDocumentModel<Country> {
    code: string;
    text: string;
    phoneCode: number;
    currencyId: number;
    phoneNumberStyle: string;
    cultureCode: string;
    trustValue: number;
    alphaSupport: boolean;
    note: string;
    cardFee: number;
    addTx: string;
    currency: Currency;
    users: User[];
    paymentGateWaysAccepted: CurrencyAcceptance;
}