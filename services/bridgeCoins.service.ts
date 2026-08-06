import { BridgeCoins } from "../data/bridgeCoins";
import bridgeCoinsSchema, { BridgeCoinsModel } from "../models/bridgeCoins";
import { ServiceBase } from "./base";

export class BridgeCoinsService extends ServiceBase<BridgeCoins, BridgeCoinsModel> {
    constructor() {
        super(bridgeCoinsSchema, "BridgeCoins");
    }

}