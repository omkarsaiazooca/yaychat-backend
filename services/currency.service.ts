import { Currency } from "../data/currency";
import currencySchema, { CurrencyModel } from "../models/currency";
import { ServiceBase } from "./base";


export class CurrencyService extends ServiceBase<Currency, CurrencyModel> {
    constructor() {
        super(currencySchema, "Currency");
    }

    async getCurrencyPriceByType(currencyType: string, currencyCode: string) {
        try {
            const currencyRes = await this.findOne({ type: currencyType, currency: currencyCode });
            if (currencyRes) {
                return { status: 200, data: currencyRes };
            } else {
                return { status: 500, data: {} as Currency };
            }
        } catch (err) {
            console.log(err);
            return { status: 500, data: {} as Currency };
        }
    }
}