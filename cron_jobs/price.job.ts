import { getPriceByName } from "../controllers/priceAPI";
import { CurrencyService } from "../services/currency.service";
const nodeCron = require("node-cron");

const currService: CurrencyService = new CurrencyService();

async function getLatestCryptoPrice() {
    try {
        console.log('I AM RUNNING');
        const getCurrencies = await currService.find({});

        for (let i = 0; i < getCurrencies.length; i++) {
            let currency = getCurrencies[i];
            if (currency.code == 'IN500' || currency.code == 'IUSD+' || currency.code == 'INXC' || currency.code == 'INEX' || currency.code == 'USD') {

            } else {
                const getCurrencyPrice = await getPriceByName(currency.code);
                if (getCurrencyPrice.status == 200) {
                    const updateCurrency = await currService.updatePart({ code: currency.code },
                        {
                            $set:
                            {
                                buyPrice: Math.round((getCurrencyPrice.data + Number.EPSILON) * 100) / 100,
                                sellPrice: Math.round((getCurrencyPrice.data - (getCurrencyPrice.data * 5 / 100)) * 100) / 100,
                                buyPriceUpdatedOn: new Date(),
                                sellPriceUpdatedOn: new Date()
                            }
                        });
                    console.log('Updated new prices at ' + new Date());
                }
            }
        }

    } catch (error) {

    }

}


// Schedule a job to run every five minutes
//export const job = nodeCron.schedule("*/5 * * * *", getLatestCryptoPrice);

// Schedule a job to run every one hour
export const job = nodeCron.schedule("*/59 * * * *", getLatestCryptoPrice);