import { Currency } from "../data/currency";
import { ETF } from "../data/etf";
import etfSchema, { ETFModel } from "../models/etf";
import { ServiceBase } from "./base";


export class ETFPriceService extends ServiceBase<ETF, ETFModel> {
    constructor() {
        super(etfSchema, "ETF");
    }

    async getETFPriceByType(etfCode: string) {
        try {
            const currencyRes = await this.findOne({ code: etfCode });
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