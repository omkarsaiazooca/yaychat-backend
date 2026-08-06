import { SorektNFTTx } from '../data/sorektNFTTx';
import sorektNFTSchema, { SorektNFTTxModel } from "../models/sorektNFTTx";
import { ServiceBase } from "./base";

export class SorektNFTTxService extends ServiceBase<SorektNFTTx, SorektNFTTxModel> {
    constructor() {
        super(sorektNFTSchema, "SorektNFTTx");
    }

}