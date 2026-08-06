import { Country } from "./country";
import { CurrencyType } from "./common";
import { Order } from "./order";
import { Transaction } from "./transaction";
import {  CurrencyAcceptance } from "./common";

export interface Currency {
    currencyType: string;
    code: string;
    text: string;
    fXMarkUp?: number;
    bitgoSettings?: string;
    isActive: boolean;
    buyPrice: number;
    sellPrice: number;
    buyPriceUpdatedOn: Date;
    sellPriceUpdatedOn: Date;
    min: number;
    max: number;
    type: string;
    fees: number;
}
/*
{
    "code": "BTC",
    "min": 50,
    "max": 5000,
    "type": "BUY",
    "fees": 0.1,
    "currencytype": "Crypto",
    "text": "Bitcoin",
    "isactive": true,
    "buyprice": 20743.83,
    "sellprice": 20225.71,
    "buypriceupdatedon": "27/10/22",
    "sellpriceupdatedon": "27/10/22"
},*/