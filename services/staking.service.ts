import { Staking } from "../data/staking";
import stakingSchema, { StakingModel } from "../models/staking";
import { ServiceBase } from "./base";

export class StakingService extends ServiceBase<Staking, StakingModel> {
    constructor() {
        super(stakingSchema, "Staking");
    }

}