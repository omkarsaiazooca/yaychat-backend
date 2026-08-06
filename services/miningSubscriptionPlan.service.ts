import { SubscriptionPlan } from "../data/miningSubcriptionPlans";
import SubscriptionPlanSchema, { SubscriptionPlanModel } from "../models/miningSubscriptionPlans";
import { ServiceBase } from "./base";


// Insert plans into the database
export class SubscriptionPlansService extends ServiceBase<SubscriptionPlan, SubscriptionPlanModel> {
    constructor() {
        super(SubscriptionPlanSchema, "MiningSubscriptionPlan");
    }

    async upsertPlans(plans: SubscriptionPlan[]): Promise<SubscriptionPlanModel[]> {
        const updated: SubscriptionPlanModel[] = [];
        for (const plan of plans) {
            const normalizedName = (plan.name ?? "").trim();
            if (!normalizedName) {
                throw new Error("Plan name is required for every subscription plan entry");
            }

            const payload: SubscriptionPlan = {
                ...plan,
                name: normalizedName,
            };

            const result:any = await this.upsertOneAndGet(
                { name: normalizedName },
                { $set: payload },
                { new: true, upsert: true }
            );
            updated.push(result);
        }
        return updated;
    }
}
