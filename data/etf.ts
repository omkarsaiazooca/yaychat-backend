interface ETFData {
    name: string;
    percentage: number;
    code: string;
}

export interface ETF {
    etfType: string;
    etfName: string,
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
    etfWeightAge: ETFData;
}
/*
{
    "code": "ALCRYP", // DIFFERENT ETF WE SUPPORT
    "min": 50,
    "max": 5000,
    "type": "BUY",
    "fees": 0.1,
    "etfType": "ETF",
    "text": "Bitcoin",
    "isactive": true,
    "buyprice": 20743.83,
    "sellprice": 20225.71,
    "buypriceupdatedon": "27/10/22",
    "sellpriceupdatedon": "27/10/22"
},*/