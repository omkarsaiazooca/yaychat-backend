import { Commission } from "../data/commission";
import commissionSchema, { CommissionModel } from "../models/commission";
import { ServiceBase } from "./base";

export class CommissionService extends ServiceBase<
  Commission,
  CommissionModel
> {
  constructor() {
    super(commissionSchema, "Commission");
  }
}
