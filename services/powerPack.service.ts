import { PowerPack } from "../data/powerpack";
import powerPackSchema, { PowerPackModel } from "../models/powerPack";
import { ServiceBase } from "./base";

export class PowerPackService extends ServiceBase<PowerPack, PowerPackModel> {
    constructor() {
        super(powerPackSchema, "PowerPack");
    }

}